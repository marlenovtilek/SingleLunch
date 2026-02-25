from dataclasses import dataclass
from typing import Callable

from app_orders.models import NotificationLog
from app_users.models import User
from app_users.services.notifications import DeliveryResult

SendFn = Callable[[str, str], DeliveryResult]
ErrorWriter = Callable[[str], None]


@dataclass
class NotificationDispatchCounters:
    sent_telegram: int = 0
    sent_mattermost: int = 0
    failed: int = 0
    skipped_duplicates: int = 0
    users_without_channels: int = 0


def _already_sent(
    *,
    user: User,
    reminder_date,
    channel: NotificationLog.Channel,
    notification_type: NotificationLog.Type,
) -> bool:
    return NotificationLog.objects.filter(
        user=user,
        menu_date=reminder_date,
        channel=channel,
        notification_type=notification_type,
        status=NotificationLog.Status.SENT,
    ).exists()


def _upsert_log(
    *,
    user: User,
    reminder_date,
    channel: NotificationLog.Channel,
    notification_type: NotificationLog.Type,
    status: NotificationLog.Status,
    error_message: str = "",
) -> None:
    NotificationLog.objects.update_or_create(
        user=user,
        menu_date=reminder_date,
        channel=channel,
        notification_type=notification_type,
        defaults={
            "status": status,
            "error_message": error_message,
        },
    )


def _deliver_to_channel(
    *,
    user: User,
    reminder_date,
    reminder_text: str,
    channel: NotificationLog.Channel,
    notification_type: NotificationLog.Type,
    force_resend: bool,
    send_fn: SendFn,
    counters: NotificationDispatchCounters,
    error_writer: ErrorWriter,
) -> None:
    if (
        not force_resend
        and _already_sent(
            user=user,
            reminder_date=reminder_date,
            channel=channel,
            notification_type=notification_type,
        )
    ):
        counters.skipped_duplicates += 1
        return

    if channel == NotificationLog.Channel.TELEGRAM:
        destination = str(user.telegram_id)
    else:
        destination = str(user.mattermost_id)

    result = send_fn(destination, reminder_text)
    if result.success:
        if channel == NotificationLog.Channel.TELEGRAM:
            counters.sent_telegram += 1
        else:
            counters.sent_mattermost += 1
        _upsert_log(
            user=user,
            reminder_date=reminder_date,
            channel=channel,
            notification_type=notification_type,
            status=NotificationLog.Status.SENT,
        )
        return

    counters.failed += 1
    _upsert_log(
        user=user,
        reminder_date=reminder_date,
        channel=channel,
        notification_type=notification_type,
        status=NotificationLog.Status.FAILED,
        error_message=result.message,
    )
    channel_name = "Telegram" if channel == NotificationLog.Channel.TELEGRAM else "Mattermost"
    error_writer(f"[{channel_name}] {user.username}: {result.message}")


def dispatch_user_notification(
    *,
    user: User,
    reminder_date,
    reminder_text: str,
    notification_type: NotificationLog.Type,
    force_resend: bool,
    send_telegram: SendFn,
    send_mattermost: SendFn,
    counters: NotificationDispatchCounters,
    error_writer: ErrorWriter,
) -> None:
    has_channel = False

    if user.telegram_id:
        has_channel = True
        _deliver_to_channel(
            user=user,
            reminder_date=reminder_date,
            reminder_text=reminder_text,
            channel=NotificationLog.Channel.TELEGRAM,
            notification_type=notification_type,
            force_resend=force_resend,
            send_fn=send_telegram,
            counters=counters,
            error_writer=error_writer,
        )

    if user.mattermost_id:
        has_channel = True
        _deliver_to_channel(
            user=user,
            reminder_date=reminder_date,
            reminder_text=reminder_text,
            channel=NotificationLog.Channel.MATTERMOST,
            notification_type=notification_type,
            force_resend=force_resend,
            send_fn=send_mattermost,
            counters=counters,
            error_writer=error_writer,
        )

    if not has_channel:
        counters.users_without_channels += 1
