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
    UserAdminListSerializer,
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


def ensure_admin(user):
    if user.is_staff or user.is_superuser:
        return
    raise PermissionDenied("Только администратор.")


class UserViewSet(
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.all()
    serializer_class = UserCurrentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.action in ("admin_list", "activate"):
            return (
                self.queryset.filter(is_staff=False, is_superuser=False)
                .select_related("department")
                .order_by("is_active", "-created_at")
            )
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
        elif self.action in ("admin_list", "activate"):
            return UserAdminListSerializer

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

    @extend_schema(responses={200: UserAdminListSerializer(many=True)})
    @action(["get"], detail=False, url_path="admin-list")
    def admin_list(self, request, *args, **kwargs):
        ensure_admin(request.user)
        users = self.get_queryset()
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @extend_schema(responses={200: UserAdminListSerializer})
    @action(["post"], detail=True, url_path="activate")
    def activate(self, request, *args, **kwargs):
        ensure_admin(request.user)
        user = self.get_object()
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=["is_active"])
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


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
        update_fields = []

        payment_qr = serializer.validated_data.get("payment_qr")
        if payment_qr is not None:
            branding.payment_qr = payment_qr
            update_fields.append("payment_qr")

        lunch_price = serializer.validated_data.get("lunch_price")
        if lunch_price is not None:
            branding.lunch_price = lunch_price
            update_fields.append("lunch_price")

        if update_fields:
            branding.save(update_fields=update_fields)

        return Response(BrandingSettingsSerializer(branding).data, status=status.HTTP_200_OK)
