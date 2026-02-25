from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from app_catering.models import DailyMenu
from app_orders.models import NotificationLog, Order
from app_users.models import User
from app_users.services.notification_dispatch import (
    NotificationDispatchCounters,
    dispatch_user_notification,
)
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
        counters = NotificationDispatchCounters()
        total_recipients = 0

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

                dispatch_user_notification(
                    user=user,
                    reminder_date=menu.date,
                    reminder_text=reminder_text,
                    notification_type=NotificationLog.Type.ORDER_REMINDER,
                    force_resend=force_resend,
                    send_telegram=send_telegram_message,
                    send_mattermost=send_mattermost_dm,
                    counters=counters,
                    error_writer=lambda message: self.stderr.write(
                        self.style.ERROR(message)
                    ),
                )

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
                f"Telegram sent: {counters.sent_telegram}, "
                f"Mattermost sent: {counters.sent_mattermost}, "
                f"Skipped duplicates: {counters.skipped_duplicates}, "
                f"Failed: {counters.failed}, "
                f"No channels: {counters.users_without_channels}."
            )
        )
