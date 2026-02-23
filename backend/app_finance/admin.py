from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(ModelAdmin):
    list_display = ("order", "amount", "created_at", "screenshot_preview")
    readonly_fields = ("order", "amount", "created_at", "screenshot_preview")
    search_fields = ("order__id", "order__employee__username")
    list_select_related = ("order", "order__employee")

    @admin.display(description="Скриншот оплаты")
    def screenshot_preview(self, obj):
        if not obj.screenshot:
            return "—"
        return format_html(
            '<a href="{0}" target="_blank" rel="noopener noreferrer">'
            '<img src="{0}" style="height:80px;width:auto;border-radius:8px;" />'
            "</a>",
            obj.screenshot.url,
        )
