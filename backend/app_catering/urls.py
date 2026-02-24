from django.urls import path

from app_catering.api.v1.views import (
    CanteenMenuAPIView,
    CanteenMenuEditAPIView,
    CanteenMenuListAPIView,
    CanteenMenuPaymentQRUploadAPIView,
    DutyAssigneesAPIView,
    DutyAssignmentUpsertAPIView,
    DutyCalendarAPIView,
    TodayMenuAPIView,
)


urlpatterns = [
    path("v1/menu/today/", TodayMenuAPIView.as_view(), name="menu-today"),
    path(
        "v1/canteen/menu/",
        CanteenMenuAPIView.as_view(),
        name="canteen-menu",
    ),
    path(
        "v1/canteen/menus/",
        CanteenMenuListAPIView.as_view(),
        name="canteen-menu-list",
    ),
    path(
        "v1/canteen/menu/edit/",
        CanteenMenuEditAPIView.as_view(),
        name="canteen-menu-edit",
    ),
    path(
        "v1/canteen/menu/payment-qr/",
        CanteenMenuPaymentQRUploadAPIView.as_view(),
        name="canteen-menu-payment-qr",
    ),
    path("v1/duty/", DutyCalendarAPIView.as_view(), name="duty-calendar"),
    path("v1/duty/assignees/", DutyAssigneesAPIView.as_view(), name="duty-assignees"),
    path("v1/duty/assign/", DutyAssignmentUpsertAPIView.as_view(), name="duty-assign"),
]
