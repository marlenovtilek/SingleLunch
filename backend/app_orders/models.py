
import uuid
from django.db import models
from app_users.models import User
from app_catering.models import DailyMenu, MenuOption

class Order(models.Model):
    """Главный контейнер: Заказ на конкретный день, сделанный сотрудником."""
    
    STATUS_CHOICES = [
        ('NEW', 'Новый заказ (выбран)'),
        ('AWAITING_PAYMENT', 'Ожидает оплаты'),
        ('PAID', 'Оплачен (подтвержден)'),
        ('CANCELLED', 'Отменен'),
        ('MISSED_DEADLINE', 'Пропущен срок'),
    ]
    id = models.UUIDField(primary_key=True, unique=True,  default=uuid.uuid4,verbose_name='ID')
    employee = models.ForeignKey(
        User, 
        blank=True, null=True,
        on_delete=models.CASCADE, 
        related_name='orders',
        verbose_name="Сотрудник"
    )
    daily_menu = models.ForeignKey(  
        DailyMenu, 
        on_delete=models.PROTECT, 
        related_name='orders',
        verbose_name="Меню дня"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    total_amount = models.DecimalField(
        max_digits=8, 
        decimal_places=2,
        default=0,
        verbose_name="Итоговая сумма заказа"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        unique_together = ['employee', 'daily_menu'] 
        ordering = ['-created_at']

    def __str__(self):
        return f"Заказ {self.id} от {self.employee.username} на {self.daily_menu.date}"
    
    
class OrderItem(models.Model):
    """Позиция внутри заказа: Что именно и сколько порций заказано."""
    
    id = models.UUIDField(primary_key=True, unique=True, default=uuid.uuid4, verbose_name='ID')
    order = models.ForeignKey(
        Order,
        blank=True, null=True,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="Принадлежит заказу"
    )
     
    menu_option = models.ForeignKey(
        MenuOption,
        blank=True, null=True,
        on_delete=models.PROTECT, 
        verbose_name="Выбранная позиция меню дня"
    )
    
    quantity = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Количество порций"
    )
     
    price_per_item = models.DecimalField(
        max_digits=6, 
        decimal_places=2,
        verbose_name="Цена за 1 порцию на момент заказа"
    )

    class Meta:
        verbose_name = "Позиция заказа"
        verbose_name_plural = "Позиции заказов"
        unique_together = ['order', 'menu_option']