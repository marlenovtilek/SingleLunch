from calendar import monthrange
from datetime import date
import logging
from django.contrib.auth import get_user_model
from django.core.management import call_command

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework import permissions, status, views
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from app_catering.api.v1.serializers import (
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

User = get_user_model()
logger = logging.getLogger(__name__)


def _schedule_immediate_order_reminder(menu: DailyMenu) -> None:
    # Immediate reminder is only needed for today's active menu
    # and only while the deadline is still in the future.
    if menu.date != timezone.localdate():
        return
    if not menu.is_active:
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


class TodayMenuAPIView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: TodayMenuSerializer})
    def get(self, request, *args, **kwargs):
        menu = get_object_or_404(
            DailyMenu.objects.prefetch_related("options"),
            date=timezone.localdate(),
            is_active=True,
        )
        return Response(TodayMenuSerializer(menu).data)


class CanteenMenuAPIView(views.APIView):
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
        menu, created = DailyMenu.objects.get_or_create(
            date=payload["date"],
            defaults={
                "selection_deadline": payload["selection_deadline"],
                "is_active": payload["is_active"],
                "created_by": request.user,
            },
        )

        if not created:
            menu.selection_deadline = payload["selection_deadline"]
            menu.is_active = payload["is_active"]
            menu.created_by = request.user
            menu.save(update_fields=["selection_deadline", "is_active", "created_by"])

        requested_options = [
            {
                "name": item["name"],
                "price": item.get("price", MenuOption._meta.get_field("price").default),
            }
            for item in payload["options"]
        ]

        # If there are already orders for this date, menu composition is frozen.
        # Otherwise deleting options may break historical order items (PROTECT FK).
        has_orders = menu.orders.exists()
        if has_orders:
            current_options = [
                {
                    "name": option["name"],
                    "price": option["price"],
                }
                for option in menu.options.values(
                    "name", "price"
                )
            ]

            normalize = lambda items: sorted(
                [
                    (
                        item["name"],
                        str(item["price"]),
                    )
                    for item in items
                ]
            )

            if normalize(current_options) != normalize(requested_options):
                raise ValidationError(
                    {
                        "options": (
                            "Нельзя менять состав меню после появления заказов. "
                            "Создай новое меню на другую дату."
                        )
                    }
                )
        else:
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

        menu = DailyMenu.objects.prefetch_related("options").get(pk=menu.pk)
        _schedule_immediate_order_reminder(menu)
        status_code = 201 if created else 200
        return Response(TodayMenuSerializer(menu).data, status=status_code)

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
        selected_date = request.query_params.get("date")
        if selected_date:
            try:
                menu_date = date.fromisoformat(selected_date)
            except ValueError as error:
                raise ValidationError({"date": "Неверный формат даты. Используй YYYY-MM-DD"}) from error
        else:
            menu_date = timezone.localdate()

        menu = get_object_or_404(
            DailyMenu.objects.prefetch_related("options"),
            date=menu_date,
        )
        return Response(TodayMenuSerializer(menu).data)


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
        month_param = request.query_params.get("month") or timezone.localdate().strftime("%Y-%m")
        try:
            month_start = date.fromisoformat(f"{month_param}-01")
        except ValueError as error:
            raise ValidationError({"month": "Неверный формат месяца. Используй YYYY-MM"}) from error

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
            User.objects.filter(is_active=True)
            .filter(Q(role="CANTEEN") | Q(is_staff=True) | Q(is_superuser=True))
            .order_by("first_name", "last_name", "username")
        )
        return Response(DutyAssigneeSerializer(users, many=True).data, status=status.HTTP_200_OK)


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
