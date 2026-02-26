# SingleLunch

SingleLunch is a lunch ordering system with 3 roles:
- `EMPLOYEE` — sees daily menu, creates/cancels orders, uploads payment screenshot.
- `CANTEEN` — creates/edits menu, sees all orders, manages QR and duty schedule.
- `ADMIN` — all canteen abilities + user activation and Django admin access.

Stack:
- Backend: Django + DRF + SimpleJWT
- Frontend: Next.js 16 + NextAuth
- DB: PostgreSQL
- Background jobs: cron-based `scheduler` service

## Local start

1. Create env files:

```bash
cp .env.backend.template .env.backend
cp .env.frontend.template .env.frontend
```

2. Fill minimum required values:
- `.env.backend`: `DEBUG=True`, `SECRET_KEY`, postgres vars
- `.env.frontend`: `NEXTAUTH_SECRET`

3. Start:

```bash
docker compose up --build
```

If frontend loads without styles, recreate only `web` once:

```bash
docker compose up -d --force-recreate web
```

Then do hard refresh in browser (`Ctrl+Shift+R`).

4. Open:
- Web: `http://localhost:3000`
- API: `http://localhost:8765`
- Admin (proxy): `http://localhost:3000/admin`
- Admin (direct): `http://localhost:8765/admin`

## LAN / phone access

If local IP changed, sync env automatically:

```bash
python3 scripts/sync_local_ip_env.py
# or
./scripts/dev-up.sh
```

Script updates:
- `.env.frontend`: `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DJANGO_PUBLIC_URL`, `ALLOWED_DEV_ORIGINS`
- `.env.backend`: `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`

## Environment files

Only 4 files are used:
- `.env.backend`
- `.env.backend.template`
- `.env.frontend`
- `.env.frontend.template`

## Reminders and scheduler

Scheduler service runs:
- `mark_missed_deadline_orders`
- `send_order_reminders`
- `send_duty_reminders`
- `cleanup_payment_screenshots --days $PAYMENT_SCREENSHOT_RETENTION_DAYS`

Cron/env settings are in `.env.backend`:
- `CRON_TIMEZONE`
- `REMINDER_CRON`
- `MISSED_DEADLINE_CRON`
- `DUTY_REMINDER_CRON`
- `PAYMENT_SCREENSHOT_CLEANUP_CRON`
- `PAYMENT_SCREENSHOT_RETENTION_DAYS`
- `MENU_NEXT_DAY_SWITCH_HOUR`
- `MENU_NEXT_DAY_SWITCH_MINUTE`

`MENU_NEXT_DAY_SWITCH_HOUR/MINUTE` define when employees switch from today's menu to the next business-day menu (default: `12:00` Asia/Bishkek).

Manual reminder run:

```bash
docker compose exec api /.venv/bin/python manage.py send_order_reminders --dry-run
docker compose exec api /.venv/bin/python manage.py send_order_reminders --menu-date 2026-02-24
docker compose exec api /.venv/bin/python manage.py send_order_reminders --menu-date 2026-02-24 --force-resend
docker compose exec api /.venv/bin/python manage.py cleanup_payment_screenshots --days 7 --dry-run
docker compose exec api /.venv/bin/python manage.py cleanup_payment_screenshots --days 7
```

## Notifications setup

Backend integrations (`.env.backend`):
- `TELEGRAM_BOT_TOKEN`
- `MATTERMOST_BASE_URL`
- `MATTERMOST_BOT_TOKEN`
- `FRONTEND_BASE_URL`

User profile fields:
- `telegram_id`
- `mattermost_id`

## Production start

1. Fill production-safe env values:
- `.env.backend`: `DEBUG=False`, strong `SECRET_KEY`, real hosts/origins, secure postgres password
- `.env.frontend`: real public URLs, strong `NEXTAUTH_SECRET`

2. Create release tag and push it:

```bash
git tag v2026.02.25-1
git push origin v2026.02.25-1
```

3. On server deploy by tag:

```bash
git fetch --tags --prune origin
./scripts/deploy-prod.sh --ref v2026.02.25-1
```

4. Check services:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

5. Create superuser:

```bash
docker compose -f docker-compose.prod.yml exec api /.venv/bin/python manage.py createsuperuser
```

### Nginx topology

`docker-compose.prod.yml` binds container nginx to `127.0.0.1:18080` by default.

- Recommended: external host nginx (80/443) proxies to `127.0.0.1:18080`.
- If you need direct binding, override:

```bash
NGINX_BIND_HOST=0.0.0.0 NGINX_BIND_PORT=80 docker compose -f docker-compose.prod.yml up -d --build
```

### GitHub auto deploy

Workflow `.github/workflows/deploy-prod.yml` deploys on tag `v*` (or manual run).

Required GitHub Secrets:
- `PROD_SSH_HOST`
- `PROD_SSH_PORT` (optional, default `22`)
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_APP_PATH` (path to repo on server)

## Production preflight

Quick static preflight:

```bash
scripts/prod-preflight.sh
```

Full preflight (with runtime checks against running prod stack):

```bash
scripts/prod-preflight.sh --runtime
```

Post-deploy health + role smoke:

```bash
scripts/prod-health-check.sh --base-url https://lunch.trade.kg
```

Optional login smoke with real credentials:

```bash
SMOKE_LOGIN_USERNAME=demo SMOKE_LOGIN_PASSWORD=demo123 \
scripts/prod-health-check.sh --base-url https://lunch.trade.kg
```

## Backup / restore

Create backup:

```bash
scripts/db-backup.sh --compose-file docker-compose.prod.yml
```

Check restore viability into temporary DB:

```bash
scripts/db-restore-check.sh --compose-file docker-compose.prod.yml --file backups/postgres/<file>.sql.gz
```

Restore (destructive):

```bash
scripts/db-restore.sh --compose-file docker-compose.prod.yml --file backups/postgres/<file>.sql.gz --yes
```

Rollback release:

```bash
scripts/rollback-prod.sh --compose-file docker-compose.prod.yml
```

Detailed step-by-step checklist:
- `PROD_CHECKLIST.md`

## Health and checks

Health endpoint:
- `GET /healthz/`

Django checks:

```bash
docker compose exec api /.venv/bin/python manage.py check
docker compose exec api /.venv/bin/python manage.py check --deploy
```

## Tests and build

Backend tests:

```bash
docker compose exec api /.venv/bin/pytest
```

Frontend lint/build:

```bash
docker compose exec web sh -lc "pnpm --filter web lint"
docker compose exec web sh -lc "pnpm --filter web build"
```

Role smoke test (permissions and core flows for `ADMIN`/`CANTEEN`/`EMPLOYEE`):

```bash
scripts/role-smoke.sh
```

Options:
- `--compose-file docker-compose.prod.yml`
- `--keep-data` (leave temporary smoke records)

## API schema and types

Swagger:
- `http://localhost:8765/api/schema/swagger-ui/`

If API contract changed, regenerate frontend API types:

```bash
docker compose exec web sh -lc "pnpm openapi:generate"
```
