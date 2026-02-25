#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
BASE_URL=""
REF=""
RESTORE_BACKUP=""
SKIP_SMOKE=0
ALLOW_DIRTY=0

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

usage() {
  cat <<'EOF'
Usage: scripts/rollback-prod.sh [options]

Options:
  --to-ref REF             rollback target tag/commit. Default: .deploy previous release.
  --restore-backup FILE    restore database from backup file during rollback.
  --compose-file FILE      docker-compose file (default: docker-compose.prod.yml)
  --base-url URL           URL for health checks (default from NEXTAUTH_URL or http://127.0.0.1:18080)
  --skip-smoke             skip smoke checks (role/login)
  --allow-dirty            allow rollback from dirty git tree
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to-ref)
      REF="${2:-}"
      shift 2
      ;;
    --restore-backup)
      RESTORE_BACKUP="${2:-}"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --skip-smoke)
      SKIP_SMOKE=1
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
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

if [[ -z "${BASE_URL}" ]]; then
  if [[ -f ".env.frontend" ]]; then
    BASE_URL="$(get_env_value ".env.frontend" "NEXTAUTH_URL")"
  fi
  BASE_URL="${BASE_URL:-http://127.0.0.1:18080}"
fi

if [[ -z "${REF}" && -f ".deploy/previous_release.env" ]]; then
  # shellcheck disable=SC1091
  source .deploy/previous_release.env
  REF="${REF:-}"
fi

if [[ -z "${REF}" ]]; then
  echo "Rollback target is not specified and .deploy/previous_release.env is missing." >&2
  exit 1
fi

if [[ -n "${RESTORE_BACKUP}" && ! -f "${RESTORE_BACKUP}" ]]; then
  echo "Backup file not found: ${RESTORE_BACKUP}" >&2
  exit 1
fi

if [[ "${ALLOW_DIRTY}" -ne 1 ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Git tree is dirty. Commit/stash changes or use --allow-dirty." >&2
    git status --short
    exit 1
  fi
fi

echo "[INFO] Fetching refs..."
git fetch --tags --prune origin

CURRENT_COMMIT="$(git rev-parse HEAD)"
CURRENT_REF="$(git describe --tags --exact-match 2>/dev/null || echo "${CURRENT_COMMIT}")"

if git rev-parse -q --verify "refs/tags/${REF}" >/dev/null; then
  echo "[INFO] Rolling back to tag ${REF}..."
  git checkout --detach "refs/tags/${REF}"
else
  echo "[INFO] Rolling back to commit ${REF}..."
  git checkout --detach "${REF}"
fi

TARGET_COMMIT="$(git rev-parse HEAD)"

if [[ -n "${RESTORE_BACKUP}" ]]; then
  echo "[INFO] Stopping app services before DB restore..."
  docker compose -f "${COMPOSE_FILE}" stop nginx web api scheduler || true
  scripts/db-restore.sh --compose-file "${COMPOSE_FILE}" --file "${RESTORE_BACKUP}" --yes
fi

echo "[INFO] Building and starting rollback target..."
docker compose -f "${COMPOSE_FILE}" up -d --build --remove-orphans

echo "[INFO] Running runtime preflight..."
scripts/prod-preflight.sh --runtime

HEALTH_ARGS=(--compose-file "${COMPOSE_FILE}" --base-url "${BASE_URL}")
if [[ "${SKIP_SMOKE}" -eq 1 ]]; then
  HEALTH_ARGS+=(--skip-role-smoke --skip-login-smoke)
fi
scripts/prod-health-check.sh "${HEALTH_ARGS[@]}"

mkdir -p .deploy
if [[ -f ".deploy/current_release.env" ]]; then
  cp .deploy/current_release.env .deploy/previous_release.env
fi

cat > .deploy/current_release.env <<EOF
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REF=${REF}
COMMIT=${TARGET_COMMIT}
PREVIOUS_REF=${CURRENT_REF}
PREVIOUS_COMMIT=${CURRENT_COMMIT}
BACKUP_FILE=${RESTORE_BACKUP}
COMPOSE_FILE=${COMPOSE_FILE}
BASE_URL=${BASE_URL}
EOF

echo "[OK] Rollback completed."
echo "Current release: ${REF} (${TARGET_COMMIT})"
echo "Previous release: ${CURRENT_REF} (${CURRENT_COMMIT})"
