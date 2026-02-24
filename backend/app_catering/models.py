import uuid
from django.db import models
from decimal import Decimal

class DailyMenu(models.Model):
    """Дневное меню (контейнер для опций, привязанный к дате)."""
    
    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4, verbose_name='Daily Menu ID')
    date = models.DateField(unique=True,
        verbose_name="Дата обеда"
    )
    selection_deadline = models.DateTimeField(
        verbose_name="Крайний срок выбора (напр. 20:00 предыдущего дня)"
    )
    created_by = models.ForeignKey(
        'app_users.User',
        on_delete=models.PROTECT,
        verbose_name="Создатель меню",
        null=True, blank=True
    )
    payment_qr = models.ImageField(
        upload_to="menu_qr/",
        null=True,
        blank=True,
        verbose_name="QR для оплаты",
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
    id = models.UUIDField(primary_key=True,  default=uuid.uuid4, verbose_name='Menu Option ID')
    daily_menu = models.ForeignKey(
        DailyMenu,
        on_delete=models.CASCADE, 
        related_name='options',
        verbose_name="Принадлежит меню дня"
    )
    name = models.CharField(max_length=255, verbose_name="Название позиции")
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


class DutyAssignment(models.Model):
    """Кто дежурит в конкретную дату."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="Duty Assignment ID")
    date = models.DateField(unique=True, verbose_name="Дата дежурства")
    assignee = models.ForeignKey(
        "app_users.User",
        on_delete=models.PROTECT,
        related_name="duty_assignments",
        verbose_name="Дежурный",
    )
    created_by = models.ForeignKey(
        "app_users.User",
        on_delete=models.PROTECT,
        related_name="created_duty_assignments",
        null=True,
        blank=True,
        verbose_name="Назначил",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлено")

    class Meta:
        verbose_name = "Дежурство"
        verbose_name_plural = "Дежурства"
        ordering = ["date"]

    def __str__(self):
        return f"{self.date} — {self.assignee.username}"
