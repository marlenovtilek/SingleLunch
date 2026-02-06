from rest_framework import views, permissions, status
from rest_framework.response import Response
from app_orders.services.order_service import OrderService
from app_orders.api.v1.serializers import OrderCreateSerializer, OrderDetailSerializer
from app_users.models import User  

class OrderCreateAPIView(views.APIView):
    """
    API для создания нового заказа.
    Требует: daily_menu_id и список items (позиций).
    """
    permissions = [permissions.AllowAny]
    order_service = OrderService()

    def post(self, request, *args, **kwargs):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        
        daily_menu = serializer.daily_menu
        employee: User = request.user 
        
        try:
            self.order_service.validate_menu_deadline(daily_menu)
            validated_items = self.order_service.validate_order_items(daily_menu, data['items'])
            
            order = self.order_service.create_order(
                employee=employee,
                daily_menu=daily_menu,
                validated_items=validated_items
            )
            
            response_serializer = OrderDetailSerializer(order)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": "Произошла внутренняя ошибка сервера."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)