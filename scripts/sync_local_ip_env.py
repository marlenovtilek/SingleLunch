#!/usr/bin/env python3
from __future__ import annotations

import re
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ENV = ROOT / ".env.frontend"
BACKEND_ENV = ROOT / ".env.backend"


DOCKER_BRIDGE_PREFIXES = (
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
)


def detect_local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            candidate = sock.getsockname()[0]
            if candidate and not candidate.startswith("127."):
                return candidate
    except OSError:
        pass

    try:
        output = subprocess.check_output(["hostname", "-I"], text=True).strip().split()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Cannot detect local IP") from exc

    for candidate in output:
        if candidate.startswith("127."):
            continue
        if candidate.startswith(DOCKER_BRIDGE_PREFIXES):
            continue
        return candidate

    if output:
        return output[0]

    raise RuntimeError("Cannot detect local IP")


def read_file(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def get_env_value(content: str, key: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(key)}=(.*)$", content)
    if not match:
        return None
    return match.group(1).strip()


def parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def unique_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def set_env_value(content: str, key: str, value: str) -> str:
    line = f"{key}={value}"
    pattern = re.compile(rf"(?m)^{re.escape(key)}=.*$")
    if pattern.search(content):
        return pattern.sub(line, content)

    if content and not content.endswith("\n"):
        content += "\n"
    return content + line + "\n"


def update_frontend_env(content: str, ip: str) -> str:
    web_url = f"http://{ip}:3000"
    django_public_url = f"http://{ip}:8765"

    existing_allowed = parse_csv(get_env_value(content, "ALLOWED_DEV_ORIGINS"))
    required_allowed = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        f"http://{ip}",
        f"http://{ip}:3000",
    ]
    merged_allowed = unique_keep_order(required_allowed + existing_allowed)

    content = set_env_value(content, "NEXTAUTH_URL", web_url)
    content = set_env_value(content, "NEXT_PUBLIC_APP_URL", web_url)
    content = set_env_value(content, "DJANGO_PUBLIC_URL", django_public_url)
    content = set_env_value(content, "ALLOWED_DEV_ORIGINS", ",".join(merged_allowed))
    return content


def update_backend_env(content: str, ip: str) -> str:
    existing_hosts = parse_csv(get_env_value(content, "ALLOWED_HOSTS"))
    required_hosts = ["localhost", "127.0.0.1", "api", ip]
    merged_hosts = unique_keep_order(required_hosts + existing_hosts)

    existing_origins = parse_csv(get_env_value(content, "CSRF_TRUSTED_ORIGINS"))
    required_origins = [
        "http://localhost:3000",
        "http://localhost:8765",
        f"http://{ip}:3000",
        f"http://{ip}:8765",
    ]
    merged_origins = unique_keep_order(required_origins + existing_origins)

    content = set_env_value(content, "ALLOWED_HOSTS", ",".join(merged_hosts))
    content = set_env_value(content, "CSRF_TRUSTED_ORIGINS", ",".join(merged_origins))
    return content


def main() -> None:
    forced_ip = None
    if len(sys.argv) == 3 and sys.argv[1] == "--ip":
        forced_ip = sys.argv[2].strip()
    elif len(sys.argv) != 1:
        raise SystemExit("Usage: python3 scripts/sync_local_ip_env.py [--ip <IPv4>]")

    ip = forced_ip or detect_local_ip()

    frontend_content = update_frontend_env(read_file(FRONTEND_ENV), ip)
    FRONTEND_ENV.write_text(frontend_content, encoding="utf-8")

    backend_content = update_backend_env(read_file(BACKEND_ENV), ip)
    BACKEND_ENV.write_text(backend_content, encoding="utf-8")

    print(f"Detected local IP: {ip}")
    print("Updated .env.frontend (NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, DJANGO_PUBLIC_URL, ALLOWED_DEV_ORIGINS)")
    print("Updated .env.backend (ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS)")


if __name__ == "__main__":
    main()
