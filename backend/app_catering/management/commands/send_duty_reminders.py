from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from app_catering.models import DutyAssignment
from app_orders.models import NotificationLog
from app_users.models import User
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

    @staticmethod
    def _already_sent(
        user: User, duty_date, channel: NotificationLog.Channel
    ) -> bool:
        return NotificationLog.objects.filter(
            user=user,
            menu_date=duty_date,
            channel=channel,
            notification_type=NotificationLog.Type.DUTY_REMINDER,
            status=NotificationLog.Status.SENT,
        ).exists()

    @staticmethod
    def _upsert_log(
        user: User,
        duty_date,
        channel: NotificationLog.Channel,
        status: NotificationLog.Status,
        error_message: str = "",
    ):
        NotificationLog.objects.update_or_create(
            user=user,
            menu_date=duty_date,
            channel=channel,
            notification_type=NotificationLog.Type.DUTY_REMINDER,
            defaults={
                "status": status,
                "error_message": error_message,
            },
        )

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
        sent_telegram = 0
        sent_mattermost = 0
        failed = 0
        skipped_duplicates = 0
        users_without_channels = 0

        if dry_run:
            self.stdout.write(
                f"[DRY RUN] {user.username} "
                f"(telegram_id={user.telegram_id}, mattermost_id={user.mattermost_id})"
            )
            return

        has_channel = False

        if user.telegram_id:
            has_channel = True
            if self._already_sent(user, duty_date, NotificationLog.Channel.TELEGRAM):
                skipped_duplicates += 1
            else:
                result = send_telegram_message(str(user.telegram_id), reminder_text)
                if result.success:
                    sent_telegram += 1
                    self._upsert_log(
                        user,
                        duty_date,
                        NotificationLog.Channel.TELEGRAM,
                        NotificationLog.Status.SENT,
                    )
                else:
                    failed += 1
                    self._upsert_log(
                        user,
                        duty_date,
                        NotificationLog.Channel.TELEGRAM,
                        NotificationLog.Status.FAILED,
                        result.message,
                    )
                    self.stderr.write(
                        self.style.ERROR(f"[Telegram] {user.username}: {result.message}")
                    )

        if user.mattermost_id:
            has_channel = True
            if self._already_sent(user, duty_date, NotificationLog.Channel.MATTERMOST):
                skipped_duplicates += 1
            else:
                result = send_mattermost_dm(str(user.mattermost_id), reminder_text)
                if result.success:
                    sent_mattermost += 1
                    self._upsert_log(
                        user,
                        duty_date,
                        NotificationLog.Channel.MATTERMOST,
                        NotificationLog.Status.SENT,
                    )
                else:
                    failed += 1
                    self._upsert_log(
                        user,
                        duty_date,
                        NotificationLog.Channel.MATTERMOST,
                        NotificationLog.Status.FAILED,
                        result.message,
                    )
                    self.stderr.write(
                        self.style.ERROR(f"[Mattermost] {user.username}: {result.message}")
                    )

        if not has_channel:
            users_without_channels += 1

        self.stdout.write(
            self.style.SUCCESS(
                "Duty reminder sending complete. "
                f"Telegram sent: {sent_telegram}, "
                f"Mattermost sent: {sent_mattermost}, "
                f"Skipped duplicates: {skipped_duplicates}, "
                f"Failed: {failed}, "
                f"No channels: {users_without_channels}."
            )
        )
