#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
BASE_URL="${BASE_URL:-http://127.0.0.1:18080}"
SKIP_ROLE_SMOKE=0
SKIP_LOGIN_SMOKE=0
LOGIN_USERNAME="${SMOKE_LOGIN_USERNAME:-}"
LOGIN_PASSWORD="${SMOKE_LOGIN_PASSWORD:-}"

usage() {
  cat <<'EOF'
Usage: scripts/prod-health-check.sh [options]

Options:
  --compose-file FILE       docker-compose file (default: docker-compose.prod.yml)
  --base-url URL            public URL or local proxy URL (default: http://127.0.0.1:18080)
  --skip-role-smoke         skip role smoke script
  --skip-login-smoke        skip credentials login smoke
  --login-username USER     username for login smoke
  --login-password PASS     password for login smoke
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --skip-role-smoke)
      SKIP_ROLE_SMOKE=1
      shift
      ;;
    --skip-login-smoke)
      SKIP_LOGIN_SMOKE=1
      shift
      ;;
    --login-username)
      LOGIN_USERNAME="${2:-}"
      shift 2
      ;;
    --login-password)
      LOGIN_PASSWORD="${2:-}"
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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

required_services=(db api web nginx scheduler)
running_services="$(docker compose -f "${COMPOSE_FILE}" ps --services --filter status=running || true)"

for service in "${required_services[@]}"; do
  if ! grep -qx "${service}" <<<"${running_services}"; then
    echo "[FAIL] Service is not running: ${service}" >&2
    docker compose -f "${COMPOSE_FILE}" ps
    exit 1
  fi
done
echo "[OK] All required services are running."

check_health() {
  local service="$1"
  local id
  id="$(docker compose -f "${COMPOSE_FILE}" ps -q "${service}")"
  if [[ -z "${id}" ]]; then
    echo "[FAIL] Missing container id for ${service}" >&2
    exit 1
  fi

  local health
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${id}")"
  if [[ "${health}" != "healthy" && "${health}" != "none" ]]; then
    echo "[FAIL] Service health is ${health}: ${service}" >&2
    exit 1
  fi
  echo "[OK] Health ${service}: ${health}"
}

check_health db
check_health api
check_health web
check_health nginx
check_health scheduler

echo "[INFO] HTTP checks via ${BASE_URL}"
curl -fsS "${BASE_URL}/login" >/dev/null
curl -fsS "${BASE_URL}/api/auth/csrf" >/dev/null

token_status="$(
  curl -sS -o /dev/null -w '%{http_code}' \
    -X POST "${BASE_URL}/api/token/" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-Proto: https" \
    -d '{"username":"","password":""}'
)"
if [[ "${token_status}" -lt 400 || "${token_status}" -ge 500 ]]; then
  echo "[FAIL] Unexpected /api/token/ status: ${token_status}" >&2
  exit 1
fi
echo "[OK] API token endpoint status: ${token_status}"

if [[ "${SKIP_ROLE_SMOKE}" -eq 0 ]]; then
  echo "[INFO] Running role smoke..."
  scripts/role-smoke.sh --compose-file "${COMPOSE_FILE}"
else
  echo "[INFO] Role smoke skipped."
fi

if [[ "${SKIP_LOGIN_SMOKE}" -eq 0 ]]; then
  if [[ -n "${LOGIN_USERNAME}" && -n "${LOGIN_PASSWORD}" ]]; then
    echo "[INFO] Running login smoke..."
    scripts/web-login-smoke.sh \
      --base-url "${BASE_URL}" \
      --username "${LOGIN_USERNAME}" \
      --password "${LOGIN_PASSWORD}"
  else
    echo "[WARN] Login smoke skipped (credentials are not provided)."
  fi
else
  echo "[INFO] Login smoke skipped."
fi

echo "[OK] Production health checks passed."
