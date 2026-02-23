from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .serializers import (
    BrandingPaymentQrUploadSerializer,
    BrandingSettingsSerializer,
    DepartmentSerializer,
    UserChangePasswordErrorSerializer,
    UserChangePasswordSerializer,
    UserCreateErrorSerializer,
    UserCreateSerializer,
    UserCurrentErrorSerializer,
    UserCurrentSerializer,
)
from .models import BrandingSettings, Department

User = get_user_model()


def ensure_canteen_or_admin(user):
    if user.is_staff or user.is_superuser:
        return
    if getattr(user, "role", None) == "CANTEEN":
        return
    raise PermissionDenied("Только представитель столовой или администратор.")


class UserViewSet(
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.all()
    serializer_class = UserCurrentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(pk=self.request.user.pk)

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]

        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        elif self.action == "me":
            return UserCurrentSerializer
        elif self.action == "change_password":
            return UserChangePasswordSerializer

        return super().get_serializer_class()

    @extend_schema(
        responses={
            200: UserCreateSerializer,
            400: UserCreateErrorSerializer,
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        responses={
            200: UserCurrentSerializer,
            400: UserCurrentErrorSerializer,
        }
    )
    @action(["get", "put", "patch"], detail=False)
    def me(self, request, *args, **kwargs):
        if request.method == "GET":
            serializer = self.get_serializer(self.request.user)
            return Response(serializer.data)
        elif request.method == "PUT":
            serializer = self.get_serializer(
                self.request.user, data=request.data, partial=False
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        elif request.method == "PATCH":
            serializer = self.get_serializer(
                self.request.user, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

    @extend_schema(
        responses={
            204: None,
            400: UserChangePasswordErrorSerializer,
        }
    )
    @action(["post"], url_path="change-password", detail=False)
    def change_password(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.request.user.set_password(serializer.data["password_new"])
        self.request.user.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Department.objects.all().order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]


class BrandingSettingsAPIView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=BrandingSettingsSerializer)
    def get(self, request, *args, **kwargs):
        branding = BrandingSettings.get_solo()
        serializer = BrandingSettingsSerializer(branding)
        return Response(serializer.data)


class BrandingPaymentQrUploadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=BrandingPaymentQrUploadSerializer,
        responses={200: BrandingSettingsSerializer},
    )
    def post(self, request, *args, **kwargs):
        ensure_canteen_or_admin(request.user)
        serializer = BrandingPaymentQrUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        branding = BrandingSettings.get_solo()
        branding.payment_qr = serializer.validated_data["payment_qr"]
        branding.save(update_fields=["payment_qr"])

        return Response(BrandingSettingsSerializer(branding).data, status=status.HTTP_200_OK)
