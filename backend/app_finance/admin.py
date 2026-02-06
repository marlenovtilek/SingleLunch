
from django.contrib import admin
from .models import Transaction
from admin_thumbnails import thumbnail  
from unfold.admin import ModelAdmin

@admin.register(Transaction)
class TransactionAdmin(ModelAdmin):
    
    receipt_thumbnail = thumbnail('receipt_image', 'Чек') 
    
    list_display = (
        'employee', 
        'type', 
        'amount', 
        'is_verified', 
        'order_link', 
        'created_at',
        'receipt_thumbnail',  
    )
    
    list_filter = ('type', 'is_verified', 'created_at')
    search_fields = ('employee__username', 'comment')
    
    fieldsets = (
        (None, {'fields': ('employee', 'type', 'amount', 'is_verified', 'comment')}),
        ('Связи и Документы', {'fields': ('order', 'receipt_image', 'receipt_thumbnail')}),
    )
    
    readonly_fields = ('employee', 'order', 'amount', 'type', 'created_at', 'receipt_thumbnail') 
    
    @admin.action(description='Подтвердить выбранные чеки (оплаты)')
    def verify_transactions(self, request, queryset):
        updated = queryset.filter(type='KREDIT_PAYMENT', is_verified=False).update(is_verified=True)
        self.message_user(request, f"Успешно подтверждено {updated} оплат. Долг сотрудников уменьшился.")

    actions = [verify_transactions]
    
    @admin.display(description='Заказ')
    def order_link(self, obj):
        if obj.order:
            from django.urls import reverse
            url = reverse("admin:orders_order_change", args=[obj.order.id])
            return admin.format_html('<a href="{}">Заказ №{}</a>', url, obj.order.id)
        return "-"