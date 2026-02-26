from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone

from app_catering.models import DailyMenu
from app_finance.models import Payment
from app_orders.models import Order


def create_payment(*, username: str, days_old: int, menu_days_offset: int) -> Payment:
    user = get_user_model().objects.create_user(
        username=username,
        password="test-pass-123",
        role="EMPLOYEE",
    )
    menu = DailyMenu.objects.create(
        date=timezone.localdate() + timedelta(days=menu_days_offset),
        selection_deadline=timezone.now() + timedelta(hours=2),
        created_by=user,
    )
    order = Order.objects.create(
        employee=user,
        daily_menu=menu,
        status=Order.Status.PAID,
        total_amount=Decimal("170.00"),
    )

    screenshot = SimpleUploadedFile(
        f"{username}.png",
        b"fake-image-content",
        content_type="image/png",
    )
    payment = Payment.objects.create(
        order=order,
        screenshot=screenshot,
        amount=Decimal("170.00"),
    )
    Payment.objects.filter(pk=payment.pk).update(
        created_at=timezone.now() - timedelta(days=days_old)
    )
    payment.refresh_from_db()
    return payment


@pytest.mark.django_db
def test_cleanup_payment_screenshots_clears_old_files(settings, tmp_path):
    media_root = tmp_path / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    settings.MEDIA_ROOT = media_root

    old_payment = create_payment(
        username="payment_old",
        days_old=10,
        menu_days_offset=1,
    )
    new_payment = create_payment(
        username="payment_new",
        days_old=2,
        menu_days_offset=2,
    )

    old_path = media_root / old_payment.screenshot.name
    new_path = media_root / new_payment.screenshot.name

    assert old_path.exists()
    assert new_path.exists()

    call_command("cleanup_payment_screenshots", "--days", "7")

    old_payment.refresh_from_db()
    new_payment.refresh_from_db()

    assert not old_payment.screenshot
    assert new_payment.screenshot
    assert not old_path.exists()
    assert new_path.exists()


@pytest.mark.django_db
def test_cleanup_payment_screenshots_dry_run_does_not_modify(settings, tmp_path):
    media_root = tmp_path / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    settings.MEDIA_ROOT = media_root

    payment = create_payment(
        username="payment_dry_run",
        days_old=10,
        menu_days_offset=1,
    )
    screenshot_path = media_root / payment.screenshot.name
    assert screenshot_path.exists()

    call_command("cleanup_payment_screenshots", "--days", "7", "--dry-run")
    payment.refresh_from_db()

    assert payment.screenshot
    assert screenshot_path.exists()
