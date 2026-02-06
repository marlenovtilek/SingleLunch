from rest_framework import serializers
from app_orders.models import Order, OrderItem
from app_catering.models import DailyMenu







        
class OrderItemInputSerializer(serializers.Serializer):
    """Сериализатор для одной позиции, которую выбрал пользователь."""
    menu_option_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)

class OrderCreateSerializer(serializers.Serializer):
    """Основной сериализатор для создания заказа."""
    daily_menu_id = serializers.IntegerField(
        label="ID Меню Дня",
        help_text="ID DailyMenu, на которое делается заказ."
    )
    items = OrderItemInputSerializer(
        many=True,
        label="Позиции заказа",
        help_text="Список позиций и их количество."
    )

    def validate_daily_menu_id(self, value):
        """Проверка существования DailyMenu."""
        try:
            self.daily_menu = DailyMenu.objects.get(pk=value, is_active=True)
        except DailyMenu.DoesNotExist:
            raise serializers.ValidationError("Выбранное меню дня не найдено или не активно.")
        return value

class OrderDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для отдачи созданного заказа (для ответа)."""
    # Здесь можно добавить вложенные сериализаторы для OrderItem

    class Meta:
        model = Order
        fields = ['id', 'employee', 'daily_menu', 'status', 'total_amount', 'created_at']
        read_only_fields = fields