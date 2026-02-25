#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:18080}"
USERNAME="${SMOKE_LOGIN_USERNAME:-}"
PASSWORD="${SMOKE_LOGIN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage: scripts/web-login-smoke.sh --base-url URL --username USER --password PASS

Checks NextAuth credentials callback flow end-to-end.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --username)
      USERNAME="${2:-}"
      shift 2
      ;;
    --password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${USERNAME}" || -z "${PASSWORD}" ]]; then
  echo "Username and password are required." >&2
  usage
  exit 1
fi

cookie_file="$(mktemp)"
csrf_file="$(mktemp)"
resp_file="$(mktemp)"

cleanup() {
  rm -f "${cookie_file}" "${csrf_file}" "${resp_file}"
}
trap cleanup EXIT

echo "[INFO] Checking login page..."
curl -fsS -c "${cookie_file}" -b "${cookie_file}" "${BASE_URL}/login" >/dev/null

echo "[INFO] Fetching csrf token..."
curl -fsS -c "${cookie_file}" -b "${cookie_file}" \
  "${BASE_URL}/api/auth/csrf" > "${csrf_file}"
csrf_token="$(
  python3 - <<'PY' "${csrf_file}"
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
print(data.get("csrfToken", ""))
PY
)"

if [[ -z "${csrf_token}" ]]; then
  echo "Failed to obtain csrf token." >&2
  exit 1
fi

echo "[INFO] Calling credentials callback..."
curl -fsS -c "${cookie_file}" -b "${cookie_file}" \
  -X POST "${BASE_URL}/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "csrfToken=${csrf_token}" \
  --data-urlencode "username=${USERNAME}" \
  --data-urlencode "password=${PASSWORD}" \
  --data-urlencode "rememberMe=1" \
  --data-urlencode "callbackUrl=${BASE_URL}/menu-today" \
  --data-urlencode "json=true" > "${resp_file}"

callback_url="$(
  python3 - <<'PY' "${resp_file}"
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
print(data.get("url", ""))
PY
)"

if [[ "${callback_url}" != *"/menu-today"* ]]; then
  echo "Login smoke failed, callback url: ${callback_url}" >&2
  exit 1
fi

echo "[OK] Login smoke passed (${callback_url})"
