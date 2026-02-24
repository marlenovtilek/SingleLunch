from datetime import datetime, time, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from app_catering.models import DailyMenu
from app_orders.models import Order
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
        "options": [
            {"name": "Плов"},
            {"name": "Салат"},
        ],
    }


def next_weekday_date(start_date, target_weekday: int):
    # Monday=0 ... Sunday=6
    current = start_date
    while current.weekday() != target_weekday:
        current += timedelta(days=1)
    return current


@pytest.mark.django_db
def test_only_one_menu_per_day_and_canteen_admin_can_edit_same_menu():
    menu_date = timezone.localdate() + timedelta(days=1)
    create_endpoint = reverse("canteen-menu")
    edit_endpoint = reverse("canteen-menu-edit")

    canteen = make_user("canteen_menu_1", "CANTEEN")
    admin = make_user("admin_menu_1", "EMPLOYEE", is_staff=True)

    canteen_client = APIClient()
    canteen_client.force_authenticate(user=canteen)

    create_response = canteen_client.put(
        create_endpoint,
        build_menu_payload(menu_date, 4),
        format="json",
    )
    assert create_response.status_code == 201
    assert DailyMenu.objects.filter(date=menu_date).count() == 1

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    duplicate_create_response = admin_client.put(
        create_endpoint,
        build_menu_payload(menu_date, 5),
        format="json",
    )
    assert duplicate_create_response.status_code == 400
    assert DailyMenu.objects.filter(date=menu_date).count() == 1

    update_response = admin_client.put(
        edit_endpoint,
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

    response = client.put(
        reverse("canteen-menu-edit"),
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


@pytest.mark.django_db
def test_canteen_menu_list_returns_created_menus_with_options_count():
    menu_date_1 = timezone.localdate() + timedelta(days=1)
    menu_date_2 = timezone.localdate() + timedelta(days=2)

    menu_1 = DailyMenu.objects.create(
        date=menu_date_1,
        selection_deadline=timezone.now() + timedelta(hours=6),
    )
    menu_1.options.create(name="Плов", price="170.00")
    menu_1.options.create(name="Суп", price="170.00")

    menu_2 = DailyMenu.objects.create(
        date=menu_date_2,
        selection_deadline=timezone.now() + timedelta(hours=30),
    )
    menu_2.options.create(name="Салат", price="170.00")

    canteen = make_user("canteen_menu_list", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    response = client.get(reverse("canteen-menu-list"))
    assert response.status_code == 200

    payload = response.json()
    by_date = {row["date"]: row for row in payload}
    assert by_date[menu_date_1.isoformat()]["options_count"] == 2
    assert by_date[menu_date_2.isoformat()]["options_count"] == 1


@pytest.mark.django_db
def test_employee_cannot_access_canteen_menu_list():
    employee = make_user("employee_menu_list_forbidden", "EMPLOYEE")
    client = APIClient()
    client.force_authenticate(user=employee)

    response = client.get(reverse("canteen-menu-list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_cannot_create_or_edit_menu_for_past_date():
    canteen = make_user("canteen_menu_past", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    past_date = timezone.localdate() - timedelta(days=1)
    response = client.put(
        reverse("canteen-menu"),
        build_menu_payload(past_date, 2),
        format="json",
    )

    assert response.status_code == 400
    assert "date" in response.json()

    DailyMenu.objects.create(
        date=past_date,
        selection_deadline=timezone.now() - timedelta(days=2),
    )

    response = client.put(
        reverse("canteen-menu-edit"),
        build_menu_payload(past_date, 2),
        format="json",
    )
    assert response.status_code == 400
    assert "date" in response.json()


@pytest.mark.django_db
def test_can_delete_menu_if_no_orders():
    canteen = make_user("canteen_delete_menu_ok", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    menu_date = timezone.localdate() + timedelta(days=1)
    DailyMenu.objects.create(
        date=menu_date,
        selection_deadline=timezone.now() + timedelta(hours=5),
        created_by=canteen,
    )

    response = client.delete(f"{reverse('canteen-menu-edit')}?date={menu_date.isoformat()}")
    assert response.status_code == 204
    assert not DailyMenu.objects.filter(date=menu_date).exists()


@pytest.mark.django_db
def test_cannot_delete_menu_if_orders_exist():
    canteen = make_user("canteen_delete_menu_blocked", "CANTEEN")
    employee = make_user("employee_delete_menu_blocked", "EMPLOYEE")
    client = APIClient()
    client.force_authenticate(user=canteen)

    menu_date = timezone.localdate() + timedelta(days=1)
    menu = DailyMenu.objects.create(
        date=menu_date,
        selection_deadline=timezone.now() + timedelta(hours=5),
        created_by=canteen,
    )
    Order.objects.create(
        employee=employee,
        daily_menu=menu,
        total_amount="170.00",
        status=Order.Status.AWAITING_PAYMENT,
    )

    response = client.delete(f"{reverse('canteen-menu-edit')}?date={menu_date.isoformat()}")
    assert response.status_code == 400
    assert "date" in response.json()
    assert DailyMenu.objects.filter(date=menu_date).exists()


@pytest.mark.django_db
def test_cannot_create_menu_with_past_selection_deadline():
    canteen = make_user("canteen_menu_past_deadline", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    menu_date = timezone.localdate() + timedelta(days=1)
    payload = build_menu_payload(menu_date, 4)
    payload["selection_deadline"] = (timezone.now() - timedelta(minutes=5)).isoformat()

    response = client.put(
        reverse("canteen-menu"),
        payload,
        format="json",
    )

    assert response.status_code == 400
    assert "selection_deadline" in response.json()


@pytest.mark.django_db
def test_cannot_create_menu_for_weekend_date():
    canteen = make_user("canteen_menu_weekend_date", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    saturday = next_weekday_date(timezone.localdate(), 5)
    payload = build_menu_payload(saturday, 24)
    payload["selection_deadline"] = (
        timezone.now() + timedelta(days=1)
    ).isoformat()

    response = client.put(
        reverse("canteen-menu"),
        payload,
        format="json",
    )

    assert response.status_code == 400
    assert "date" in response.json()


@pytest.mark.django_db
def test_cannot_create_menu_with_weekend_deadline():
    canteen = make_user("canteen_menu_weekend_deadline", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    today = timezone.localdate()
    monday = next_weekday_date(today, 0)
    if monday <= today:
        monday += timedelta(days=7)

    saturday = next_weekday_date(today, 5)
    weekend_deadline = timezone.make_aware(datetime.combine(saturday, time(hour=12)))

    payload = build_menu_payload(monday, 24)
    payload["selection_deadline"] = weekend_deadline.isoformat()

    response = client.put(
        reverse("canteen-menu"),
        payload,
        format="json",
    )

    assert response.status_code == 400
    assert "selection_deadline" in response.json()
