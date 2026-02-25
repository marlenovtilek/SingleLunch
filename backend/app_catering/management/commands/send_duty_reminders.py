from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from app_catering.models import DutyAssignment
from app_orders.models import NotificationLog
from app_users.services.notification_dispatch import (
    NotificationDispatchCounters,
    dispatch_user_notification,
)
from app_users.services.notifications import (
    build_duty_reminder_text,
    send_mattermost_dm,
    send_telegram_message,
)


class Command(BaseCommand):
    help = "Send duty reminders to users assigned for a specific day."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="Specific duty date in YYYY-MM-DD format. Defaults to today (Asia/Bishkek).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show recipients without sending notifications.",
        )

    @staticmethod
    def _target_date(duty_date_str: str | None):
        if not duty_date_str:
            return timezone.localdate()
        try:
            return date.fromisoformat(duty_date_str)
        except ValueError as exc:
            raise ValueError("Invalid --date format. Use YYYY-MM-DD.") from exc

    def handle(self, *args, **options):
        try:
            duty_date = self._target_date(options.get("date"))
        except ValueError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        assignment = (
            DutyAssignment.objects.select_related("assignee")
            .filter(date=duty_date)
            .first()
        )

        if not assignment:
            self.stdout.write(
                self.style.WARNING(f"No duty assignment found for {duty_date}.")
            )
            return

        user = assignment.assignee
        reminder_text = build_duty_reminder_text(duty_date)
        dry_run = options["dry_run"]
        counters = NotificationDispatchCounters()

        if dry_run:
            self.stdout.write(
                f"[DRY RUN] {user.username} "
                f"(telegram_id={user.telegram_id}, mattermost_id={user.mattermost_id})"
            )
            return

        dispatch_user_notification(
            user=user,
            reminder_date=duty_date,
            reminder_text=reminder_text,
            notification_type=NotificationLog.Type.DUTY_REMINDER,
            force_resend=False,
            send_telegram=send_telegram_message,
            send_mattermost=send_mattermost_dm,
            counters=counters,
            error_writer=lambda message: self.stderr.write(self.style.ERROR(message)),
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Duty reminder sending complete. "
                f"Telegram sent: {counters.sent_telegram}, "
                f"Mattermost sent: {counters.sent_mattermost}, "
                f"Skipped duplicates: {counters.skipped_duplicates}, "
                f"Failed: {counters.failed}, "
                f"No channels: {counters.users_without_channels}."
            )
        )
