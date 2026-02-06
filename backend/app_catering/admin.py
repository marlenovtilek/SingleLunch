# app_catering/admin.py (Окончательная версия)

from django.contrib import admin
from .models import DailyMenu, MenuOption
from datetime import timedelta
from django.db.models import Sum # Для подсчета статистики


from unfold.admin import TabularInline, ModelAdmin, forms
from unfold.widgets import AdminTextareaWidget


class MenuOptionInline(TabularInline):
    model = MenuOption
    extra = 0
    readonly_fields = ['id']
    fields = ['name', 'description', 'price'] 
    

 
@admin.register(DailyMenu)
class DailyMenuAdmin(ModelAdmin):
    
    list_display = ('date', 'is_active', 'selection_deadline', 'total_orders_count', 'total_revenue')
    list_filter = ('is_active',)
    readonly_fields = ['id']
    inlines = [MenuOptionInline] 

    
    fieldsets = (
        ('Основная информация о меню', {
            'fields': (
                'date',               
                'is_active',          
                ('selection_deadline',), 
            ),
            'description': 'Укажите дату обеда и крайний срок выбора.',
        }),
        ('Системная информация', {
            'fields': (
                'id',                
            ),
            'classes': ('collapse',), 
        }),
    )
    
    @admin.action(description='Дублировать выбранное меню на завтра')
    def duplicate_menu(self, request, queryset):
        for menu in queryset:
            new_date = menu.date + timedelta(days=1)
            new_deadline = menu.selection_deadline + timedelta(days=1)
            new_menu = DailyMenu.objects.create(
                date=new_date,
                selection_deadline=new_deadline, 
                is_active=True
            )
            for option in menu.options.all():
                MenuOption.objects.create(
                    daily_menu=new_menu,
                    name=option.name,
                    description=option.description,
                    price=option.price
                )
        self.message_user(request, f"Успешно дублировано {queryset.count()} меню на следующий день.")

    actions = [duplicate_menu]
    
    @admin.display(description='Всего заказов')
    def total_orders_count(self, obj):
        return obj.orders.count()
    
    @admin.display(description='Общая Выручка (PAID)')
    def total_revenue(self, obj):
        revenue = obj.orders.filter(status='PAID').aggregate(Sum('total_amount'))['total_amount__sum']
        return f"{revenue or 0} сом"