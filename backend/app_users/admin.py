from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.html import format_html
from unfold.admin import ModelAdmin

from .models import BrandingSettings, Department, User


@admin.register(User)
class UserAdmin(ModelAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "birth_date",
        "phone_number",
        "department",
        "role",
        "is_active",
        "is_staff",
    )
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = (
        "username",
        "first_name",
        "last_name",
        "email",
        "phone_number",
        "telegram_id",
    )
    ordering = ("-date_joined",)

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            "Персональная информация",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                    "birth_date",
                    "phone_number",
                    "department",
                    "role",
                )
            },
        ),
        (
            "Идентификаторы мессенджеров",
            {"fields": ("telegram_id", "mattermost_id")},
        ),
        (
            "Права",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Важные даты",
            {"fields": ("last_login", "date_joined", "created_at", "modified_at")},
        ),
    )
    readonly_fields = ("created_at", "modified_at")


@admin.register(Department)
class DepartmentAdmin(ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "modified_at")


@admin.register(BrandingSettings)
class BrandingSettingsAdmin(ModelAdmin):
    list_display = ("project_name", "logo_preview", "payment_qr_preview", "modified_at")
    fields = (
        "project_name",
        "logo",
        "logo_preview",
        "payment_qr",
        "payment_qr_preview",
        "created_at",
        "modified_at",
    )
    readonly_fields = ("logo_preview", "payment_qr_preview", "created_at", "modified_at")

    def changelist_view(self, request, extra_context=None):
        obj = BrandingSettings.get_solo()
        url = reverse("admin:app_users_brandingsettings_change", args=[obj.pk])
        return redirect(url)

    def has_add_permission(self, request):
        return not BrandingSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="Логотип")
    def logo_preview(self, obj):
        if not obj.logo:
            return "—"
        return format_html(
            '<img src="{}" alt="logo" style="height:44px;width:44px;'
            'object-fit:contain;border-radius:8px;border:1px solid #cbd5e1;" />',
            obj.logo.url,
        )

    @admin.display(description="QR оплаты")
    def payment_qr_preview(self, obj):
        if not obj.payment_qr:
            return "—"
        return format_html(
            '<img src="{}" alt="payment-qr" style="height:80px;width:80px;'
            'object-fit:contain;border-radius:8px;border:1px solid #cbd5e1;background:#fff;" />',
            obj.payment_qr.url,
        )
