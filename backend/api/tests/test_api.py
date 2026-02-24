import pytest
from django.urls import reverse
from rest_framework import status

from app_users.models import BrandingSettings, User


@pytest.mark.django_db
def test_token_obtain_returns_invalid_username_code(client):
    response = client.post(
        reverse("token_obtain_pair"),
        {"username": "missing_user", "password": "password123"},
        content_type="application/json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json().get("code") == "invalid_username"


@pytest.mark.django_db
def test_token_obtain_returns_invalid_password_code(client):
    User.objects.create_user(
        username="token-check-user",
        password="correct-password",
        is_active=True,
        role="EMPLOYEE",
    )

    response = client.post(
        reverse("token_obtain_pair"),
        {"username": "token-check-user", "password": "wrong-password"},
        content_type="application/json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json().get("code") == "invalid_password"


@pytest.mark.django_db
def test_api_users_me_unauthorized(client):
    response = client.get(reverse("api-users-me"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_api_users_me_authorized(api_client, regular_user):
    api_client.force_authenticate(user=regular_user)
    response = api_client.get(reverse("api-users-me"))
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_branding_is_public(api_client):
    response = api_client.get(reverse("api-branding"))
    assert response.status_code == status.HTTP_200_OK
    assert response.data["project_name"] == "SingleLunch"
    assert response.data["logo_url"] == "/brand/singlelunch-logo.svg"
    assert response.data["lunch_price"] == "170.00"


@pytest.mark.django_db
def test_branding_payment_qr_endpoint_requires_authentication(api_client):
    response = api_client.post(
        reverse("api-branding-payment-qr"),
        {"lunch_price": "180.00"},
        format="multipart",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_canteen_can_update_lunch_price_without_qr_upload(api_client):
    canteen_user = User.objects.create_user(
        username="canteen-price-editor",
        password="password123",
        is_active=True,
        role="CANTEEN",
    )
    api_client.force_authenticate(user=canteen_user)

    response = api_client.post(
        reverse("api-branding-payment-qr"),
        {"lunch_price": "185.50"},
        format="multipart",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["lunch_price"] == "185.50"

    branding = BrandingSettings.get_solo()
    assert str(branding.lunch_price) == "185.50"
