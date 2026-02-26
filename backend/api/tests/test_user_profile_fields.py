import pytest
from django.urls import reverse
from rest_framework import status

from app_users.models import Department, User


@pytest.mark.django_db
def test_departments_list_is_public(api_client):
    response = api_client.get(reverse("api-departments-list"))
    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] >= 7


@pytest.mark.django_db
def test_user_register_with_profile_fields(api_client):
    department = Department.objects.first()
    assert department is not None

    response = api_client.post(
        reverse("api-users-list"),
        {
            "username": "employee_register_new",
            "password": "StrongPassword123!",
            "password_retype": "StrongPassword123!",
            "birth_date": "1997-03-21",
            "phone_number": "+996 555 123 123",
            "department": str(department.id),
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED

    user = User.objects.get(username="employee_register_new")
    assert str(user.department_id) == str(department.id)
    assert user.birth_date.isoformat() == "1997-03-21"
    assert user.phone_number == "+996 555 123 123"
    assert user.is_active is False


@pytest.mark.django_db
def test_user_register_with_only_login_and_password(api_client):
    response = api_client.post(
        reverse("api-users-list"),
        {
            "username": "employee_register_minimal",
            "password": "StrongPassword123!",
            "password_retype": "StrongPassword123!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED

    user = User.objects.get(username="employee_register_minimal")
    assert user.department is None
    assert user.birth_date is None
    assert user.phone_number is None
    assert user.is_active is False


@pytest.mark.django_db
def test_user_can_update_messaging_ids_from_profile(api_client):
    user = User.objects.create_user(
        username="employee_profile_ids",
        password="StrongPassword123!",
        is_active=True,
        role="EMPLOYEE",
    )
    api_client.force_authenticate(user=user)

    response = api_client.patch(
        reverse("api-users-me"),
        {
            "telegram_id": "employee.telegram",
            "mattermost_id": "employee.mattermost",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.telegram_id == "employee.telegram"
    assert user.mattermost_id == "employee.mattermost"


@pytest.mark.django_db
def test_profile_messaging_ids_are_unique_and_blank_clears_value(api_client):
    first_user = User.objects.create_user(
        username="employee_profile_ids_1",
        password="StrongPassword123!",
        is_active=True,
        role="EMPLOYEE",
        telegram_id="same.telegram",
        mattermost_id="same.mattermost",
    )
    second_user = User.objects.create_user(
        username="employee_profile_ids_2",
        password="StrongPassword123!",
        is_active=True,
        role="EMPLOYEE",
    )

    api_client.force_authenticate(user=second_user)
    duplicate_response = api_client.patch(
        reverse("api-users-me"),
        {"telegram_id": "same.telegram"},
        format="json",
    )
    assert duplicate_response.status_code == status.HTTP_400_BAD_REQUEST
    assert "telegram_id" in duplicate_response.data

    api_client.force_authenticate(user=first_user)
    clear_response = api_client.patch(
        reverse("api-users-me"),
        {"telegram_id": "", "mattermost_id": ""},
        format="json",
    )
    assert clear_response.status_code == status.HTTP_200_OK

    first_user.refresh_from_db()
    assert first_user.telegram_id is None
    assert first_user.mattermost_id is None
