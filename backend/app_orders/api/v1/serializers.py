from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from app_catering.models import DailyMenu, MenuOption
from app_finance.models import Payment
from app_orders.models import Order, OrderItem


class OrderItemCreateSerializer(serializers.Serializer):
    menu_option_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)


class OrderItemReadSerializer(serializers.ModelSerializer):
    menu_option_name = serializers.CharField(source="menu_option.name", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_option",
            "menu_option_name",
            "quantity",
            "price_per_item",
            "line_total",
        ]

    def get_line_total(self, obj) -> Decimal:
        return obj.total_price


class OrderReadSerializer(serializers.ModelSerializer):
    daily_menu_date = serializers.DateField(source="daily_menu.date", read_only=True)
    payment_qr_url = serializers.SerializerMethodField()
    items = OrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "daily_menu",
            "daily_menu_date",
            "payment_qr_url",
            "status",
            "total_amount",
            "created_at",
            "items",
        ]

    def get_payment_qr_url(self, obj) -> str | None:
        payment_qr = getattr(obj.daily_menu, "payment_qr", None)
        if not payment_qr:
            return None
        return payment_qr.url


class CanteenOrderReadSerializer(OrderReadSerializer):
    employee_username = serializers.CharField(source="employee.username", read_only=True)
    payment_screenshot_url = serializers.SerializerMethodField()

    class Meta(OrderReadSerializer.Meta):
        fields = OrderReadSerializer.Meta.fields + [
            "employee_username",
            "payment_screenshot_url",
        ]

    def get_payment_screenshot_url(self, obj) -> str | None:
        try:
            payment = obj.payment
        except Payment.DoesNotExist:
            return None

        screenshot = getattr(payment, "screenshot", None)
        if not screenshot:
            return None
        return screenshot.url


class CanteenOrderItemTotalSerializer(serializers.Serializer):
    menu_option_id = serializers.UUIDField()
    name = serializers.CharField()
    total_quantity = serializers.IntegerField()


class CanteenOrdersDashboardSerializer(serializers.Serializer):
    date = serializers.DateField()
    orders_count = serializers.IntegerField()
    paid_count = serializers.IntegerField()
    awaiting_payment_count = serializers.IntegerField()
    cancelled_count = serializers.IntegerField()
    missed_deadline_count = serializers.IntegerField()
    total_paid_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    orders = CanteenOrderReadSerializer(many=True)
    confirmed_item_totals = CanteenOrderItemTotalSerializer(many=True)


class OrderCreateSerializer(serializers.Serializer):
    daily_menu_id = serializers.UUIDField()
    items = OrderItemCreateSerializer(many=True)

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            raise serializers.ValidationError("Запрос не найден")

        items = attrs.get("items") or []
        if not items:
            raise serializers.ValidationError({"items": "Добавьте хотя бы одну позицию"})

        daily_menu = DailyMenu.objects.filter(
            pk=attrs["daily_menu_id"],
            is_active=True,
        ).first()
        if not daily_menu:
            raise serializers.ValidationError({"daily_menu_id": "Меню не найдено"})

        if timezone.now() > daily_menu.selection_deadline:
            raise serializers.ValidationError(
                {"daily_menu_id": "Срок выбора меню уже прошел"}
            )

        option_ids = [item["menu_option_id"] for item in items]
        if len(option_ids) != len(set(option_ids)):
            raise serializers.ValidationError(
                {"items": "Одна и та же позиция меню не должна повторяться"}
            )

        menu_options = {
            option.id: option
            for option in MenuOption.objects.filter(
                daily_menu=daily_menu,
                id__in=option_ids,
            )
        }
        if len(menu_options) != len(option_ids):
            raise serializers.ValidationError(
                {"items": "Одна или несколько позиций не принадлежат выбранному меню"}
            )

        attrs["daily_menu"] = daily_menu
        attrs["menu_options"] = menu_options
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        daily_menu = validated_data["daily_menu"]
        menu_options = validated_data["menu_options"]
        items_data = validated_data["items"]
        order = Order.objects.create(
            employee=request.user,
            daily_menu=daily_menu,
            status=Order.Status.AWAITING_PAYMENT,
            total_amount=Decimal("0.00"),
        )

        total_amount = Decimal("0.00")
        order_items = []
        for item_data in items_data:
            menu_option = menu_options[item_data["menu_option_id"]]
            quantity = item_data["quantity"]
            price_per_item = menu_option.price
            total_amount += price_per_item * quantity

            order_items.append(
                OrderItem(
                    order=order,
                    menu_option=menu_option,
                    quantity=quantity,
                    price_per_item=price_per_item,
                )
            )

        OrderItem.objects.bulk_create(order_items)
        order.total_amount = total_amount
        order.save(update_fields=["total_amount"])
        return order

class OrderPaymentSerializer(serializers.Serializer):
    screenshot = serializers.ImageField()

    def validate_screenshot(self, screenshot):
        if screenshot.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Размер скриншота не должен превышать 5 МБ")
        return screenshot

    def validate(self, attrs):
        order = self.context.get("order")
        request = self.context.get("request")

        if not order:
            raise serializers.ValidationError("Заказ не найден")
        if not request:
            raise serializers.ValidationError("Запрос не найден")

        if order.employee_id != request.user.id:
            raise serializers.ValidationError("Это не ваш заказ")

        if order.status != Order.Status.AWAITING_PAYMENT:
            raise serializers.ValidationError("Заказ нельзя оплатить")

        deadline = getattr(order.daily_menu, "selection_deadline", None)
        if not deadline:
            raise serializers.ValidationError("Дедлайн не задан")
        if timezone.now() > deadline:
            raise serializers.ValidationError("Срок оплаты заказа истек")

        if Payment.objects.filter(order=order).exists():
            raise serializers.ValidationError("Заказ уже оплачен")

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        order = self.context["order"]
        order = order.__class__.objects.select_for_update().select_related("daily_menu").get(pk=order.pk)
        if order.employee_id != request.user.id:
            raise serializers.ValidationError("Это не ваш заказ")

        if order.status != Order.Status.AWAITING_PAYMENT:
            raise serializers.ValidationError("Заказ нельзя оплатить")

        deadline = getattr(order.daily_menu, "selection_deadline", None)
        if not deadline:
            raise serializers.ValidationError("Дедлайн не задан")
        if timezone.now() > deadline:
            raise serializers.ValidationError("Срок оплаты заказа истек")

        if Payment.objects.filter(order=order).exists():
            raise serializers.ValidationError("Заказ уже оплачен")

        payment = Payment.objects.create(
            order=order,
            amount=order.total_amount,
            screenshot=validated_data["screenshot"],
        )
        order.status = Order.Status.PAID
        order.save(update_fields=["status"])
        return payment
