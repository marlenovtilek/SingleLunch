#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_FILE=""
YES=0

usage() {
  cat <<'EOF'
Usage: scripts/db-restore.sh --file PATH [--compose-file FILE] [--yes]

Restores PostgreSQL from a SQL/SQL.GZ backup into POSTGRES_DB.
WARNING: existing DB content will be replaced.
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
    --yes)
      YES=1
      shift
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

if [[ "${YES}" -ne 1 ]]; then
  echo "Restore will DROP and recreate the current database."
  read -r -p "Continue? [y/N] " answer
  if [[ "${answer}" != "y" && "${answer}" != "Y" ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

echo "[INFO] Ensuring db service is running..."
docker compose -f "${COMPOSE_FILE}" up -d db >/dev/null

echo "[INFO] Waiting for db readiness..."
for _ in {1..30}; do
  if docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'; then
    break
  fi
  sleep 1
done

if ! docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'; then
  echo "Database is not ready for restore." >&2
  exit 1
fi

echo "[INFO] Recreating target database..."
docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc '
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" >/dev/null
dropdb --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"
createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
'

echo "[INFO] Restoring ${BACKUP_FILE}..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gzip -dc "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
else
  cat "${BACKUP_FILE}" | docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
fi

echo "[OK] Restore completed."
