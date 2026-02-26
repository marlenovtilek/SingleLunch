from datetime import timedelta

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from app_finance.models import Payment


class Command(BaseCommand):
    help = (
        "Removes payment screenshot files older than retention window and clears "
        "the screenshot reference in DB."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=7,
            help="Retention in days. Screenshots older than this value are removed.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be removed.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        retention_days = options["days"]
        dry_run = options["dry_run"]

        if retention_days < 0:
            self.stderr.write(self.style.ERROR("--days must be >= 0"))
            return

        cutoff = timezone.now() - timedelta(days=retention_days)
        payments = list(
            Payment.objects.filter(created_at__lt=cutoff)
            .exclude(screenshot="")
            .exclude(screenshot__isnull=True)
            .order_by("created_at")
        )

        if not payments:
            self.stdout.write("No screenshots to cleanup.")
            return

        self.stdout.write(
            f"Found {len(payments)} payment screenshots older than {retention_days} day(s)."
        )

        cleared_count = 0
        file_deleted_count = 0

        for payment in payments:
            screenshot_path = payment.screenshot.name

            self.stdout.write(
                f"- payment={payment.id} created_at={payment.created_at.isoformat()} "
                f"path={screenshot_path}"
            )

            if dry_run:
                continue

            # Keep payment history but drop heavy file reference.
            payment.screenshot = ""
            payment.save(update_fields=["screenshot"])
            cleared_count += 1

            if screenshot_path and not Payment.objects.filter(
                screenshot=screenshot_path
            ).exists():
                default_storage.delete(screenshot_path)
                file_deleted_count += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run only. Would clear {len(payments)} screenshot reference(s)."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Cleared {cleared_count} screenshot reference(s), "
                f"deleted {file_deleted_count} file(s)."
            )
        )
