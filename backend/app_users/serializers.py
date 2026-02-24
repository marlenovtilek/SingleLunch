from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions, serializers

from .models import BrandingSettings, Department

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class BrandingSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    payment_qr_url = serializers.SerializerMethodField()

    class Meta:
        model = BrandingSettings
        fields = ["project_name", "logo_url", "payment_qr_url", "lunch_price"]

    def get_logo_url(self, obj: BrandingSettings) -> str:
        if obj.logo:
            return obj.logo.url
        return "/brand/singlelunch-logo.svg"

    def get_payment_qr_url(self, obj: BrandingSettings) -> str | None:
        if obj.payment_qr:
            return obj.payment_qr.url
        return None


class BrandingPaymentQrUploadSerializer(serializers.Serializer):
    payment_qr = serializers.ImageField(required=False)
    lunch_price = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        required=False,
    )

    def validate_payment_qr(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Размер QR изображения не должен превышать 5 МБ.")
        return value

    def validate_lunch_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Цена должна быть больше нуля.")
        return value

    def validate(self, attrs):
        if "payment_qr" not in attrs and "lunch_price" not in attrs:
            raise serializers.ValidationError(
                "Передай QR-изображение или новую цену за порцию."
            )
        return attrs


class UserCurrentSerializer(serializers.ModelSerializer):
    telegram_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=50,
    )
    mattermost_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=50,
    )
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "birth_date",
            "phone_number",
            "department",
            "department_name",
            "telegram_id",
            "mattermost_id",
            "role",
            "is_staff",
            "is_superuser",
        ]
        read_only_fields = ["username", "role", "is_staff", "is_superuser"]

    def validate_birth_date(self, value):
        if value is None:
            return value
        today = timezone.localdate()
        if value.year < 1900 or value > today:
            raise serializers.ValidationError("Birth date is invalid.")
        return value

    def validate_phone_number(self, value):
        if value in (None, ""):
            return value
        allowed_chars = set("0123456789+ -()")
        if any(char not in allowed_chars for char in value):
            raise serializers.ValidationError("Phone number format is invalid.")
        normalized_digits = "".join(char for char in value if char.isdigit())
        if len(normalized_digits) < 9:
            raise serializers.ValidationError("Phone number format is invalid.")
        return value

    def validate_telegram_id(self, value):
        normalized = (value or "").strip()
        if not normalized:
            return None

        instance_pk = getattr(self.instance, "pk", None)
        if User.objects.exclude(pk=instance_pk).filter(telegram_id=normalized).exists():
            raise serializers.ValidationError("Пользователь с таким Telegram ID уже существует.")
        return normalized

    def validate_mattermost_id(self, value):
        normalized = (value or "").strip()
        if not normalized:
            return None

        instance_pk = getattr(self.instance, "pk", None)
        if User.objects.exclude(pk=instance_pk).filter(mattermost_id=normalized).exists():
            raise serializers.ValidationError("Пользователь с таким Mattermost ID уже существует.")
        return normalized


class UserCurrentErrorSerializer(serializers.Serializer):
    first_name = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    last_name = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    birth_date = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    phone_number = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    department = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    telegram_id = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    mattermost_id = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )


class UserAdminListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(
        source="department.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "department_name",
            "created_at",
        ]


class UserChangePasswordSerializer(serializers.ModelSerializer):
    password = serializers.CharField(style={"input_type": "password"}, write_only=True)
    password_new = serializers.CharField(style={"input_type": "password"})
    password_retype = serializers.CharField(
        style={"input_type": "password"}, write_only=True
    )

    default_error_messages = {
        "password_mismatch": _("Current password is not matching"),
        "password_invalid": _("Password does not meet all requirements"),
        "password_same": _("Both new and current passwords are same"),
    }

    class Meta:
        model = User
        fields = ["password", "password_new", "password_retype"]

    def validate(self, attrs):
        request = self.context.get("request", None)

        if not request.user.check_password(attrs["password"]):
            raise serializers.ValidationError(
                {"password": self.default_error_messages["password_mismatch"]}
            )

        try:
            validate_password(attrs["password_new"])
        except ValidationError as e:
            raise exceptions.ValidationError({"password_new": list(e.messages)}) from e

        if attrs["password_new"] != attrs["password_retype"]:
            raise serializers.ValidationError(
                {"password_retype": self.default_error_messages["password_invalid"]}
            )

        if attrs["password_new"] == attrs["password"]:
            raise serializers.ValidationError(
                {"password_new": self.default_error_messages["password_same"]}
            )
        return super().validate(attrs)


class UserChangePasswordErrorSerializer(serializers.Serializer):
    password = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password_new = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    password_retype = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(style={"input_type": "password"}, write_only=True)
    password_retype = serializers.CharField(
        style={"input_type": "password"}, write_only=True
    )
    birth_date = serializers.DateField(required=True)
    phone_number = serializers.CharField(required=True, max_length=20)
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=True,
    )

    default_error_messages = {
        "password_mismatch": _("Password are not matching."),
        "password_invalid": _("Password does not meet all requirements."),
        "birth_date_invalid": _("Birth date is invalid."),
        "phone_number_invalid": _("Phone number format is invalid."),
    }

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "password_retype",
            "birth_date",
            "phone_number",
            "department",
        ]

    def validate_birth_date(self, value):
        today = timezone.localdate()
        if value.year < 1900 or value > today:
            raise serializers.ValidationError(
                self.default_error_messages["birth_date_invalid"]
            )
        return value

    def validate_phone_number(self, value):
        allowed_chars = set("0123456789+ -()")
        if any(char not in allowed_chars for char in value):
            raise serializers.ValidationError(
                self.default_error_messages["phone_number_invalid"]
            )
        normalized_digits = "".join(char for char in value if char.isdigit())
        if len(normalized_digits) < 9:
            raise serializers.ValidationError(
                self.default_error_messages["phone_number_invalid"]
            )
        return value

    def validate(self, attrs):
        password_retype = attrs.pop("password_retype")

        try:
            validate_password(attrs.get("password"))
        except ValidationError as e:
            raise exceptions.ValidationError({"password": list(e.messages)}) from e
        
        if attrs["password"] == password_retype:
            return attrs

        return self.fail("password_mismatch")

    def create(self, validated_data):
        with transaction.atomic():
            user = User.objects.create_user(**validated_data)

            # By default newly registered accounts are inactive.
            user.is_active = False
            user.save(update_fields=["is_active"])

        return user


class UserCreateErrorSerializer(serializers.Serializer):
    username = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password = serializers.ListSerializer(child=serializers.CharField(), required=False)
    password_retype = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    birth_date = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    phone_number = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
    department = serializers.ListSerializer(
        child=serializers.CharField(), required=False
    )
