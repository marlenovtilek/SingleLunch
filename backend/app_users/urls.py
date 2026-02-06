
from django.urls import include, path
from .views import UserViewSet

from rest_framework import routers


router = routers.DefaultRouter()
router.register("users", UserViewSet, basename="api-users")






urlpatterns = [
    path("api/", include(router.urls)),
]