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

Cron/env settings are in `.env.backend`:
- `CRON_TIMEZONE`
- `REMINDER_CRON`
- `MISSED_DEADLINE_CRON`
- `DUTY_REMINDER_CRON`
- `MENU_NEXT_DAY_SWITCH_HOUR`
- `MENU_NEXT_DAY_SWITCH_MINUTE`

Manual reminder run:

```bash
docker compose exec api uv run -- python manage.py send_order_reminders --dry-run
docker compose exec api uv run -- python manage.py send_order_reminders --menu-date 2026-02-24
docker compose exec api uv run -- python manage.py send_order_reminders --menu-date 2026-02-24 --force-resend
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

2. Start production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Check services:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

4. Create superuser:

```bash
docker compose -f docker-compose.prod.yml exec api uv run -- python manage.py createsuperuser
```

## Production preflight

Quick static preflight:

```bash
scripts/prod-preflight.sh
```

Full preflight (with runtime checks against running prod stack):

```bash
scripts/prod-preflight.sh --runtime
```

Detailed step-by-step checklist:
- `PROD_CHECKLIST.md`

## Health and checks

Health endpoint:
- `GET /healthz/`

Django checks:

```bash
docker compose exec api uv run -- python manage.py check
docker compose exec api uv run -- python manage.py check --deploy
```

## Tests and build

Backend tests:

```bash
docker compose exec api uv run -- pytest
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
