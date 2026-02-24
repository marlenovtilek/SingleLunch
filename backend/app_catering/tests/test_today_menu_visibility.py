from datetime import datetime, time, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from app_catering.models import DailyMenu, MenuOption
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


def create_menu(menu_date, name: str) -> DailyMenu:
    menu = DailyMenu.objects.create(
        date=menu_date,
        selection_deadline=timezone.now() + timedelta(days=1),
    )
    MenuOption.objects.create(daily_menu=menu, name=name, price="170.00")
    return menu


def bishkek_datetime(target_date, hour: int, minute: int = 0):
    return timezone.make_aware(
        datetime.combine(target_date, time(hour, minute)),
        timezone.get_current_timezone(),
    )


@pytest.mark.django_db
def test_employee_sees_tomorrow_menu_after_switch_hour(monkeypatch, settings):
    settings.MENU_NEXT_DAY_SWITCH_HOUR = 15
    settings.MENU_NEXT_DAY_SWITCH_MINUTE = 0

    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)

    create_menu(today, "Сегодняшнее меню")
    create_menu(tomorrow, "Завтрашнее меню")

    employee = make_user("employee_menu_switch", "EMPLOYEE")
    client = APIClient()
    client.force_authenticate(user=employee)

    monkeypatch.setattr(
        "app_catering.api.v1.views.timezone.localtime",
        lambda *_args, **_kwargs: bishkek_datetime(today, 16, 0),
    )

    response = client.get(reverse("menu-today"))
    assert response.status_code == 200
    assert response.data["date"] == tomorrow.isoformat()


@pytest.mark.django_db
def test_employee_sees_today_menu_before_switch_hour(monkeypatch, settings):
    settings.MENU_NEXT_DAY_SWITCH_HOUR = 15
    settings.MENU_NEXT_DAY_SWITCH_MINUTE = 0

    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)

    create_menu(today, "Сегодняшнее меню")
    create_menu(tomorrow, "Завтрашнее меню")

    employee = make_user("employee_menu_before_switch", "EMPLOYEE")
    client = APIClient()
    client.force_authenticate(user=employee)

    monkeypatch.setattr(
        "app_catering.api.v1.views.timezone.localtime",
        lambda *_args, **_kwargs: bishkek_datetime(today, 14, 30),
    )

    response = client.get(reverse("menu-today"))
    assert response.status_code == 200
    assert response.data["date"] == today.isoformat()


@pytest.mark.django_db
def test_canteen_still_sees_today_menu_after_switch_hour(monkeypatch, settings):
    settings.MENU_NEXT_DAY_SWITCH_HOUR = 15
    settings.MENU_NEXT_DAY_SWITCH_MINUTE = 0

    today = timezone.localdate()
    tomorrow = today + timedelta(days=1)

    create_menu(today, "Сегодняшнее меню")
    create_menu(tomorrow, "Завтрашнее меню")

    canteen = make_user("canteen_menu_today", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen)

    monkeypatch.setattr(
        "app_catering.api.v1.views.timezone.localtime",
        lambda *_args, **_kwargs: bishkek_datetime(today, 16, 0),
    )

    response = client.get(reverse("menu-today"))
    assert response.status_code == 200
    assert response.data["date"] == today.isoformat()
