from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView


class SingleLunchTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get("password")

        user_model = get_user_model()
        user = user_model.objects.filter(**{self.username_field: username}).first()

        if user is None:
            raise AuthenticationFailed(
                {"code": "invalid_username", "detail": "Неверный логин."}
            )

        if not user.check_password(password):
            raise AuthenticationFailed(
                {"code": "invalid_password", "detail": "Неверный пароль."}
            )

        if not user.is_active:
            raise AuthenticationFailed(
                {"code": "inactive_user", "detail": "Пользователь неактивен."}
            )

        refresh = self.get_token(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)

        return data


class SingleLunchTokenObtainPairView(TokenObtainPairView):
    serializer_class = SingleLunchTokenObtainPairSerializer
