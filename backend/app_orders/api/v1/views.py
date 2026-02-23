from datetime import date
from decimal import Decimal

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import generics, permissions, status, views
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from app_catering.permissions import IsCanteenOrAdmin
from app_orders.api.v1.serializers import (
    CanteenOrdersDashboardSerializer,
    OrderCreateSerializer,
    OrderPaymentSerializer,
    OrderReadSerializer,
)
from app_orders.models import Order, OrderItem


def ensure_employee_only(user):
    if user.is_superuser or user.is_staff:
        raise PermissionDenied("Администратор не может оформлять, оплачивать и отменять заказы.")
    if getattr(user, "role", None) == "CANTEEN":
        raise PermissionDenied("Представитель столовой не может оформлять заказы.")
    if getattr(user, "role", None) == "EMPLOYEE":
        return
    raise PermissionDenied("Только сотрудники могут оформлять и менять свои заказы.")


class OrderCreateAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderCreateSerializer

    @extend_schema(
        request=OrderCreateSerializer,
        responses={201: OrderReadSerializer},
    )
    def post(self, request, *args, **kwargs):
        ensure_employee_only(request.user)
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderReadSerializer(order).data, status=status.HTTP_201_CREATED)


class MyOrdersListAPIView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderReadSerializer

    def get_queryset(self):
        ensure_employee_only(self.request.user)
        return (
            Order.objects.filter(employee=self.request.user)
            .select_related("daily_menu")
            .prefetch_related("items__menu_option")
            .order_by("-created_at")
        )


class OrderPaymentCreateAPIView(views.APIView):
    """
    Создание платежа
    """
    serializer_class = OrderPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=OrderPaymentSerializer,
        responses={201: OrderPaymentSerializer},
    )
    def post(self, request, *args, **kwargs):
        ensure_employee_only(request.user)
        order = get_object_or_404(Order, pk=kwargs["pk"])
        serializer = self.serializer_class(
            data=request.data,
            context={"order": order, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(self.serializer_class(payment).data, status=status.HTTP_201_CREATED)


class OrderCancelAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=None,
        responses={200: OrderReadSerializer},
    )
    def post(self, request, *args, **kwargs):
        ensure_employee_only(request.user)
        order = get_object_or_404(
            Order.objects.select_related("daily_menu").prefetch_related("items__menu_option"),
            pk=kwargs["pk"],
            employee=request.user,
        )

        if order.status != Order.Status.AWAITING_PAYMENT:
            raise ValidationError("Отменить можно только заказ в статусе AWAITING_PAYMENT.")

        if timezone.now() > order.daily_menu.selection_deadline:
            order.status = Order.Status.MISSED_DEADLINE
            order.save(update_fields=["status"])
            raise ValidationError("Дедлайн уже прошёл. Заказ переведен в MISSED_DEADLINE.")

        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(OrderReadSerializer(order).data, status=status.HTTP_200_OK)


class CanteenOrdersDashboardAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Дата в формате YYYY-MM-DD. По умолчанию сегодня.",
            )
        ],
        responses={200: CanteenOrdersDashboardSerializer},
    )
    def get(self, request, *args, **kwargs):
        selected_date = request.query_params.get("date")
        if selected_date:
            try:
                menu_date = date.fromisoformat(selected_date)
            except ValueError as error:
                raise ValidationError(
                    {"date": "Неверный формат даты. Используй YYYY-MM-DD"}
                ) from error
        else:
            menu_date = timezone.localdate()

        orders_qs = (
            Order.objects.filter(daily_menu__date=menu_date)
            .select_related("employee", "daily_menu", "payment")
            .prefetch_related("items__menu_option")
            .order_by("created_at")
        )
        orders = list(orders_qs)

        total_paid_amount = sum(
            (
                order.total_amount
                for order in orders
                if order.status == Order.Status.PAID
            ),
            Decimal("0.00"),
        )

        confirmed_item_totals = list(
            OrderItem.objects.filter(
                order__daily_menu__date=menu_date,
                order__status=Order.Status.PAID,
            )
            .values(
                "menu_option_id",
                "menu_option__name",
            )
            .annotate(total_quantity=Sum("quantity"))
            .order_by("menu_option__name")
        )
        normalized_totals = [
            {
                "menu_option_id": item["menu_option_id"],
                "name": item["menu_option__name"],
                "total_quantity": item["total_quantity"],
            }
            for item in confirmed_item_totals
        ]

        payload = {
            "date": menu_date,
            "orders_count": len(orders),
            "paid_count": sum(1 for order in orders if order.status == Order.Status.PAID),
            "awaiting_payment_count": sum(
                1 for order in orders if order.status == Order.Status.AWAITING_PAYMENT
            ),
            "cancelled_count": sum(
                1 for order in orders if order.status == Order.Status.CANCELLED
            ),
            "missed_deadline_count": sum(
                1 for order in orders if order.status == Order.Status.MISSED_DEADLINE
            ),
            "total_paid_amount": total_paid_amount,
            "orders": orders,
            "confirmed_item_totals": normalized_totals,
        }
        return Response(CanteenOrdersDashboardSerializer(payload).data, status=status.HTTP_200_OK)
