#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
KEEP_DATA=0

usage() {
  cat <<'EOF'
Usage: scripts/role-smoke.sh [--compose-file FILE] [--keep-data]

Options:
  --compose-file FILE   docker-compose file (default: docker-compose.prod.yml)
  --keep-data           do not remove temporary smoke users/orders/menus
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --keep-data)
      KEEP_DATA=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

echo "[INFO] Running role smoke tests using ${COMPOSE_FILE}"

docker compose -f "${COMPOSE_FILE}" exec -T -e SMOKE_KEEP_DATA="${KEEP_DATA}" api /.venv/bin/python - <<'PY'
import json
import os
import urllib.error
import urllib.request
from datetime import timedelta
from uuid import uuid4

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "api.settings")
import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from django.utils import timezone  # noqa: E402

from app_catering.models import DailyMenu, MenuOption  # noqa: E402
from app_orders.models import NotificationLog, Order  # noqa: E402
from app_users.models import BrandingSettings  # noqa: E402

BASE = "http://api:8000"
KEEP_DATA = os.environ.get("SMOKE_KEEP_DATA", "0") == "1"
RUN_ID = uuid4().hex[:8]
PASSWORD = "SmokePass123!"

User = get_user_model()

created_user_ids = []
created_menu_ids = []


def api_request(method, path, token=None, data=None):
    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-Proto": "https",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            payload = json.loads(raw) if raw else None
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else None
        except Exception:
            payload = raw
        return exc.code, payload


def login(username, password):
    status, payload = api_request(
        "POST", "/api/token/", data={"username": username, "password": password}
    )
    if status != 200:
        raise RuntimeError(f"login failed for {username}: {status} {payload}")
    return payload["access"]


def create_user(username, role, *, is_staff=False, is_superuser=False):
    user = User.objects.create_user(
        username=username,
        password=PASSWORD,
        role=role,
        is_active=True,
        is_staff=is_staff,
        is_superuser=is_superuser,
        email=f"{username}@example.com",
    )
    created_user_ids.append(user.id)
    return user


def next_workday(start_date):
    day = start_date
    while day.weekday() in (5, 6):
        day += timedelta(days=1)
    return day


def find_free_future_workday(base_date):
    for offset in range(3, 60):
        candidate = next_workday(base_date + timedelta(days=offset))
        if not DailyMenu.objects.filter(date=candidate).exists():
            return candidate
    raise RuntimeError("No free future workday found for smoke menu.")


def create_menu(menu_date, created_by, deadline, prefix):
    menu = DailyMenu.objects.create(
        date=menu_date,
        selection_deadline=deadline,
        created_by=created_by,
    )
    created_menu_ids.append(menu.id)

    price = BrandingSettings.get_solo().lunch_price
    MenuOption.objects.create(daily_menu=menu, name=f"{prefix} Плов", price=price)
    MenuOption.objects.create(daily_menu=menu, name=f"{prefix} Суп", price=price)
    return menu


def employee_menu_target_date():
    today = timezone.localdate()
    now_local = timezone.localtime(timezone.now())
    switch_at = now_local.replace(
        hour=settings.MENU_NEXT_DAY_SWITCH_HOUR,
        minute=settings.MENU_NEXT_DAY_SWITCH_MINUTE,
        second=0,
        microsecond=0,
    )
    if now_local >= switch_at:
        return today + timedelta(days=1)
    return today


results = []


def check(name, expected, actual):
    ok = expected == actual
    results.append((name, expected, actual, ok))
    return ok


admin = canteen = employee = None
order_menu = menu_for_today_endpoint = None

