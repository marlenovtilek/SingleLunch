import json
from dataclasses import dataclass
from os import environ
from typing import Literal
from urllib import error, request

from django.utils import timezone

TransportType = Literal["telegram", "mattermost"]
_MATTERMOST_BOT_ID_CACHE: str | None = None


@dataclass
class DeliveryResult:
    success: bool
    transport: TransportType
    message: str


def _http_json(
    method: str,
    url: str,
    payload: dict | list | None = None,
    headers: dict | None = None,
) -> tuple[int, dict | None]:
    body = None
    final_headers = dict(headers or {})
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        final_headers["Content-Type"] = "application/json"

    req = request.Request(url=url, method=method, data=body, headers=final_headers)
    try:
        with request.urlopen(req, timeout=10) as response:
            status_code = response.getcode()
            raw = response.read().decode("utf-8")
            return status_code, json.loads(raw) if raw else None
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        raise RuntimeError(f"HTTP {exc.code}: {raw}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Network error: {exc.reason}") from exc


def send_telegram_message(chat_id: str, message: str) -> DeliveryResult:
    token = environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        return DeliveryResult(
            success=False,
            transport="telegram",
            message="TELEGRAM_BOT_TOKEN is not configured.",
        )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message}
    try:
        _http_json("POST", url, payload=payload)
        return DeliveryResult(
            success=True,
            transport="telegram",
            message="Telegram notification sent.",
        )
    except RuntimeError as exc:
        return DeliveryResult(success=False, transport="telegram", message=str(exc))


def _mattermost_bot_user_id(base_url: str, token: str) -> str:
    global _MATTERMOST_BOT_ID_CACHE
    if _MATTERMOST_BOT_ID_CACHE:
        return _MATTERMOST_BOT_ID_CACHE

    status, payload = _http_json(
        "GET",
        f"{base_url.rstrip('/')}/api/v4/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    if status >= 400 or not payload or "id" not in payload:
        raise RuntimeError("Failed to fetch Mattermost bot user.")
    _MATTERMOST_BOT_ID_CACHE = payload["id"]
    return payload["id"]


def send_mattermost_dm(user_id: str, message: str) -> DeliveryResult:
    base_url = environ.get("MATTERMOST_BASE_URL")
    token = environ.get("MATTERMOST_BOT_TOKEN")

    if not base_url or not token:
        return DeliveryResult(
            success=False,
            transport="mattermost",
            message="MATTERMOST_BASE_URL or MATTERMOST_BOT_TOKEN is not configured.",
        )

    try:
        bot_user_id = _mattermost_bot_user_id(base_url, token)
        _, channel_payload = _http_json(
            "POST",
            f"{base_url.rstrip('/')}/api/v4/channels/direct",
            payload=[bot_user_id, user_id],
            headers={"Authorization": f"Bearer {token}"},
        )
        channel_id = channel_payload["id"] if channel_payload else None
        if not channel_id:
            raise RuntimeError("Failed to create Mattermost DM channel.")

        _http_json(
            "POST",
            f"{base_url.rstrip('/')}/api/v4/posts",
            payload={"channel_id": channel_id, "message": message},
            headers={"Authorization": f"Bearer {token}"},
        )
        return DeliveryResult(
            success=True,
            transport="mattermost",
            message="Mattermost notification sent.",
        )
    except RuntimeError as exc:
        return DeliveryResult(success=False, transport="mattermost", message=str(exc))


def build_order_reminder_text(
    menu_date, selection_deadline, menu_items: list[str] | None = None
) -> str:
    local_deadline = timezone.localtime(selection_deadline).strftime("%d.%m.%Y %H:%M")
    lines = [
        f"Напоминание по обеду на {menu_date:%d.%m.%Y}. "
        f"Оформите заказ до {local_deadline} (Бишкек)."
    ]

    if menu_items:
        lines.append("Меню:")
        for index, item_name in enumerate(menu_items, start=1):
            lines.append(f"  {index}. {item_name}")

    menu_url = _resolve_menu_url()
    if menu_url:
        lines.append("")
        lines.append(menu_url)

    return "\n".join(lines)


def _resolve_menu_url() -> str | None:
    configured = [
        environ.get("FRONTEND_BASE_URL", "").strip(),
        environ.get("NEXT_PUBLIC_APP_URL", "").strip(),
    ]

    trusted_origins = environ.get("CSRF_TRUSTED_ORIGINS", "").strip()
    if trusted_origins:
        configured.extend(
            [origin.strip() for origin in trusted_origins.split(",") if origin.strip()]
        )

    non_local_base: str | None = None
    local_base: str | None = None

    for base_url in configured:
        if not base_url:
            continue
        normalized = base_url.rstrip("/")
        if "localhost" in normalized or "127.0.0.1" in normalized:
            local_base = local_base or normalized
            continue
        non_local_base = non_local_base or normalized

    selected = non_local_base or local_base
    if not selected:
        return None
    return f"{selected}/menu-today"


def build_duty_reminder_text(duty_date) -> str:
    return (
        f"Напоминание: сегодня ({duty_date:%d.%m.%Y}) у вас дежурство в SingleLunch."
    )
