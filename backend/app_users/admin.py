# app_users/admin.py

from django.contrib import admin 
from .models import User
from app_finance.models import Transaction  

from unfold.admin import ModelAdmin


@admin.register(User)
class EmployeeAdmin(ModelAdmin):
    """
    Кастомная админка для модели Employee, основанная на стандартной UserAdmin.
    """
    
    list_display = (
        'username', 
        'email', 
        'first_name', 
        'last_name', 
        'role', 
        'is_active', 
        'current_debt_display'  
    )
    
    list_filter = ('role', 'is_active', 'is_staff')
    
    search_fields = ('username', 'first_name', 'last_name', 'email', 'telegram_id')

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Персональная информация', {'fields': ('first_name', 'last_name', 'email', 'role')}),
        ('Идентификаторы мессенджеров', {'fields': ('telegram_id', 'mattermost_id')}),
        ('Права', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Важные даты', {'fields': ('last_login', 'date_joined')}),
    )

    @admin.display(description='Текущий Долг', ordering='-current_debt')
    def current_debt_display(self, obj):
        debt = Transaction.calculate_balance(obj.id)
        if debt > 0:
            return admin.format_html('<span style="color: red; font-weight: bold;">{} сум</span>', debt)
        return f"{debt} сум"
    
