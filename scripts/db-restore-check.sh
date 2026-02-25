#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_FILE=""

usage() {
  cat <<'EOF'
Usage: scripts/db-restore-check.sh --file PATH [--compose-file FILE]

Verifies that a backup can be restored into a temporary database.
Does not overwrite the main database.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      BACKUP_FILE="${2:-}"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="${2:-}"
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

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "--file is required" >&2
  usage
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

echo "[INFO] Ensuring db service is running..."
docker compose -f "${COMPOSE_FILE}" up -d db >/dev/null

tmp_db="restore_check_$(date -u +%Y%m%d_%H%M%S)"

cleanup() {
  docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    "dropdb --if-exists -U \"\$POSTGRES_USER\" \"${tmp_db}\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[INFO] Creating temp db: ${tmp_db}"
docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
  "createdb -U \"\$POSTGRES_USER\" \"${tmp_db}\""

echo "[INFO] Restoring backup into temp db..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gzip -dc "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"${tmp_db}\"" >/dev/null
else
  cat "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"${tmp_db}\"" >/dev/null
fi

echo "[INFO] Running restore verification query..."
docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
  "psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"${tmp_db}\" -c \"SELECT COUNT(*) FROM django_migrations;\" >/dev/null"

echo "[OK] Restore check passed for ${BACKUP_FILE}"
