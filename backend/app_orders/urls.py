from django.urls import path
from app_orders.api.v1.views import (
    CanteenOrdersDashboardAPIView,
    MyOrdersListAPIView,
    OrderCancelAPIView,
    OrderCreateAPIView,
    OrderPaymentCreateAPIView,
)

urlpatterns = [
    path("v1/orders/", OrderCreateAPIView.as_view(), name="order-create"),
    path("v1/orders/my/", MyOrdersListAPIView.as_view(), name="orders-my"),
    path(
        "v1/orders/<uuid:pk>/payment/",
        OrderPaymentCreateAPIView.as_view(),
        name="order-payment",
    ),
    path(
        "v1/orders/<uuid:pk>/cancel/",
        OrderCancelAPIView.as_view(),
        name="order-cancel",
    ),
    path(
        "v1/canteen/orders/",
        CanteenOrdersDashboardAPIView.as_view(),
        name="canteen-orders",
    ),
]
