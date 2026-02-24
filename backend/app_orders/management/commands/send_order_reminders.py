from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from app_catering.models import DailyMenu
from app_orders.models import NotificationLog, Order
from app_users.models import User
from app_users.services.notifications import (
    build_order_reminder_text,
    send_mattermost_dm,
    send_telegram_message,
)


class Command(BaseCommand):
    help = (
        "Send order reminder notifications to employees who still have no order for "
        "a menu."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--menu-date",
            type=str,
            help="Specific menu date in YYYY-MM-DD format.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show recipients without sending notifications.",
        )
        parser.add_argument(
            "--force-resend",
            action="store_true",
            help="Ignore duplicate protection and resend reminders.",
        )

    def _target_menus(self, menu_date_str: str | None):
        if menu_date_str:
            try:
                menu_date = date.fromisoformat(menu_date_str)
            except ValueError as exc:
                raise ValueError("Invalid --menu-date format. Use YYYY-MM-DD.") from exc
            return DailyMenu.objects.filter(date=menu_date)

        now = timezone.now()
        local_now = timezone.localtime(now)
        day_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        return DailyMenu.objects.filter(
            selection_deadline__gte=day_start,
            selection_deadline__lt=day_end,
            selection_deadline__gt=now,
        )

    @staticmethod
    def _already_sent(user: User, menu_date, channel: NotificationLog.Channel) -> bool:
        return NotificationLog.objects.filter(
            user=user,
            menu_date=menu_date,
            channel=channel,
            notification_type=NotificationLog.Type.ORDER_REMINDER,
            status=NotificationLog.Status.SENT,
        ).exists()

    @staticmethod
    def _upsert_log(
        user: User,
        menu_date,
        channel: NotificationLog.Channel,
        status: NotificationLog.Status,
        error_message: str = "",
    ):
        NotificationLog.objects.update_or_create(
            user=user,
            menu_date=menu_date,
            channel=channel,
            notification_type=NotificationLog.Type.ORDER_REMINDER,
            defaults={
                "status": status,
                "error_message": error_message,
            },
        )

    def handle(self, *args, **options):
        try:
            menus = list(self._target_menus(options.get("menu_date")).order_by("date"))
        except ValueError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
            return

        if not menus:
            self.stdout.write(self.style.WARNING("No target menus found."))
            return

        dry_run = options["dry_run"]
        force_resend = options["force_resend"]
        sent_telegram = 0
        sent_mattermost = 0
        failed = 0
        users_without_channels = 0
        total_recipients = 0
        skipped_duplicates = 0

        for menu in menus:
            ordered_user_ids = set(
                Order.objects.filter(daily_menu=menu).values_list("employee_id", flat=True)
            )
            employees = User.objects.filter(
                is_active=True,
                role="EMPLOYEE",
            ).exclude(id__in=ordered_user_ids)

            recipients_count = employees.count()
            total_recipients += recipients_count

            self.stdout.write(
                f"Menu {menu.date}: {recipients_count} recipients without order."
            )

            reminder_text = build_order_reminder_text(
                menu.date,
                menu.selection_deadline,
                list(menu.options.order_by("id").values_list("name", flat=True)),
            )

            for user in employees:
                if dry_run:
                    self.stdout.write(
                        f"[DRY RUN] {user.username} "
                        f"(telegram_id={user.telegram_id}, mattermost_id={user.mattermost_id})"
                    )
                    continue

                has_channel = False

                if user.telegram_id:
                    has_channel = True
                    if (
                        not force_resend
                        and self._already_sent(
                            user, menu.date, NotificationLog.Channel.TELEGRAM
                        )
                    ):
                        skipped_duplicates += 1
                    else:
                        result = send_telegram_message(str(user.telegram_id), reminder_text)
                        if result.success:
                            sent_telegram += 1
                            self._upsert_log(
                                user,
                                menu.date,
                                NotificationLog.Channel.TELEGRAM,
                                NotificationLog.Status.SENT,
                            )
                        else:
                            failed += 1
                            self._upsert_log(
                                user,
                                menu.date,
                                NotificationLog.Channel.TELEGRAM,
                                NotificationLog.Status.FAILED,
                                result.message,
                            )
                            self.stderr.write(
                                self.style.ERROR(
                                    f"[Telegram] {user.username}: {result.message}"
                                )
                            )

                if user.mattermost_id:
                    has_channel = True
                    if (
                        not force_resend
                        and self._already_sent(
                            user, menu.date, NotificationLog.Channel.MATTERMOST
                        )
                    ):
                        skipped_duplicates += 1
                    else:
                        result = send_mattermost_dm(str(user.mattermost_id), reminder_text)
                        if result.success:
                            sent_mattermost += 1
                            self._upsert_log(
                                user,
                                menu.date,
                                NotificationLog.Channel.MATTERMOST,
                                NotificationLog.Status.SENT,
                            )
                        else:
                            failed += 1
                            self._upsert_log(
                                user,
                                menu.date,
                                NotificationLog.Channel.MATTERMOST,
                                NotificationLog.Status.FAILED,
                                result.message,
                            )
                            self.stderr.write(
                                self.style.ERROR(
                                    f"[Mattermost] {user.username}: {result.message}"
                                )
                            )

                if not has_channel:
                    users_without_channels += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] total recipients: {total_recipients}."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                "Reminder sending complete. "
                f"Telegram sent: {sent_telegram}, "
                f"Mattermost sent: {sent_mattermost}, "
                f"Skipped duplicates: {skipped_duplicates}, "
                f"Failed: {failed}, "
                f"No channels: {users_without_channels}."
            )
        )
