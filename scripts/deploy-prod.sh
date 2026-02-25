#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="docker-compose.prod.yml"
REF=""
BASE_URL=""
SKIP_BACKUP=0
SKIP_RESTORE_CHECK=0
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
Usage: scripts/deploy-prod.sh [options]

Options:
  --ref TAG                git tag to deploy. Default: latest local tag.
  --compose-file FILE      docker-compose file (default: docker-compose.prod.yml)
  --base-url URL           URL for health checks (default from NEXTAUTH_URL or http://127.0.0.1:18080)
  --skip-backup            skip DB backup
  --skip-restore-check     skip backup restore verification
  --skip-smoke             skip smoke checks (role/login)
  --allow-dirty            allow deployment from dirty git tree
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REF="${2:-}"
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
    --skip-backup)
      SKIP_BACKUP=1
      shift
      ;;
    --skip-restore-check)
      SKIP_RESTORE_CHECK=1
      shift
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

echo "[INFO] Fetching latest tags from origin..."
git fetch --tags --prune origin

if [[ -z "${REF}" ]]; then
  REF="$(git for-each-ref --sort=-creatordate --format='%(refname:short)' refs/tags | head -n1)"
fi

if [[ -z "${REF}" ]]; then
  echo "No tags found. Create release tag first (example: v2026.02.25-1)." >&2
  exit 1
fi

if ! git rev-parse -q --verify "refs/tags/${REF}" >/dev/null; then
  echo "Tag not found: ${REF}" >&2
  exit 1
fi

if [[ "${ALLOW_DIRTY}" -ne 1 ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Git tree is dirty. Commit/stash changes or use --allow-dirty." >&2
    git status --short
    exit 1
  fi
fi

PREV_COMMIT="$(git rev-parse HEAD)"
PREV_REF="$(git describe --tags --exact-match 2>/dev/null || echo "${PREV_COMMIT}")"

echo "[INFO] Checking out tag ${REF}..."
git checkout --detach "refs/tags/${REF}"
TARGET_COMMIT="$(git rev-parse HEAD)"
echo "[OK] Deploy target commit: ${TARGET_COMMIT}"

echo "[INFO] Running static preflight..."
scripts/prod-preflight.sh

BACKUP_FILE=""
if [[ "${SKIP_BACKUP}" -eq 0 ]]; then
  BACKUP_FILE="$(scripts/db-backup.sh --compose-file "${COMPOSE_FILE}" --print-path-only)"
  echo "[OK] Backup file: ${BACKUP_FILE}"

  if [[ "${SKIP_RESTORE_CHECK}" -eq 0 ]]; then
    scripts/db-restore-check.sh --compose-file "${COMPOSE_FILE}" --file "${BACKUP_FILE}"
  else
    echo "[INFO] Restore check skipped."
  fi
else
  echo "[WARN] Backup skipped."
fi

echo "[INFO] Building and starting services..."
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
PREVIOUS_REF=${PREV_REF}
PREVIOUS_COMMIT=${PREV_COMMIT}
BACKUP_FILE=${BACKUP_FILE}
COMPOSE_FILE=${COMPOSE_FILE}
BASE_URL=${BASE_URL}
EOF

echo "[OK] Deployment completed."
echo "Current release: ${REF} (${TARGET_COMMIT})"
echo "Previous release: ${PREV_REF} (${PREV_COMMIT})"
if [[ -n "${BACKUP_FILE}" ]]; then
  echo "Backup: ${BACKUP_FILE}"
fi
echo "Rollback command: scripts/rollback-prod.sh --compose-file ${COMPOSE_FILE}"
