from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from app_catering.models import DailyMenu, MenuOption
from app_orders.models import NotificationLog, Order
from app_users.services.notifications import DeliveryResult

User = get_user_model()


@pytest.mark.django_db
def test_send_order_reminders_creates_logs_and_skips_duplicates(monkeypatch):
    menu = DailyMenu.objects.create(
        date=timezone.localdate() + timedelta(days=1),
        is_active=True,
        selection_deadline=timezone.now() + timedelta(days=1),
    )
    user = User.objects.create_user(
        username="employee_1",
        password="password123",
        is_active=True,
        role="EMPLOYEE",
        telegram_id="11111",
        mattermost_id="mm-11111",
    )
    MenuOption.objects.create(daily_menu=menu, name="Плов", price="170.00")
    MenuOption.objects.create(daily_menu=menu, name="Суп", price="170.00")

    telegram_calls = {"count": 0}
    mattermost_calls = {"count": 0}
    telegram_messages: list[str] = []

    def fake_telegram(_chat_id, message):
        telegram_calls["count"] += 1
        telegram_messages.append(message)
        return DeliveryResult(True, "telegram", "ok")

    def fake_mattermost(*args, **kwargs):
        mattermost_calls["count"] += 1
        return DeliveryResult(True, "mattermost", "ok")

    monkeypatch.setattr(
        "app_orders.management.commands.send_order_reminders.send_telegram_message",
        fake_telegram,
    )
    monkeypatch.setattr(
        "app_orders.management.commands.send_order_reminders.send_mattermost_dm",
        fake_mattermost,
    )
    monkeypatch.setenv("FRONTEND_BASE_URL", "https://singlelunch.example.com")

    call_command("send_order_reminders", "--menu-date", str(menu.date))

    assert telegram_calls["count"] == 1
    assert mattermost_calls["count"] == 1
    assert NotificationLog.objects.filter(
        user=user,
        menu_date=menu.date,
        status=NotificationLog.Status.SENT,
    ).count() == 2
    assert any(
        "https://singlelunch.example.com/menu-today" in message
        for message in telegram_messages
    )
    assert any("Меню:" in message for message in telegram_messages)
    assert any(". Плов" in message for message in telegram_messages)
    assert any(". Суп" in message for message in telegram_messages)

    call_command("send_order_reminders", "--menu-date", str(menu.date))

    assert telegram_calls["count"] == 1
    assert mattermost_calls["count"] == 1
    assert NotificationLog.objects.filter(user=user, menu_date=menu.date).count() == 2

    call_command(
        "send_order_reminders",
        "--menu-date",
        str(menu.date),
        "--force-resend",
    )

    assert telegram_calls["count"] == 2
    assert mattermost_calls["count"] == 2
    assert NotificationLog.objects.filter(user=user, menu_date=menu.date).count() == 2


@pytest.mark.django_db
def test_send_order_reminders_ignores_users_with_order(monkeypatch):
    menu = DailyMenu.objects.create(
        date=timezone.localdate() + timedelta(days=1),
        is_active=True,
        selection_deadline=timezone.now() + timedelta(days=1),
    )
    user = User.objects.create_user(
        username="employee_2",
        password="password123",
        is_active=True,
        role="EMPLOYEE",
        telegram_id="22222",
    )
    Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=0,
    )

    telegram_calls = {"count": 0}

    def fake_telegram(*args, **kwargs):
        telegram_calls["count"] += 1
        return DeliveryResult(True, "telegram", "ok")

    monkeypatch.setattr(
        "app_orders.management.commands.send_order_reminders.send_telegram_message",
        fake_telegram,
    )

    call_command("send_order_reminders", "--menu-date", str(menu.date))

    assert telegram_calls["count"] == 0
    assert NotificationLog.objects.count() == 0
