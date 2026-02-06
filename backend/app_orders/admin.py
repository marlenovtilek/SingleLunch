from django.contrib import admin
from django.utils.html import format_html
from .models import Order, OrderItem
from unfold.admin import TabularInline, ModelAdmin



class OrderItemInline(TabularInline):
    model = OrderItem
    
    readonly_fields = ('menu_option', 'quantity', 'price_per_item', 'total_price_display') 
    
    # Поля, которые будут отображаться
    fields = ('menu_option', 'quantity', 'price_per_item', 'total_price_display')
    
    can_delete = False
    max_num = 0 # Нельзя создавать/удалять через админку, только просмотр
    
    # Обертка для total_price property. 
    # Это необходимо, чтобы Django Admin корректно отобразил @property из модели.
    @admin.display(description='Итого')
    def total_price_display(self, obj):
        return f"{obj.total_price} сум"

@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = (
        'employee', 
        'daily_menu', 
        'status', 
        'total_amount', 
        'created_at',
        'is_fully_paid_display'
    )
    list_filter = ('status', 'daily_menu__date', 'employee')
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name')
    
    inlines = [OrderItemInline]

    fieldsets = (
        (None, {'fields': ('employee', 'daily_menu', 'status')}),
        ('Сумма и Дата', {'fields': ('total_amount', 'created_at')}),
        ('Сводка (только просмотр)', {'fields': ('get_items_summary',)}),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  
            return ('employee', 'total_amount', 'created_at', 'get_items_summary')
        else:  
            return ('total_amount', 'created_at', 'get_items_summary')
    
    @admin.action(description='Отметить выбранные заказы как Оплаченные')
    def mark_as_paid(self, request, queryset):
        updated = queryset.filter(status='AWAITING_PAYMENT').update(status='PAID')
        self.message_user(request, f"Успешно отмечено {updated} заказов как оплаченные.")
    
    actions = [mark_as_paid]

    @admin.display(description='Оплачен', boolean=True)
    def is_fully_paid_display(self, obj):
        return obj.status == 'PAID'
    
    @admin.display(description='Сводка позиций')
    def get_items_summary(self, obj):
        summary = ""
        for item in obj.items.all():
            summary += f"{item.menu_option.name} x {item.quantity} ({item.total_price} сом)<br>"
        return format_html(summary)