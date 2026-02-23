import pytest
from django.urls import reverse
from rest_framework import status


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
