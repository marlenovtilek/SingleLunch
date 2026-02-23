
from django.urls import include, path
from .views import (
    BrandingPaymentQrUploadAPIView,
    BrandingSettingsAPIView,
    DepartmentViewSet,
    UserViewSet,
)

from rest_framework import routers


router = routers.DefaultRouter()
router.register("users", UserViewSet, basename="api-users")
router.register("departments", DepartmentViewSet, basename="api-departments")

urlpatterns = [
    path("", include(router.urls)),
    path("branding/", BrandingSettingsAPIView.as_view(), name="api-branding"),
    path(
        "branding/payment-qr/",
        BrandingPaymentQrUploadAPIView.as_view(),
        name="api-branding-payment-qr",
    ),
]
