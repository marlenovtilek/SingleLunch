from rest_framework import generics

from django.utils import timezone
from datetime import timedelta
from django.shortcuts import get_object_or_404
from app_catering.models import DailyMenu, MenuOption
from app_catering.api.v1.serializerss import MenuOptionSerializer

class ActiveMenuAPIView(generics.RetrieveAPIView):
    """
    Отдает активное меню на завтра.
    """
    serializer_class = MenuOptionSerializer

    def get_object(self):
        # Логика: ищем меню, которое активно для выбора сегодня (т.е. на завтра)
        tomorrow = timezone.now().date() + timedelta(days=1) 
        
        # Получаем активное меню, на которое еще не прошел дедлайн
        daily_menu = get_object_or_404(
            DailyMenu, 
            date=tomorrow, 
            is_active=True,
            selection_deadline__gt=timezone.now()
        )
        
        # Мы не можем вернуть DailyMenu, нам нужен специальный ответ:
        # options: [MenuOptionSerializer.data], id: DailyMenu.id
        
        return {
            'id': str(daily_menu.id),
            'options': MenuOptionSerializer(daily_menu.options.all(), many=True).data
        }

    # Custom Response, чтобы вернуть данные в нужном формате
    def retrieve(self, request, *args, **kwargs):
        data = self.get_object()
        return Response(data)
    