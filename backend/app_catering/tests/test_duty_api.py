from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from app_catering.models import DutyAssignment
from app_users.models import User


def make_user(username: str, role: str, **extra) -> User:
    return User.objects.create_user(
        username=username,
        password="password123",
        is_active=True,
        role=role,
        **extra,
    )


@pytest.mark.django_db
def test_duty_calendar_returns_month_assignments_for_authenticated_user():
    assignee = make_user("canteen_assignee_1", "CANTEEN")
    viewer = make_user("employee_viewer_1", "EMPLOYEE")

    today = timezone.localdate()
    DutyAssignment.objects.create(date=today, assignee=assignee)
    DutyAssignment.objects.create(
        date=today + timedelta(days=35),
        assignee=assignee,
    )

    client = APIClient()
    client.force_authenticate(user=viewer)

    response = client.get(
        f"{reverse('duty-calendar')}?month={today.strftime('%Y-%m')}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["month"] == today.strftime("%Y-%m")
    assert len(data["assignments"]) == 1
    assert data["assignments"][0]["date"] == today.isoformat()


@pytest.mark.django_db
def test_duty_assign_forbidden_for_employee():
    assignee = make_user("canteen_assignee_2", "CANTEEN")
    employee = make_user("employee_assign_forbidden", "EMPLOYEE")

    client = APIClient()
    client.force_authenticate(user=employee)

    response = client.put(
        reverse("duty-assign"),
        {"date": timezone.localdate().isoformat(), "assignee_id": str(assignee.id)},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_canteen_can_assign_and_clear_duty():
    canteen_manager = make_user("canteen_manager_1", "CANTEEN")
    assignee = make_user("canteen_assignee_3", "CANTEEN")
    duty_date = timezone.localdate() + timedelta(days=1)

    client = APIClient()
    client.force_authenticate(user=canteen_manager)

    assign_response = client.put(
        reverse("duty-assign"),
        {"date": duty_date.isoformat(), "assignee_id": str(assignee.id)},
        format="json",
    )
    assert assign_response.status_code in (200, 201)
    assert DutyAssignment.objects.filter(date=duty_date, assignee=assignee).exists()

    clear_response = client.put(
        reverse("duty-assign"),
        {"date": duty_date.isoformat(), "assignee_id": None},
        format="json",
    )
    assert clear_response.status_code == 200
    assert DutyAssignment.objects.filter(date=duty_date).count() == 0


@pytest.mark.django_db
def test_duty_assignees_list_returns_only_canteen_or_admin():
    canteen_manager = make_user("canteen_manager_2", "CANTEEN")
    canteen_user = make_user("canteen_user_1", "CANTEEN")
    make_user("employee_not_assignee", "EMPLOYEE")
    make_user("staff_assignee", "EMPLOYEE", is_staff=True)

    client = APIClient()
    client.force_authenticate(user=canteen_manager)

    response = client.get(reverse("duty-assignees"))
    assert response.status_code == 200

    usernames = {item["username"] for item in response.json()}
    assert "canteen_user_1" in usernames
    assert "staff_assignee" in usernames
    assert "employee_not_assignee" not in usernames
