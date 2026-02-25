#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
OUTPUT_FILE=""
PRINT_PATH_ONLY=0

usage() {
  cat <<'EOF'
Usage: scripts/db-backup.sh [--compose-file FILE] [--output FILE] [--print-path-only]

Creates a gzip PostgreSQL backup from the running docker compose stack.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    --print-path-only)
      PRINT_PATH_ONLY=1
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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ -z "${OUTPUT_FILE}" ]]; then
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  short_sha="$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")"
  mkdir -p backups/postgres
  OUTPUT_FILE="backups/postgres/${timestamp}_${short_sha}.sql.gz"
else
  mkdir -p "$(dirname "${OUTPUT_FILE}")"
fi

echo "[INFO] Ensuring db service is running..." >&2
docker compose -f "${COMPOSE_FILE}" up -d db >/dev/null

echo "[INFO] Waiting for db readiness..." >&2
for _ in {1..30}; do
  if docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
    'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'; then
    break
  fi
  sleep 1
done

if ! docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null'; then
  echo "Database is not ready for backup." >&2
  exit 1
fi

echo "[INFO] Creating backup: ${OUTPUT_FILE}" >&2
docker compose -f "${COMPOSE_FILE}" exec -T db sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip -9 > "${OUTPUT_FILE}"

if [[ "${PRINT_PATH_ONLY}" -eq 1 ]]; then
  echo "${OUTPUT_FILE}"
else
  echo "[OK] Backup created: ${OUTPUT_FILE}"
fi
