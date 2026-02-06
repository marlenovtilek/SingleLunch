
from rest_framework import serializers
from app_catering.models import MenuOption

class MenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        # Фронтенд ожидает поля: id, name, description, price, category, image, calories
        # Мы должны добавить эти поля в модели MenuOption или кастомизировать сериализатор
        fields = ['id', 'name', 'description', 'price', 'category', 'image', 'calories'] 