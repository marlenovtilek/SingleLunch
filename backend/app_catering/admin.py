from datetime import timedelta

from django.contrib import admin
from django.db.models import Sum
from unfold.admin import ModelAdmin, TabularInline

from .models import DailyMenu, DutyAssignment, MenuOption


class MenuOptionInline(TabularInline):
    model = MenuOption
    extra = 0
    readonly_fields = ("id",)
    fields = ("name", "price")


@admin.register(DailyMenu)
class DailyMenuAdmin(ModelAdmin):
    list_display = (
        "date",
        "selection_deadline",
        "created_by",
        "total_orders_count",
        "total_revenue",
    )
    list_filter = ("date",)
    search_fields = ("date", "created_by__username")
    readonly_fields = ("id",)
    inlines = [MenuOptionInline]

    fieldsets = (
        (
            "Основная информация о меню",
            {
                "fields": (
                    "date",
                    ("selection_deadline", "created_by"),
                    "payment_qr",
                ),
                "description": "Укажите дату обеда и крайний срок выбора.",
            },
        ),
        (
            "Системная информация",
            {
                "fields": ("id",),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.action(description="Дублировать выбранное меню на завтра")
    def duplicate_menu(self, request, queryset):
        created_count = 0
        skipped_count = 0

        for menu in queryset:
            new_date = menu.date + timedelta(days=1)
            if DailyMenu.objects.filter(date=new_date).exists():
                skipped_count += 1
                continue

            new_deadline = menu.selection_deadline + timedelta(days=1)
            new_menu = DailyMenu.objects.create(
                date=new_date,
                selection_deadline=new_deadline,
                created_by=request.user,
            )
            for option in menu.options.all():
                MenuOption.objects.create(
                    daily_menu=new_menu,
                    name=option.name,
                    price=option.price,
                )
            created_count += 1

        self.message_user(
            request,
            f"Создано меню: {created_count}. Пропущено (дата уже существует): {skipped_count}.",
        )

    actions = [duplicate_menu]

    @admin.display(description="Всего заказов")
    def total_orders_count(self, obj):
        return obj.orders.count()

    @admin.display(description="Общая Выручка (PAID)")
    def total_revenue(self, obj):
        revenue = obj.orders.filter(status="PAID").aggregate(Sum("total_amount"))[
            "total_amount__sum"
        ]
        return f"{revenue or 0} сом"


@admin.register(DutyAssignment)
class DutyAssignmentAdmin(ModelAdmin):
    list_display = ("date", "assignee", "created_by", "created_at")
    list_filter = ("date", "assignee")
    search_fields = ("assignee__username", "assignee__first_name", "assignee__last_name")
    readonly_fields = ("id", "created_at", "updated_at")
