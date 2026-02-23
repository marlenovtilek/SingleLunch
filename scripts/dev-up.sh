#!/usr/bin/env bash
set -euo pipefail

python3 scripts/sync_local_ip_env.py

docker compose up --build