try:
    admin = create_user(
        username=f"smoke_admin_{RUN_ID}",
        role="EMPLOYEE",
        is_staff=True,
        is_superuser=True,
    )
    canteen = create_user(username=f"smoke_canteen_{RUN_ID}", role="CANTEEN")
    employee = create_user(username=f"smoke_employee_{RUN_ID}", role="EMPLOYEE")

    target_today_menu_date = employee_menu_target_date()
    menu_for_today_endpoint = DailyMenu.objects.filter(date=target_today_menu_date).first()
    if menu_for_today_endpoint is None:
        menu_for_today_endpoint = create_menu(
            menu_date=target_today_menu_date,
            created_by=canteen,
            deadline=timezone.now() + timedelta(hours=6),
            prefix=f"SMOKE-{RUN_ID}",
        )

    order_menu_date = find_free_future_workday(target_today_menu_date)
    order_menu = create_menu(
        menu_date=order_menu_date,
        created_by=canteen,
        deadline=timezone.now() + timedelta(days=1),
        prefix=f"SMOKE-{RUN_ID}",
    )

    admin_token = login(admin.username, PASSWORD)
    canteen_token = login(canteen.username, PASSWORD)
    employee_token = login(employee.username, PASSWORD)

    status, menu_today_payload = api_request(
        "GET", "/api/v1/menu/today/", token=employee_token
    )
    check("employee menu today", 200, status)

    status, _ = api_request(
        "PUT",
        "/api/v1/canteen/menu/",
        token=employee_token,
        data={
            "date": order_menu.date.isoformat(),
            "selection_deadline": order_menu.selection_deadline.isoformat(),
            "options": [{"name": "X"}],
        },
    )
    check("employee cannot manage menu", 403, status)

    status, _ = api_request("GET", "/api/v1/canteen/menus/", token=canteen_token)
    check("canteen menus list", 200, status)

    status, _ = api_request("GET", "/api/users/admin-list/", token=canteen_token)
    check("canteen cannot admin-list", 403, status)

    status, users_payload = api_request("GET", "/api/users/admin-list/", token=admin_token)
    check("admin users list", 200, status)

    first_option = order_menu.options.order_by("id").first()
    status, created_order_payload = api_request(
        "POST",
        "/api/v1/orders/",
        token=employee_token,
        data={
            "daily_menu_id": str(order_menu.id),
            "items": [{"menu_option_id": str(first_option.id), "quantity": 1}],
        },
    )
    check("employee create order", 201, status)

    status, _ = api_request(
        "POST",
        "/api/v1/orders/",
        token=canteen_token,
        data={
            "daily_menu_id": str(order_menu.id),
            "items": [{"menu_option_id": str(first_option.id), "quantity": 1}],
        },
    )
    check("canteen cannot create order", 403, status)

    status, my_orders_payload = api_request(
        "GET", "/api/v1/orders/my/", token=employee_token
    )
    check("employee orders my", 200, status)

    status, dashboard_payload = api_request(
        "GET", f"/api/v1/canteen/orders/?date={order_menu.date.isoformat()}",
        token=canteen_token,
    )
    check("canteen orders dashboard", 200, status)

    print("\nROLE SMOKE REPORT")
    all_ok = True
    for name, expected, actual, ok in results:
        all_ok = all_ok and ok
        mark = "OK" if ok else "FAIL"
        print(f"- [{mark}] {name}: expected {expected}, got {actual}")

    if isinstance(users_payload, list):
        print(f"admin-list users: {len(users_payload)}")
    if isinstance(my_orders_payload, list):
        print(f"employee my orders count: {len(my_orders_payload)}")
    if isinstance(dashboard_payload, dict):
        print(f"canteen dashboard orders_count: {dashboard_payload.get('orders_count')}")
    if isinstance(menu_today_payload, dict):
        print(f"employee menu date: {menu_today_payload.get('date')}")
    if isinstance(created_order_payload, dict):
        print(f"created order id: {created_order_payload.get('id')}")

    if not all_ok:
        raise SystemExit(1)
finally:
    if not KEEP_DATA:
        if created_user_ids:
            Order.objects.filter(employee_id__in=created_user_ids).delete()
            NotificationLog.objects.filter(user_id__in=created_user_ids).delete()

        if created_menu_ids:
            menus = DailyMenu.objects.filter(id__in=created_menu_ids)
            for menu in menus:
                if not menu.orders.exists():
                    menu.delete()

        if created_user_ids:
            User.objects.filter(id__in=created_user_ids).delete()
    else:
        print("\n[WARN] --keep-data enabled: temporary smoke data was not removed.")
PY
