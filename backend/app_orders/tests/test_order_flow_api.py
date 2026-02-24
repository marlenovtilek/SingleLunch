from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import pytest
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from PIL import Image

from app_catering.models import DailyMenu, MenuOption
from app_finance.models import Payment
from app_orders.models import Order
from app_users.models import User


def make_employee(username: str = "employee_1") -> User:
    return User.objects.create_user(
        username=username,
        password="password123",
        is_active=True,
        role="EMPLOYEE",
    )


def make_menu_with_options(deadline, date_offset_days: int = 1):
    menu = DailyMenu.objects.create(
        date=timezone.localdate() + timedelta(days=date_offset_days),
        selection_deadline=deadline,
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
    return menu, option_main, option_salad


def make_test_image_bytes() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (2, 2), color=(255, 0, 0))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_create_order_success_and_allows_multiple_orders_same_day():
    user = make_employee("employee_create")
    menu, option_main, option_salad = make_menu_with_options(
        deadline=timezone.now() + timedelta(hours=4),
    )

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "daily_menu_id": str(menu.id),
        "items": [
            {"menu_option_id": str(option_main.id), "quantity": 1},
            {"menu_option_id": str(option_salad.id), "quantity": 2},
        ],
    }
    response = client.post(reverse("order-create"), payload, format="json")
    assert response.status_code == 201

    first_order = Order.objects.filter(employee=user, daily_menu=menu).latest("created_at")
    assert first_order.status == Order.Status.AWAITING_PAYMENT
    assert first_order.total_amount == Decimal("510.00")
    assert first_order.items.count() == 2

    second_response = client.post(reverse("order-create"), payload, format="json")
    assert second_response.status_code == 201
    assert Order.objects.filter(employee=user, daily_menu=menu).count() == 2


@pytest.mark.django_db
def test_upload_payment_marks_order_paid_and_creates_payment(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    user = make_employee("employee_pay")
    menu, option_main, _ = make_menu_with_options(
        deadline=timezone.now() + timedelta(hours=2),
    )
    order = Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("340.00"),
    )
    order.items.create(menu_option=option_main, quantity=2, price_per_item=Decimal("170.00"))

    client = APIClient()
    client.force_authenticate(user=user)

    from django.core.files.uploadedfile import SimpleUploadedFile

    screenshot = SimpleUploadedFile(
        "proof.png", make_test_image_bytes(), content_type="image/png"
    )
    response = client.post(
        reverse("order-payment", kwargs={"pk": order.pk}),
        {"screenshot": screenshot},
        format="multipart",
    )
    assert response.status_code == 201

    order.refresh_from_db()
    assert order.status == Order.Status.PAID

    payment = Payment.objects.get(order=order)
    assert payment.amount == Decimal("340.00")
    assert payment.screenshot.name


@pytest.mark.django_db
def test_cancel_order_before_deadline_success():
    user = make_employee("employee_cancel_ok")
    menu, _, _ = make_menu_with_options(deadline=timezone.now() + timedelta(hours=3))
    order = Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(reverse("order-cancel", kwargs={"pk": order.pk}))
    assert response.status_code == 200

    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED


@pytest.mark.django_db
def test_cancel_order_after_deadline_marks_missed_deadline():
    user = make_employee("employee_cancel_late")
    menu, _, _ = make_menu_with_options(deadline=timezone.now() - timedelta(minutes=5))
    order = Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )

    client = APIClient()
    client.force_authenticate(user=user)

    response = client.post(reverse("order-cancel", kwargs={"pk": order.pk}))
    assert response.status_code == 400

    order.refresh_from_db()
    assert order.status == Order.Status.MISSED_DEADLINE


@pytest.mark.django_db
def test_employee_can_reorder_after_cancel_before_deadline():
    user = make_employee("employee_reorder")
    menu, option_main, option_salad = make_menu_with_options(
        deadline=timezone.now() + timedelta(hours=3),
        date_offset_days=0,
    )
    order = Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.CANCELLED,
        total_amount=Decimal("170.00"),
    )
    order.items.create(
        menu_option=option_main, quantity=1, price_per_item=Decimal("170.00")
    )

    client = APIClient()
    client.force_authenticate(user=user)

    payload = {
        "daily_menu_id": str(menu.id),
        "items": [
            {"menu_option_id": str(option_salad.id), "quantity": 2},
        ],
    }
    response = client.post(reverse("order-create"), payload, format="json")
    assert response.status_code == 201

    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert order.total_amount == Decimal("170.00")

    assert Order.objects.filter(employee=user, daily_menu=menu).count() == 2
    new_order = Order.objects.filter(employee=user, daily_menu=menu).exclude(pk=order.pk).get()
    assert new_order.status == Order.Status.AWAITING_PAYMENT
    assert new_order.total_amount == Decimal("340.00")
    assert new_order.items.count() == 1
    item = new_order.items.first()
    assert item is not None
    assert item.menu_option_id == option_salad.id
    assert item.quantity == 2


@pytest.mark.django_db
def test_mark_missed_deadline_command_updates_only_expired_orders():
    user = make_employee("employee_deadline")
    expired_menu, _, _ = make_menu_with_options(
        deadline=timezone.now() - timedelta(minutes=1),
        date_offset_days=0,
    )
    active_menu, _, _ = make_menu_with_options(
        deadline=timezone.now() + timedelta(hours=1),
        date_offset_days=2,
    )

    expired_order = Order.objects.create(
        employee=user,
        daily_menu=expired_menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )
    active_order = Order.objects.create(
        employee=make_employee("employee_deadline_2"),
        daily_menu=active_menu,
        status=Order.Status.AWAITING_PAYMENT,
        total_amount=Decimal("170.00"),
    )

    call_command("mark_missed_deadline_orders")

    expired_order.refresh_from_db()
    active_order.refresh_from_db()

    assert expired_order.status == Order.Status.MISSED_DEADLINE
    assert active_order.status == Order.Status.AWAITING_PAYMENT
