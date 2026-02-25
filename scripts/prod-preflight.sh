#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
RUN_RUNTIME_CHECKS=false

if [[ "${1:-}" == "--runtime" ]]; then
  RUN_RUNTIME_CHECKS=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--runtime]"
  exit 1
fi

errors=0
warnings=0

info() {
  echo "[INFO] $1"
}

pass() {
  echo "[OK]   $1"
}

warn() {
  echo "[WARN] $1"
  warnings=$((warnings + 1))
}

fail() {
  echo "[FAIL] $1"
  errors=$((errors + 1))
}

require_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    pass "Файл ${file} найден"
  else
    fail "Файл ${file} не найден"
  fi
}

get_env_value() {
  local file="$1"
  local key="$2"

  awk -v key="${key}" -F= '
    /^[[:space:]]*#/ { next }
    $1 == key {
      sub(/^[^=]*=/, "", $0)
      print $0
      exit
    }
  ' "${file}" | tr -d '\r'
}

check_env_value() {
  local file="$1"
  local key="$2"
  local value
  value="$(get_env_value "${file}" "${key}")"
  if [[ -z "${value}" ]]; then
    fail "${key} не заполнен в ${file}"
    return
  fi
  pass "${key} заполнен"
}

check_secret_not_placeholder() {
  local name="$1"
  local value="$2"

  if [[ -z "${value}" ]]; then
    fail "${name} пустой"
    return
  fi

  if [[ "${value}" =~ ^(your_secret_key|your_nextauth_secret|change_me)$ ]]; then
    fail "${name} содержит шаблонное значение"
    return
  fi

  if [[ "${name}" == "SECRET_KEY" && "${value}" =~ ^django-insecure- ]]; then
    fail "SECRET_KEY выглядит как автоматически сгенерированный dev-ключ"
    return
  fi

  if [[ "${#value}" -lt 32 ]]; then
    warn "${name} короче 32 символов"
  else
    pass "${name} достаточно длинный"
  fi
}

run_check_command() {
  local title="$1"
  local command="$2"

  info "${title}"
  if bash -lc "${command}" >/tmp/singlelunch-preflight.out 2>/tmp/singlelunch-preflight.err; then
    pass "${title}"
  else
    fail "${title}"
    sed -n '1,80p' /tmp/singlelunch-preflight.err || true
  fi
}

info "Проверяю env файлы"
require_file ".env.backend"
require_file ".env.frontend"

if [[ ! -f ".env.backend" || ! -f ".env.frontend" ]]; then
  echo
  echo "Preflight завершен с ошибками: ${errors}"
  exit 1
fi

check_env_value ".env.backend" "DEBUG"
check_env_value ".env.backend" "SECRET_KEY"
check_env_value ".env.backend" "ALLOWED_HOSTS"
check_env_value ".env.backend" "CSRF_TRUSTED_ORIGINS"
check_env_value ".env.backend" "POSTGRES_PASSWORD"
check_env_value ".env.frontend" "NEXTAUTH_SECRET"
check_env_value ".env.frontend" "NEXTAUTH_URL"
check_env_value ".env.frontend" "NEXT_PUBLIC_APP_URL"
check_env_value ".env.frontend" "DJANGO_PUBLIC_URL"

backend_debug="$(get_env_value ".env.backend" "DEBUG")"
backend_secret="$(get_env_value ".env.backend" "SECRET_KEY")"
frontend_secret="$(get_env_value ".env.frontend" "NEXTAUTH_SECRET")"

if [[ "${backend_debug}" != "False" ]]; then
  warn "DEBUG не равен False (текущее значение: ${backend_debug})"
else
  pass "DEBUG=False"
fi

check_secret_not_placeholder "SECRET_KEY" "${backend_secret}"
check_secret_not_placeholder "NEXTAUTH_SECRET" "${frontend_secret}"

info "Проверяю docker compose конфигурацию"
if docker compose -f "${COMPOSE_FILE}" config >/tmp/singlelunch-prod-compose.txt; then
  pass "docker compose -f ${COMPOSE_FILE} config"
else
  fail "docker compose -f ${COMPOSE_FILE} config"
fi

if [[ "${RUN_RUNTIME_CHECKS}" == "true" ]]; then
  info "Runtime-проверки включены (--runtime)"
  running_services="$(docker compose -f "${COMPOSE_FILE}" ps --services --filter status=running || true)"
  if ! grep -qx "api" <<<"${running_services}"; then
    fail "Сервис api не запущен в ${COMPOSE_FILE}. Сначала: docker compose -f ${COMPOSE_FILE} up -d"
  else
    run_check_command \
      "Django check --deploy" \
      "docker compose -f ${COMPOSE_FILE} exec -T api /.venv/bin/python manage.py check --deploy"
    run_check_command \
      "Проверка непримененных миграций" \
      "docker compose -f ${COMPOSE_FILE} exec -T api /.venv/bin/python manage.py migrate --check"
    run_check_command \
      "Smoke health endpoint" \
      "docker compose -f ${COMPOSE_FILE} exec -T api python -c \"import urllib.request; req=urllib.request.Request('http://localhost:8000/healthz/', headers={'X-Forwarded-Proto':'https'}); r=urllib.request.urlopen(req, timeout=5); print(r.status)\""
  fi
else
  info "Runtime-проверки пропущены. Запусти: scripts/prod-preflight.sh --runtime"
fi

echo
echo "=== PRE-FLIGHT SUMMARY ==="
echo "Ошибки: ${errors}"
echo "Предупреждения: ${warnings}"

if [[ "${errors}" -gt 0 ]]; then
  exit 1
fi

exit 0
