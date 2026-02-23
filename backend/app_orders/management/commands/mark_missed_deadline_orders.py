from django.core.management.base import BaseCommand
from django.utils import timezone

from app_orders.models import Order


class Command(BaseCommand):
    help = (
        "Marks orders as MISSED_DEADLINE when payment deadline has passed and "
        "order is still AWAITING_PAYMENT."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many orders would be updated without saving changes.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        queryset = Order.objects.filter(
            status=Order.Status.AWAITING_PAYMENT,
            daily_menu__selection_deadline__isnull=False,
            daily_menu__selection_deadline__lt=now,
        )

        if options["dry_run"]:
            count = queryset.count()
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] {count} orders would be marked as MISSED_DEADLINE."
                )
            )
            return

        updated = queryset.update(status=Order.Status.MISSED_DEADLINE)
        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {updated} orders to status MISSED_DEADLINE."
            )
        )
