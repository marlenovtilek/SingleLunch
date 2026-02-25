# SingleLunch Prod Checklist

## 1) Перед деплоем

- [ ] Актуальная ветка и чистый diff для релиза.
- [ ] Создан релизный tag (например `v2026.02.25-1`).
- [ ] Заполнены `.env.backend` и `.env.frontend`.
- [ ] `DEBUG=False` в `.env.backend`.
- [ ] Реальные и безопасные `SECRET_KEY` и `NEXTAUTH_SECRET`.
- [ ] Настроены `ALLOWED_HOSTS` и `CSRF_TRUSTED_ORIGINS`.
- [ ] Настроены `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DJANGO_PUBLIC_URL`.
- [ ] Настроены токены интеграций (если нужны): Telegram / Mattermost.

## 2) Preflight (одной командой)

```bash
scripts/prod-preflight.sh
```

Полный режим (включая runtime-проверки внутри запущенного prod stack):

```bash
scripts/prod-preflight.sh --runtime
```

## 3) Запуск прод-стека

```bash
git fetch --tags --prune origin
./scripts/deploy-prod.sh --ref <tag>
```

## 4) Инициализация после старта

- [ ] Создан superuser:

```bash
docker compose -f docker-compose.prod.yml exec api /.venv/bin/python manage.py createsuperuser
```

- [ ] Проверена админка `/admin`.
- [ ] Проверены роли: `ADMIN`, `CANTEEN`, `EMPLOYEE`.
- [ ] Проверены базовые сценарии:
  - [ ] Создание/редактирование меню.
  - [ ] Заказ сотрудника + загрузка скрина.
  - [ ] Просмотр заказов у кантина.
  - [ ] Уведомления (Telegram/Mattermost).

- [ ] Прогнан role smoke тест:

```bash
scripts/role-smoke.sh
```

## 5) Backup / restore

- [ ] Перед деплоем создан backup БД.
- [ ] Проверен restore-check backup (временная БД).

```bash
scripts/db-backup.sh --compose-file docker-compose.prod.yml
scripts/db-restore-check.sh --compose-file docker-compose.prod.yml --file backups/postgres/<file>.sql.gz
```

## 6) Rollback plan

- [ ] Проверена команда rollback до предыдущего релиза:

```bash
scripts/rollback-prod.sh --compose-file docker-compose.prod.yml
```

## 7) Пост-деплой

- [ ] Включен мониторинг логов `api`, `web`, `scheduler`.
- [ ] Проверена регулярная работа cron задач в `scheduler`.
- [ ] Сделан backup plan PostgreSQL.
- [ ] Зафиксирована дата релиза и ревизия (commit/tag).
