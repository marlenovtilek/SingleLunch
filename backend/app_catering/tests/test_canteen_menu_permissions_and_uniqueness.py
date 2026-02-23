from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from app_catering.models import DailyMenu
from app_users.models import User


def make_user(
    username: str,
    role: str,
    *,
    is_staff: bool = False,
    is_superuser: bool = False,
) -> User:
    return User.objects.create_user(
        username=username,
        password="password123",
        is_active=True,
        role=role,
        is_staff=is_staff,
        is_superuser=is_superuser,
    )


def build_menu_payload(menu_date, deadline_shift_hours: int):
    return {
        "date": menu_date.isoformat(),
        "selection_deadline": (
            timezone.now() + timedelta(hours=deadline_shift_hours)
        ).isoformat(),
        "is_active": True,
        "options": [
            {"name": "Плов", "price": str(Decimal("170.00"))},
            {"name": "Салат", "price": str(Decimal("170.00"))},
        ],
    }


@pytest.mark.django_db
def test_only_one_menu_per_day_and_canteen_admin_can_edit_same_menu():
    menu_date = timezone.localdate() + timedelta(days=1)
    endpoint = reverse("canteen-menu")

    canteen = make_user("canteen_menu_1", "CANTEEN")
    admin = make_user("admin_menu_1", "EMPLOYEE", is_staff=True)

    canteen_client = APIClient()
    canteen_client.force_authenticate(user=canteen)

    create_response = canteen_client.put(
        endpoint,
        build_menu_payload(menu_date, 4),
        format="json",
    )
    assert create_response.status_code == 201
    assert DailyMenu.objects.filter(date=menu_date).count() == 1

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    update_response = admin_client.put(
        endpoint,
        build_menu_payload(menu_date, 6),
        format="json",
    )
    assert update_response.status_code == 200
    assert DailyMenu.objects.filter(date=menu_date).count() == 1

    menu = DailyMenu.objects.get(date=menu_date)
    assert menu.created_by_id == admin.id


@pytest.mark.django_db
def test_employee_cannot_edit_or_create_canteen_menu():
    menu_date = timezone.localdate() + timedelta(days=1)
    employee = make_user("employee_menu_forbidden", "EMPLOYEE")

    client = APIClient()
    client.force_authenticate(user=employee)

    response = client.put(
        reverse("canteen-menu"),
        build_menu_payload(menu_date, 4),
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_menu_for_today_triggers_immediate_order_reminder(monkeypatch):
    endpoint = reverse("canteen-menu")
    canteen = make_user("canteen_menu_now", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    called = []

    def fake_call_command(*args, **kwargs):
        called.append((args, kwargs))

    monkeypatch.setattr("app_catering.api.v1.views.call_command", fake_call_command)
    monkeypatch.setattr("app_catering.api.v1.views.transaction.on_commit", lambda fn: fn())

    response = client.put(
        endpoint,
        build_menu_payload(timezone.localdate(), 4),
        format="json",
    )

    assert response.status_code == 201
    assert called == [
        (
            (
                "send_order_reminders",
                "--menu-date",
                timezone.localdate().isoformat(),
            ),
            {},
        )
    ]


@pytest.mark.django_db
def test_menu_for_future_day_does_not_trigger_immediate_reminder(monkeypatch):
    endpoint = reverse("canteen-menu")
    canteen = make_user("canteen_menu_future", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    called = []

    def fake_call_command(*args, **kwargs):
        called.append((args, kwargs))

    monkeypatch.setattr("app_catering.api.v1.views.call_command", fake_call_command)
    monkeypatch.setattr("app_catering.api.v1.views.transaction.on_commit", lambda fn: fn())

    response = client.put(
        endpoint,
        build_menu_payload(timezone.localdate() + timedelta(days=1), 24),
        format="json",
    )

    assert response.status_code == 201
    assert called == []
