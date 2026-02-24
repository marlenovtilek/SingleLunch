import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from app_users.models import User


def make_user(
    username: str,
    *,
    role: str = "EMPLOYEE",
    is_active: bool = True,
    is_staff: bool = False,
    is_superuser: bool = False,
) -> User:
    return User.objects.create_user(
        username=username,
        password="password123",
        role=role,
        is_active=is_active,
        is_staff=is_staff,
        is_superuser=is_superuser,
    )


@pytest.mark.django_db
def test_admin_can_list_and_activate_new_users():
    admin = make_user("admin-users-list", is_staff=True)
    pending = make_user("pending-user", is_active=False)
    active = make_user("active-user", is_active=True)

    client = APIClient()
    client.force_authenticate(user=admin)

    list_response = client.get(reverse("api-users-admin-list"))
    assert list_response.status_code == status.HTTP_200_OK
    usernames = {row["username"] for row in list_response.json()}
    assert pending.username in usernames
    assert active.username in usernames

    activate_response = client.post(
        reverse("api-users-activate", kwargs={"pk": pending.pk})
    )
    assert activate_response.status_code == status.HTTP_200_OK
    pending.refresh_from_db()
    assert pending.is_active is True


@pytest.mark.django_db
def test_non_admin_cannot_access_activation_endpoints():
    employee = make_user("employee-no-access", role="EMPLOYEE")
    target = make_user("pending-target", is_active=False)

    client = APIClient()
    client.force_authenticate(user=employee)

    list_response = client.get(reverse("api-users-admin-list"))
    assert list_response.status_code == status.HTTP_403_FORBIDDEN

    activate_response = client.post(
        reverse("api-users-activate", kwargs={"pk": target.pk})
    )
    assert activate_response.status_code == status.HTTP_403_FORBIDDEN
