# app_orders/services.py

from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from app_users.models import User
from app_catering.models import DailyMenu, MenuOption
from app_orders.models import Order, OrderItem
from typing import List, Dict, Any, Tuple

class OrderService:
    """Сервис для обработки бизнес-логики создания заказов."""

    def validate_menu_deadline(self, daily_menu: DailyMenu) -> None:
        """Проверяет, не прошел ли крайний срок выбора."""
        if timezone.now() > daily_menu.selection_deadline:
            raise ValueError(
                f"Крайний срок выбора меню на {daily_menu.date} прошел в {daily_menu.selection_deadline.strftime('%H:%M')}."
            )

    def validate_order_items(self, daily_menu: DailyMenu, items_data: List[Dict[str, Any]]) -> List[Tuple[MenuOption, int]]:
        """Проверяет позиции заказа на существование и доступность."""
        if not items_data:
            raise ValueError("Список позиций для заказа не может быть пустым.")

        validated_items: List[Tuple[MenuOption, int]] = []
        available_options = daily_menu.options.in_bulk()  

        for item in items_data:
            option_id = item.get('menu_option_id')
            quantity = item.get('quantity', 0)
            
            if not option_id or quantity <= 0:
                raise ValueError(f"Неверные данные позиции: {item}")

            menu_option = available_options.get(option_id)
            if not menu_option or menu_option.daily_menu_id != daily_menu.id:
                raise ValueError(f"Позиция меню ID {option_id} недоступна для выбранной даты.")

            validated_items.append((menu_option, quantity))
            
        return validated_items

    @transaction.atomic
    def create_order(self, employee: User, daily_menu: DailyMenu, validated_items: List[Tuple[MenuOption, int]]) -> Order:
        """
        Создает Заказ (Order) и все Позиции Заказа (OrderItem) в рамках одной транзакции.
        Также создает транзакцию долга в finance.
        """
        from app_finance.models import Transaction  
        
        if Order.objects.filter(employee=employee, daily_menu=daily_menu).exists():
            raise ValueError("Заказ на выбранную дату для этого сотрудника уже существует.")
            
        total_amount = Decimal('0.00')
        order_items_to_create = []

        # 2. Создаем OrderItem'ы и рассчитываем общую сумму
        for menu_option, quantity in validated_items:
            price_per_item = menu_option.price
            item_total = price_per_item * quantity
            total_amount += item_total
            
            order_items_to_create.append(OrderItem(
                menu_option=menu_option,
                quantity=quantity,
                price_per_item=price_per_item
            ))

        # 3. Создаем Order (Заказ)
        order = Order.objects.create(
            employee=employee,
            daily_menu=daily_menu,
            status=Order.STATUS_CHOICES[0][0], # 'NEW'
            total_amount=total_amount
        )
        
        # Привязываем OrderItem'ы к созданному Order
        for item in order_items_to_create:
            item.order = order
            
        # Массовое создание OrderItem (Batch insertion) - это быстрее
        OrderItem.objects.bulk_create(order_items_to_create)

        # 4. Создаем Транзакцию (Начисление долга)
        Transaction.objects.create(
            employee=employee,
            order=order,
            type='DEBET_ORDER',
            amount=total_amount,
            is_verified=True # Долг начисляется сразу
        )

        return order