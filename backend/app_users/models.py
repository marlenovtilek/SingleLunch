import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, unique=True,default=uuid.uuid4,  verbose_name='ID')
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    modified_at = models.DateTimeField(_("modified at"), auto_now=True)

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
        ('EMPLOYEE', 'Сотрудник'),
        ('ADMIN', 'Администратор'),
        ('CANTEEN', 'Представитель Столовой'),
    ]
    role = models.CharField(
        max_length=10, 
        choices=ROLE_CHOICES, 
        default='EMPLOYEE'
    )
    
    class Meta:
        db_table = "users"
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.get_full_name() or self.username
