from calendar import monthrange
from datetime import date, timedelta
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command

from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework import permissions, status, views
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from api.request_parsing import (
    parse_iso_month_query,
    parse_optional_iso_date_query,
    parse_required_iso_date_query,
)
from app_catering.api.v1.serializers import (
    CanteenMenuSummarySerializer,
    CanteenMenuUpsertSerializer,
    CanteenMenuPaymentQRUploadSerializer,
    DutyAssigneeSerializer,
    DutyAssignmentSerializer,
    DutyAssignmentUpsertSerializer,
    DutyCalendarResponseSerializer,
    TodayMenuSerializer,
)
from app_catering.models import DailyMenu, DutyAssignment, MenuOption
from app_catering.permissions import IsCanteenOrAdmin
from app_users.models import BrandingSettings

User = get_user_model()
logger = logging.getLogger(__name__)


def _next_business_day(source_date: date) -> date:
    candidate = source_date + timedelta(days=1)
    while candidate.weekday() in (5, 6):
        candidate += timedelta(days=1)
    return candidate


def _schedule_immediate_order_reminder(menu: DailyMenu) -> None:
    # Immediate reminder is only needed for today's menu while
    # the deadline is still in the future.
    if menu.date != timezone.localdate():
        return
    if menu.selection_deadline <= timezone.now():
        return

    menu_date = menu.date.isoformat()

    def _run_after_commit() -> None:
        try:
            call_command("send_order_reminders", "--menu-date", menu_date)
        except Exception:  # pragma: no cover
            logger.exception(
                "Immediate order reminder failed for menu date %s", menu_date
            )

    transaction.on_commit(_run_after_commit)


def _validate_menu_date_is_editable(menu_date: date) -> None:
    if menu_date < timezone.localdate():
        raise ValidationError(
            {
                "date": (
                    "Нельзя редактировать меню за прошедшую дату. "
                    "Выбери сегодняшнюю или будущую дату."
                )
            }
        )


def _build_requested_options(payload: dict, menu_option_price) -> list[dict]:
    return [
        {
            "name": item["name"],
            "price": menu_option_price,
        }
        for item in payload["options"]
    ]


def _apply_menu_options(menu: DailyMenu, requested_options: list[dict]) -> None:
    # If there are already orders for this date, menu composition is frozen.
    # Otherwise deleting options may break historical order items (PROTECT FK).
    has_orders = menu.orders.exists()
    if has_orders:
        current_options = [
            option["name"]
            for option in menu.options.values("name")
        ]

        normalize = lambda items: sorted([item.strip() for item in items])

        if normalize(current_options) != normalize(
            [item["name"] for item in requested_options]
        ):
            raise ValidationError(
                {
                    "options": (
                        "Нельзя менять состав меню после появления заказов. "
                        "Создай новое меню на другую дату."
                    )
                }
            )
        return

    menu.options.all().delete()
    MenuOption.objects.bulk_create(
        [
            MenuOption(
                daily_menu=menu,
                name=item["name"],
                price=item["price"],
            )
            for item in requested_options
        ]
    )


class TodayMenuAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _target_menu_date(user) -> date:
        today = timezone.localdate()
        is_employee = (
            not user.is_staff
            and not user.is_superuser
            and getattr(user, "role", None) == "EMPLOYEE"
        )
        if not is_employee:
            return today

        now_local = timezone.localtime(timezone.now())
        switch_at = now_local.replace(
            hour=settings.MENU_NEXT_DAY_SWITCH_HOUR,
            minute=settings.MENU_NEXT_DAY_SWITCH_MINUTE,
            second=0,
            microsecond=0,
        )
        if now_local >= switch_at:
            return _next_business_day(today)
        return today

    @extend_schema(responses={200: TodayMenuSerializer})
    def get(self, request, *args, **kwargs):
        menu_date = self._target_menu_date(request.user)
        menu = get_object_or_404(
            DailyMenu.objects.prefetch_related("options"),
            date=menu_date,
        )
        return Response(TodayMenuSerializer(menu).data)


class CanteenMenuAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(
        request=CanteenMenuUpsertSerializer,
        responses={201: TodayMenuSerializer},
    )
    @transaction.atomic
    def put(self, request, *args, **kwargs):
        serializer = CanteenMenuUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        _validate_menu_date_is_editable(payload["date"])

        if DailyMenu.objects.filter(date=payload["date"]).exists():
            raise ValidationError(
                {
                    "date": (
                        "На эту дату меню уже существует. "
                        "Перейди в «Список меню» для редактирования."
                    )
                }
            )

        branding = BrandingSettings.get_solo()
        requested_options = _build_requested_options(payload, branding.lunch_price)

        menu = DailyMenu.objects.create(
            date=payload["date"],
            selection_deadline=payload["selection_deadline"],
            created_by=request.user,
        )
        _apply_menu_options(menu, requested_options)

        menu = DailyMenu.objects.prefetch_related("options").get(pk=menu.pk)
        _schedule_immediate_order_reminder(menu)
        return Response(TodayMenuSerializer(menu).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Дата меню в формате YYYY-MM-DD. По умолчанию сегодня.",
            )
        ],
        responses={200: TodayMenuSerializer},
    )
    def get(self, request, *args, **kwargs):
        menu_date = parse_optional_iso_date_query(
            request.query_params.get("date"),
            field_name="date",
        )

        menu = get_object_or_404(
            DailyMenu.objects.prefetch_related("options"),
            date=menu_date,
        )
        return Response(TodayMenuSerializer(menu).data)


class CanteenMenuListAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date_from",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Начальная дата периода (YYYY-MM-DD). По умолчанию: сегодня - 7 дней.",
            ),
            OpenApiParameter(
                name="date_to",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Конечная дата периода (YYYY-MM-DD). По умолчанию: сегодня + 14 дней.",
            ),
        ],
        responses={200: CanteenMenuSummarySerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        today = timezone.localdate()

        date_from = parse_optional_iso_date_query(
            request.query_params.get("date_from"),
            field_name="date_from",
            default=today - timedelta(days=7),
        )
        date_to = parse_optional_iso_date_query(
            request.query_params.get("date_to"),
            field_name="date_to",
            default=today + timedelta(days=14),
        )

        if date_from > date_to:
            raise ValidationError({"date_from": "date_from не может быть больше date_to"})

        menus = (
            DailyMenu.objects.filter(date__range=(date_from, date_to))
            .annotate(options_count=Count("options"))
            .prefetch_related("options")
            .order_by("date")
        )
        return Response(CanteenMenuSummarySerializer(menus, many=True).data, status=status.HTTP_200_OK)


class CanteenMenuEditAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(
        request=CanteenMenuUpsertSerializer,
        responses={200: TodayMenuSerializer},
    )
    @transaction.atomic
    def put(self, request, *args, **kwargs):
        serializer = CanteenMenuUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        _validate_menu_date_is_editable(payload["date"])

        menu = DailyMenu.objects.filter(date=payload["date"]).first()
        if menu is None:
            raise ValidationError(
                {"date": "Меню на эту дату не найдено. Создай меню сначала."}
            )

        menu.selection_deadline = payload["selection_deadline"]
        menu.created_by = request.user
        menu.save(update_fields=["selection_deadline", "created_by"])

        branding = BrandingSettings.get_solo()
        requested_options = _build_requested_options(payload, branding.lunch_price)
        _apply_menu_options(menu, requested_options)

        menu = DailyMenu.objects.prefetch_related("options").get(pk=menu.pk)
        _schedule_immediate_order_reminder(menu)
        return Response(TodayMenuSerializer(menu).data, status=status.HTTP_200_OK)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                required=True,
                description="Дата меню для удаления (YYYY-MM-DD).",
            )
        ],
        responses={204: None},
    )
    @transaction.atomic
    def delete(self, request, *args, **kwargs):
        menu_date = parse_required_iso_date_query(
            request.query_params.get("date"),
            field_name="date",
            missing_message="Параметр date обязателен (YYYY-MM-DD).",
        )

        _validate_menu_date_is_editable(menu_date)

        menu = DailyMenu.objects.filter(date=menu_date).first()
        if menu is None:
            raise ValidationError({"date": "Меню на эту дату не найдено."})

        if menu.orders.exists():
            raise ValidationError(
                {"date": "Нельзя удалить меню: по нему уже есть заказы."}
            )

        menu.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CanteenMenuPaymentQRUploadAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=CanteenMenuPaymentQRUploadSerializer,
        responses={200: TodayMenuSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = CanteenMenuPaymentQRUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        menu = DailyMenu.objects.prefetch_related("options").filter(
            date=serializer.validated_data["date"],
        ).first()
        if not menu:
            raise ValidationError(
                {"date": "Сначала создай меню на эту дату, затем загрузи QR."}
            )

        menu.payment_qr = serializer.validated_data["payment_qr"]
        menu.save(update_fields=["payment_qr"])

        return Response(TodayMenuSerializer(menu).data, status=status.HTTP_200_OK)


class DutyCalendarAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="month",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Месяц в формате YYYY-MM. По умолчанию текущий месяц.",
            )
        ],
        responses={200: DutyCalendarResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        month_param, month_start = parse_iso_month_query(
            request.query_params.get("month"),
            field_name="month",
        )

        last_day = monthrange(month_start.year, month_start.month)[1]
        month_end = month_start.replace(day=last_day)

        assignments = DutyAssignment.objects.filter(
            date__range=(month_start, month_end)
        ).select_related("assignee")

        payload = {
            "month": month_param,
            "assignments": DutyAssignmentSerializer(assignments, many=True).data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class DutyAssigneesAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(responses={200: DutyAssigneeSerializer(many=True)})
    def get(self, request, *args, **kwargs):
        users = (
            User.objects.filter(
                is_active=True,
                role="EMPLOYEE",
                is_staff=False,
                is_superuser=False,
            )
            .order_by("first_name", "last_name", "username")
        )
        return Response(
            DutyAssigneeSerializer(users, many=True).data, status=status.HTTP_200_OK
        )


class DutyAssignmentUpsertAPIView(views.APIView):
    permission_classes = [IsCanteenOrAdmin]

    @extend_schema(
        request=DutyAssignmentUpsertSerializer,
        responses={200: DutyAssignmentSerializer},
    )
    def put(self, request, *args, **kwargs):
        serializer = DutyAssignmentUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment_date = serializer.validated_data["date"]
        assignee = serializer.validated_data.get("assignee")
        if assignee is None:
            DutyAssignment.objects.filter(date=assignment_date).delete()
            return Response(
                {"status": "cleared", "date": assignment_date.isoformat()},
                status=status.HTTP_200_OK,
            )

        assignment, created = DutyAssignment.objects.update_or_create(
            date=assignment_date,
            defaults={
                "assignee": assignee,
                "created_by": request.user,
            },
        )
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(DutyAssignmentSerializer(assignment).data, status=status_code)
