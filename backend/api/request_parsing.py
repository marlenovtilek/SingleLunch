from datetime import date

from django.utils import timezone
from rest_framework.exceptions import ValidationError

ISO_DATE_FORMAT_ERROR = "Неверный формат даты. Используй YYYY-MM-DD"
ISO_MONTH_FORMAT_ERROR = "Неверный формат месяца. Используй YYYY-MM"


def parse_optional_iso_date_query(
    raw_value: str | None,
    *,
    field_name: str = "date",
    default: date | None = None,
    invalid_message: str = ISO_DATE_FORMAT_ERROR,
) -> date:
    if raw_value:
        try:
            return date.fromisoformat(raw_value)
        except ValueError as error:
            raise ValidationError({field_name: invalid_message}) from error
    if default is not None:
        return default
    return timezone.localdate()


def parse_required_iso_date_query(
    raw_value: str | None,
    *,
    field_name: str = "date",
    missing_message: str,
    invalid_message: str = ISO_DATE_FORMAT_ERROR,
) -> date:
    if not raw_value:
        raise ValidationError({field_name: missing_message})
    return parse_optional_iso_date_query(
        raw_value,
        field_name=field_name,
        invalid_message=invalid_message,
    )


def parse_iso_month_query(
    raw_value: str | None,
    *,
    field_name: str = "month",
    default: str | None = None,
    invalid_message: str = ISO_MONTH_FORMAT_ERROR,
) -> tuple[str, date]:
    month_value = raw_value or default or timezone.localdate().strftime("%Y-%m")
    try:
        month_start = date.fromisoformat(f"{month_value}-01")
    except ValueError as error:
        raise ValidationError({field_name: invalid_message}) from error
    return month_value, month_start
