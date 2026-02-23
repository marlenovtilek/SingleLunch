from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from app_catering.models import DailyMenu, MenuOption
from app_finance.models import Payment
from app_orders.models import Order
from app_users.models import User


def make_user(username: str, role: str) -> User:
    return User.objects.create_user(
        username=username,
        password="password123",
        is_active=True,
        role=role,
    )


@pytest.mark.django_db
def test_canteen_orders_dashboard_returns_summary():
    menu_date = timezone.localdate() + timedelta(days=1)
    menu = DailyMenu.objects.create(
        date=menu_date,
        is_active=True,
        selection_deadline=timezone.now() + timedelta(hours=4),
    )
    option_main = MenuOption.objects.create(
        daily_menu=menu,
        name="Плов",
        price=Decimal("170.00"),
    )
    option_salad = MenuOption.objects.create(
        daily_menu=menu,
        name="Салат",
        price=Decimal("170.00"),
    )

    employee_1 = make_user("employee_canteen_1", "EMPLOYEE")
    employee_2 = make_user("employee_canteen_2", "EMPLOYEE")
    employee_3 = make_user("employee_canteen_3", "EMPLOYEE")

    paid_order_1 = Order.objects.create(
        employee=employee_1,
        daily_menu=menu,
        status=Order.Status.PAID,
        total_amount=Decimal("340.00"),
    )
    paid_order_1.items.create(
        menu_option=option_main,
        quantity=2,
        price_per_item=Decimal("170.00"),
    )

    paid_order_2 = Order.objects.create(
        employee=employee_2,
        daily_menu=menu,
        status=Order.Status.PAID,
        total_amount=Decimal("170.00"),
    )
    paid_order_2.items.create(
        menu_option=option_salad,
        quantity=1,
        price_per_item=Decimal("170.00"),
    )
    Payment.objects.create(
        order=paid_order_2,
        amount=Decimal("170.00"),
        screenshot="payments/proof.png",
    )

    awaiting_order = Order.objects.create(
        employee=employee_3,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )
    awaiting_order.items.create(
        menu_option=option_main,
        quantity=1,
        price_per_item=Decimal("170.00"),
    )

    canteen_user = make_user("canteen_1", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen_user)

    response = client.get(f"{reverse('canteen-orders')}?date={menu_date.isoformat()}")
    assert response.status_code == 200

    data = response.json()
    assert data["orders_count"] == 3
    assert data["paid_count"] == 2
    assert data["awaiting_payment_count"] == 1
    assert data["cancelled_count"] == 0
    assert data["missed_deadline_count"] == 0
    assert Decimal(data["total_paid_amount"]) == Decimal("510.00")

    totals = {item["name"]: item["total_quantity"] for item in data["confirmed_item_totals"]}
    assert totals["Плов"] == 2
    assert totals["Салат"] == 1

    order_by_user = {item["employee_username"]: item for item in data["orders"]}
    assert order_by_user["employee_canteen_2"]["payment_screenshot_url"] == "/media/payments/proof.png"
    assert order_by_user["employee_canteen_1"]["payment_screenshot_url"] is None


@pytest.mark.django_db
def test_canteen_orders_dashboard_forbidden_for_employee():
    employee = make_user("employee_forbidden", "EMPLOYEE")
    client = APIClient()
    client.force_authenticate(user=employee)

    response = client.get(reverse("canteen-orders"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_canteen_menu_update_rejects_option_change_if_orders_exist():
    menu_date = timezone.localdate()
    menu = DailyMenu.objects.create(
        date=menu_date,
        is_active=True,
        selection_deadline=timezone.now() + timedelta(hours=2),
    )
    option = MenuOption.objects.create(
        daily_menu=menu,
        name="Плов",
        price=Decimal("170.00"),
    )

    employee = make_user("employee_with_order", "EMPLOYEE")
    order = Order.objects.create(
        employee=employee,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )
    order.items.create(
        menu_option=option,
        quantity=1,
        price_per_item=Decimal("170.00"),
    )

    canteen_user = make_user("canteen_update", "CANTEEN")
    client = APIClient()
    client.force_authenticate(user=canteen_user)

    payload = {
        "date": menu_date.isoformat(),
        "selection_deadline": (timezone.now() + timedelta(hours=4)).isoformat(),
        "is_active": True,
        "options": [
            {
                "name": "Лагман",
                "price": "170.00",
            }
        ],
    }

    response = client.put(reverse("canteen-menu"), payload, format="json")
    assert response.status_code == 400
    assert "options" in response.json()
    assert menu.options.count() == 1
    assert menu.options.first().name == "Плов"
