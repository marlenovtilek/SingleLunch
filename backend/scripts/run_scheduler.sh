#!/usr/bin/env bash
set -euo pipefail

: "${CRON_TIMEZONE:=Asia/Bishkek}"
: "${REMINDER_CRON:=0 16 * * *}"
: "${MISSED_DEADLINE_CRON:=*/10 * * * *}"
: "${DUTY_REMINDER_CRON:=0 9 * * *}"

CRON_FILE="/tmp/singlelunch.cron"
ENV_FILE="/tmp/singlelunch.env"

cat > "${ENV_FILE}" <<EOF
export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-api.settings}
export DEBUG=${DEBUG:-False}
export SECRET_KEY='${SECRET_KEY:-}'
export ALLOWED_HOSTS='${ALLOWED_HOSTS:-}'
export CSRF_TRUSTED_ORIGINS='${CSRF_TRUSTED_ORIGINS:-}'
export POSTGRES_USER='${POSTGRES_USER:-}'
export POSTGRES_PASSWORD='${POSTGRES_PASSWORD:-}'
export POSTGRES_DB='${POSTGRES_DB:-}'
export POSTGRES_HOST='${POSTGRES_HOST:-}'
export POSTGRES_PORT='${POSTGRES_PORT:-}'
export TELEGRAM_BOT_TOKEN='${TELEGRAM_BOT_TOKEN:-}'
export MATTERMOST_BASE_URL='${MATTERMOST_BASE_URL:-}'
export MATTERMOST_BOT_TOKEN='${MATTERMOST_BOT_TOKEN:-}'
export FRONTEND_BASE_URL='${FRONTEND_BASE_URL:-}'
EOF

cat > "${CRON_FILE}" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CRON_TZ=${CRON_TIMEZONE}
${MISSED_DEADLINE_CRON} source ${ENV_FILE} && cd /app && uv run -- python manage.py mark_missed_deadline_orders >> /proc/1/fd/1 2>> /proc/1/fd/2
${REMINDER_CRON} source ${ENV_FILE} && cd /app && uv run -- python manage.py send_order_reminders >> /proc/1/fd/1 2>> /proc/1/fd/2
${DUTY_REMINDER_CRON} source ${ENV_FILE} && cd /app && uv run -- python manage.py send_duty_reminders >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF

crontab "${CRON_FILE}"
echo "[scheduler] installed crontab:"
cat "${CRON_FILE}"

exec cron -f
