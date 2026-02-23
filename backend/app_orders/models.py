import uuid

from django.db import models

from app_catering.models import DailyMenu, MenuOption
from app_users.models import User

class Order(models.Model):
    """Главный контейнер: Заказ на конкретный день, сделанный сотрудником."""
    class Status(models.TextChoices):
        AWAITING_PAYMENT = "AWAITING_PAYMENT", "Ожидает оплаты"
        PAID = "PAID", "Оплачен (подтвержден)"
        CANCELLED = "CANCELLED", "Отменен"
        MISSED_DEADLINE = "MISSED_DEADLINE", "Пропущен срок"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="ID")
    employee = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Сотрудник"
    )
    daily_menu = models.ForeignKey(
        DailyMenu,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Меню дня"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AWAITING_PAYMENT,
        verbose_name="Статус заказа"
    )

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
        ordering = ["-created_at"]

    def __str__(self):
        return f"Заказ {self.id} от {self.employee.username} на {self.daily_menu.date}"
    
    
class OrderItem(models.Model):
    """Позиция внутри заказа: Что именно и сколько порций заказано."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="ID")
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Принадлежит заказу"
    )

    menu_option = models.ForeignKey(
        MenuOption,
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
        unique_together = ["order", "menu_option"]

    @property
    def total_price(self):
        return self.price_per_item * self.quantity


class NotificationLog(models.Model):
    class Channel(models.TextChoices):
        TELEGRAM = "TELEGRAM", "Telegram"
        MATTERMOST = "MATTERMOST", "Mattermost"

    class Type(models.TextChoices):
        ORDER_REMINDER = "ORDER_REMINDER", "Напоминание о заказе"
        DUTY_REMINDER = "DUTY_REMINDER", "Напоминание о дежурстве"

    class Status(models.TextChoices):
        SENT = "SENT", "Отправлено"
        FAILED = "FAILED", "Ошибка"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="ID")
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="notification_logs",
        verbose_name="Пользователь",
    )
    menu_date = models.DateField(verbose_name="Дата меню")
    channel = models.CharField(
        max_length=20,
        choices=Channel.choices,
        verbose_name="Канал",
    )
    notification_type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.ORDER_REMINDER,
        verbose_name="Тип уведомления",
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        verbose_name="Статус отправки",
    )
    error_message = models.TextField(blank=True, default="", verbose_name="Ошибка")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Лог уведомления"
        verbose_name_plural = "Логи уведомлений"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "menu_date", "channel", "notification_type"],
                name="uniq_notification_per_user_menu_channel_type",
            )
        ]

    def __str__(self):
        return (
            f"{self.user.username} | {self.menu_date} | "
            f"{self.notification_type} | {self.channel} | {self.status}"
        )
