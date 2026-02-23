from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import TabularInline, ModelAdmin

from .models import NotificationLog, Order, OrderItem


class OrderItemInline(TabularInline):
    model = OrderItem
    readonly_fields = ("menu_option", "quantity", "price_per_item", "total_price_display")
    fields = ("menu_option", "quantity", "price_per_item", "total_price_display")
    extra = 0
    can_delete = False
    max_num = 0

    @admin.display(description="Итого")
    def total_price_display(self, obj):
        return f"{obj.total_price} сом"


@admin.register(Order)
class OrderAdmin(ModelAdmin):
    list_display = (
        "employee",
        "daily_menu",
        "status",
        "total_amount",
        "created_at",
        "is_fully_paid_display",
    )
    list_filter = ("status", "daily_menu__date", "employee", "created_at")
    search_fields = ("employee__username", "employee__first_name", "employee__last_name")
    list_select_related = ("employee", "daily_menu")

    inlines = [OrderItemInline]

    fieldsets = (
        (None, {"fields": ("employee", "daily_menu", "status")}),
        ("Сумма и Дата", {"fields": ("total_amount", "created_at")}),
        ("Сводка (только просмотр)", {"fields": ("get_items_summary",)}),
    )

    def get_readonly_fields(self, request, obj=None):
        if obj:
            return ("employee", "total_amount", "created_at", "get_items_summary")
        return ("total_amount", "created_at", "get_items_summary")

    @admin.action(description="Отметить выбранные заказы как Оплаченные")
    def mark_as_paid(self, request, queryset):
        updated = queryset.filter(status=Order.Status.AWAITING_PAYMENT).update(
            status=Order.Status.PAID
        )
        self.message_user(request, f"Успешно отмечено {updated} заказов как оплаченные.")

    actions = [mark_as_paid]

    @admin.display(description="Оплачен", boolean=True)
    def is_fully_paid_display(self, obj):
        return obj.status == Order.Status.PAID

    @admin.display(description="Сводка позиций")
    def get_items_summary(self, obj):
        if not obj:
            return "—"

        rows = [
            f"{item.menu_option.name} x {item.quantity} ({item.total_price} сом)"
            for item in obj.items.all()
        ]
        if not rows:
            return "Нет позиций"
        return format_html("<br>".join(rows))


@admin.register(NotificationLog)
class NotificationLogAdmin(ModelAdmin):
    list_display = (
        "user",
        "menu_date",
        "notification_type",
        "channel",
        "status",
        "created_at",
    )
    list_filter = ("notification_type", "channel", "status", "menu_date")
    search_fields = ("user__username", "error_message")
    list_select_related = ("user",)
    readonly_fields = (
        "user",
        "menu_date",
        "notification_type",
        "channel",
        "status",
        "error_message",
        "created_at",
    )
