from datetime import timedelta
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from app_catering.models import DailyMenu
from app_users.models import User


def make_test_image_bytes() -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", (4, 4), color=(0, 180, 180))
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_canteen_can_upload_payment_qr(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path

    canteen = User.objects.create_user(
        username="canteen_qr",
        password="password123",
        is_active=True,
        role="CANTEEN",
    )
    menu = DailyMenu.objects.create(
        date=timezone.localdate(),
        selection_deadline=timezone.now() + timedelta(hours=2),
        created_by=canteen,
    )

    client = APIClient()
    client.force_authenticate(user=canteen)

    qr_file = SimpleUploadedFile(
        "payment_qr.png", make_test_image_bytes(), content_type="image/png"
    )
    response = client.post(
        reverse("canteen-menu-payment-qr"),
        {"date": str(menu.date), "payment_qr": qr_file},
        format="multipart",
    )

    assert response.status_code == 200
    menu.refresh_from_db()
    assert bool(menu.payment_qr)
    assert response.data["payment_qr_url"]


@pytest.mark.django_db
def test_employee_cannot_upload_payment_qr():
    employee = User.objects.create_user(
        username="employee_qr",
        password="password123",
        is_active=True,
        role="EMPLOYEE",
    )
    DailyMenu.objects.create(
        date=timezone.localdate(),
        selection_deadline=timezone.now() + timedelta(hours=2),
        created_by=employee,
    )

    client = APIClient()
    client.force_authenticate(user=employee)

    qr_file = SimpleUploadedFile(
        "payment_qr.png", make_test_image_bytes(), content_type="image/png"
    )
    response = client.post(
        reverse("canteen-menu-payment-qr"),
        {"date": str(timezone.localdate()), "payment_qr": qr_file},
        format="multipart",
    )
    assert response.status_code == 403
