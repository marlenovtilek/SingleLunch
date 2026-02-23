import uuid
from django.db import models
from app_orders.models import Order



class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, verbose_name='Payment ID')
    order = models.OneToOneField(Order, on_delete=models.PROTECT, verbose_name="Принадлежит заказу")
    screenshot = models.ImageField(upload_to='payments/', verbose_name="Скриншот оплаты")
    amount = models.DecimalField(max_digits=8, decimal_places=2, verbose_name="Сумма оплаты")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Оплата"
        verbose_name_plural = "Оплаты"
    
    def __str__(self):
        return f"Оплата #{self.id}"
    
