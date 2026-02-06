import uuid
from django.db import models
from decimal import Decimal

class DailyMenu(models.Model):
    """Дневное меню (контейнер для опций, привязанный к дате)."""
    
    id = models.UUIDField(primary_key=True, unique=True, editable=False,  default=uuid.uuid4, verbose_name='ID')
    date = models.DateField(
        blank=True, null=True,
        verbose_name="Дата обеда"
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name="Активно для выбора"
    )
    selection_deadline = models.DateTimeField(
        blank=True, null=True,
        verbose_name="Крайний срок выбора (напр. 20:00 предыдущего дня)"
    )
    
    class Meta:
        verbose_name = "Дневное меню"
        verbose_name_plural = "Дневные меню"
        # ordering = ['-date']

    def __str__(self):
        return f"Меню на {self.date}"
    
class MenuOption(models.Model):
    """
    Конкретная позиция, доступная для выбора в этот день. 
    (Меню №1, Меню №2, Доп. Салат)
    """
    id = models.UUIDField(primary_key=True,  default=uuid.uuid4,unique=True, verbose_name='ID')
    daily_menu = models.ForeignKey(
        DailyMenu, 
        blank=True, null=True,
        on_delete=models.CASCADE, 
        related_name='options',
        verbose_name="Принадлежит меню дня"
    )
    name = models.CharField(max_length=255, verbose_name="Название позиции")
    description = models.TextField(verbose_name="Состав")
    price = models.DecimalField(
        max_digits=6, 
        default=Decimal("170.0"),
        decimal_places=2,
        verbose_name="Цена"
    )
    
    class Meta:
        verbose_name = "Вариант меню"
        verbose_name_plural = "Варианты меню"
        # unique_together = ['daily_menu', 'name'] 

    def __str__(self):
        return f"{self.daily_menu.date}: {self.name}"
 