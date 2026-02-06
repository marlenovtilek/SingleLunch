from django.urls import path
from app_orders.api.v1.views import OrderCreateAPIView

urlpatterns = [
    path('api/v1/orders/create/', OrderCreateAPIView.as_view(), name='order-create'),
]