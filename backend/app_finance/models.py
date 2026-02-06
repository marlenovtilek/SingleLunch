import uuid
from django.db import models
from app_users.models import User
from app_orders.models import Order
from django.core.validators import MinValueValidator



class Transaction(models.Model):
    """
    Модель для учета всех финансовых операций (долги и оплаты).
    Баланс (долг) = Сумма всех транзакций.
    Положительное число = Долг (Debet), Отрицательное = Оплата (Kredit).
    """
    
    id = models.UUIDField(primary_key=True, unique=True, verbose_name='ID')
    employee = models.ForeignKey(
        User, 
        blank=True, 
        null=True,
        on_delete=models.PROTECT, 
        related_name='transactions',
        verbose_name="Сотрудник"
    )
    order = models.ForeignKey(
        Order, 
        on_delete=models.SET_NULL,  
        null=True, 
        blank=True,
        verbose_name="Связанный заказ"
    )
    
    TYPE_CHOICES = [
        ('DEBET_ORDER', 'Начисление за заказ (Долг)'),
        ('KREDIT_PAYMENT', 'Оплата (Погашение долга)'),
        ('CORRECTION', 'Корректировка баланса'),
    ]
    type = models.CharField(
        max_length=20, 
        choices=TYPE_CHOICES,
        verbose_name="Тип операции"
    )
    
    amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0.01)],  
        verbose_name="Сумма"
    )
    
    receipt_image = models.ImageField(
        upload_to='receipts/%Y/%m/%d/', 
        null=True, 
        blank=True,
        verbose_name="Фото чека"
    )
    
    is_verified = models.BooleanField(
        default=False, 
        verbose_name="Подтверждена (ручной чек) / Проведена (О!Деньги)"
    )
    comment = models.TextField(blank=True, verbose_name="Комментарий/ID транзакции О!Деньги")

    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Транзакция"
        verbose_name_plural = "Транзакции"
        ordering = ['created_at']

    def __str__(self):
        return f"{self.get_type_display()} {self.amount} для {self.employee.username}"

    @staticmethod
    def calculate_balance(employee_id):
        """Возвращает текущий долг сотрудника."""
        debet = Transaction.objects.filter(
            employee_id=employee_id, 
            type='DEBET_ORDER'
        ).aggregate(models.Sum('amount'))['amount__sum'] or 0
        
        kredit = Transaction.objects.filter(
            employee_id=employee_id, 
            type='KREDIT_PAYMENT', 
            is_verified=True  
        ).aggregate(models.Sum('amount'))['amount__sum'] or 0
        
        return debet - kredit