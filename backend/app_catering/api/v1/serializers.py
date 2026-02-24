from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from app_catering.models import DailyMenu, DutyAssignment, MenuOption

User = get_user_model()


class MenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        fields = ["id", "name", "price"]


class TodayMenuSerializer(serializers.ModelSerializer):
    options = MenuOptionSerializer(many=True, read_only=True)
    can_order = serializers.SerializerMethodField()
    payment_qr_url = serializers.SerializerMethodField()

    class Meta:
        model = DailyMenu
        fields = [
            "id",
            "date",
            "selection_deadline",
            "can_order",
            "payment_qr_url",
            "options",
        ]

    def get_can_order(self, obj) -> bool:
        return timezone.now() <= obj.selection_deadline

    def get_payment_qr_url(self, obj) -> str | None:
        if not obj.payment_qr:
            return None
        return obj.payment_qr.url


class CanteenMenuOptionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)


class CanteenMenuUpsertSerializer(serializers.Serializer):
    date = serializers.DateField()
    selection_deadline = serializers.DateTimeField()
    options = CanteenMenuOptionInputSerializer(many=True, min_length=1)

    def validate_date(self, value):
        if value.weekday() in (5, 6):
            raise serializers.ValidationError(
                "Дата меню не может приходиться на выходной (суббота/воскресенье)."
            )
        return value

    def validate_selection_deadline(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError(
                "Дедлайн выбора не может быть в прошлом."
            )
        if timezone.localtime(value).weekday() in (5, 6):
            raise serializers.ValidationError(
                "Дедлайн выбора не может приходиться на выходной (суббота/воскресенье)."
            )
        return value


class CanteenMenuSummarySerializer(serializers.ModelSerializer):
    options_count = serializers.IntegerField(read_only=True)
    options = serializers.SerializerMethodField()

    class Meta:
        model = DailyMenu
        fields = [
            "date",
            "selection_deadline",
            "options_count",
            "options",
        ]

    def get_options(self, obj: DailyMenu) -> list[str]:
        return [option.name for option in obj.options.all()]


class CanteenMenuPaymentQRUploadSerializer(serializers.Serializer):
    date = serializers.DateField()
    payment_qr = serializers.ImageField()

    def validate_payment_qr(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Размер QR изображения не должен превышать 5 МБ.")
        return value


class DutyAssignmentSerializer(serializers.ModelSerializer):
    assignee_id = serializers.UUIDField(source="assignee.id", read_only=True)
    assignee_username = serializers.CharField(source="assignee.username", read_only=True)
    assignee_full_name = serializers.SerializerMethodField()

    class Meta:
        model = DutyAssignment
        fields = ["id", "date", "assignee_id", "assignee_username", "assignee_full_name"]

    def get_assignee_full_name(self, obj) -> str:
        return obj.assignee.get_full_name() or obj.assignee.username


class DutyCalendarResponseSerializer(serializers.Serializer):
    month = serializers.CharField()
    assignments = DutyAssignmentSerializer(many=True)


class DutyAssigneeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name"]

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class DutyAssignmentUpsertSerializer(serializers.Serializer):
    date = serializers.DateField()
    assignee_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        assignee_id = attrs.get("assignee_id")
        if assignee_id is None:
            attrs["assignee"] = None
            return attrs

        assignee = User.objects.filter(pk=assignee_id, is_active=True).first()
        if not assignee:
            raise serializers.ValidationError({"assignee_id": "Пользователь не найден или неактивен."})

        if not (
            assignee.is_staff
            or assignee.is_superuser
            or getattr(assignee, "role", None) == "CANTEEN"
        ):
            raise serializers.ValidationError(
                {"assignee_id": "Назначить можно только представителя столовой."}
            )

        attrs["assignee"] = assignee
        return attrs
