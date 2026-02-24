import uuid
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="ID")
    name = models.CharField(max_length=255, unique=True, verbose_name="Название")
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "departments"
        verbose_name = "Департамент"
        verbose_name_plural = "Департаменты"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BrandingSettings(models.Model):
    id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=1,
        editable=False,
        verbose_name="ID",
    )
    project_name = models.CharField(
        max_length=100,
        default="SingleLunch",
        verbose_name="Название проекта",
    )
    logo = models.ImageField(
        upload_to="branding/",
        null=True,
        blank=True,
        verbose_name="Логотип",
    )
    payment_qr = models.ImageField(
        upload_to="branding/payment_qr/",
        null=True,
        blank=True,
        verbose_name="Единый QR оплаты",
    )
    lunch_price = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("170.00"),
        verbose_name="Цена за порцию (сом)",
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    class Meta:
        db_table = "branding_settings"
        verbose_name = "Брендинг"
        verbose_name_plural = "Брендинг"

    def save(self, *args, **kwargs):
        self.id = 1
        return super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

    def __str__(self):
        return self.project_name


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name="ID")
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

    birth_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Дата рождения",
    )
    phone_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="Номер телефона",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
        verbose_name="Департамент",
    )

    telegram_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        verbose_name="Telegram ID"
    )

    mattermost_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True,
        verbose_name="Mattermost ID"
    )

    ROLE_CHOICES = [
        ("EMPLOYEE", "Сотрудник"),
        ("CANTEEN", "Представитель Столовой"),
    ]
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="EMPLOYEE"
    )

    class Meta:
        db_table = "users"
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.get_full_name() or self.username
