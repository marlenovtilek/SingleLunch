from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from app_catering.models import DutyAssignment
from app_orders.models import NotificationLog
from app_users.services.notifications import DeliveryResult

User = get_user_model()


@pytest.mark.django_db
def test_send_duty_reminders_creates_logs_and_skips_duplicates(monkeypatch):
    duty_date = timezone.localdate() + timedelta(days=1)
    user = User.objects.create_user(
        username="duty_canteen_1",
        password="password123",
        is_active=True,
        role="CANTEEN",
        telegram_id="duty_tg_1",
        mattermost_id="duty_mm_1",
    )
    DutyAssignment.objects.create(date=duty_date, assignee=user)

    telegram_calls = {"count": 0}
    mattermost_calls = {"count": 0}

    def fake_telegram(*args, **kwargs):
        telegram_calls["count"] += 1
        return DeliveryResult(True, "telegram", "ok")

    def fake_mattermost(*args, **kwargs):
        mattermost_calls["count"] += 1
        return DeliveryResult(True, "mattermost", "ok")

    monkeypatch.setattr(
        "app_catering.management.commands.send_duty_reminders.send_telegram_message",
        fake_telegram,
    )
    monkeypatch.setattr(
        "app_catering.management.commands.send_duty_reminders.send_mattermost_dm",
        fake_mattermost,
    )

    call_command("send_duty_reminders", "--date", str(duty_date))

    assert telegram_calls["count"] == 1
    assert mattermost_calls["count"] == 1
    assert NotificationLog.objects.filter(
        user=user,
        menu_date=duty_date,
        notification_type=NotificationLog.Type.DUTY_REMINDER,
        status=NotificationLog.Status.SENT,
    ).count() == 2

    call_command("send_duty_reminders", "--date", str(duty_date))

    assert telegram_calls["count"] == 1
    assert mattermost_calls["count"] == 1
    assert NotificationLog.objects.filter(
        user=user,
        menu_date=duty_date,
        notification_type=NotificationLog.Type.DUTY_REMINDER,
    ).count() == 2


@pytest.mark.django_db
def test_send_duty_reminders_without_assignment_does_not_create_logs(monkeypatch):
    duty_date = timezone.localdate() + timedelta(days=1)
    telegram_calls = {"count": 0}

    def fake_telegram(*args, **kwargs):
        telegram_calls["count"] += 1
        return DeliveryResult(True, "telegram", "ok")

    monkeypatch.setattr(
        "app_catering.management.commands.send_duty_reminders.send_telegram_message",
        fake_telegram,
    )

    call_command("send_duty_reminders", "--date", str(duty_date))

    assert telegram_calls["count"] == 0
    assert NotificationLog.objects.filter(
        notification_type=NotificationLog.Type.DUTY_REMINDER
    ).count() == 0
