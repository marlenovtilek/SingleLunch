# SingleLunch Prod Checklist

## 1) Перед деплоем

- [ ] Актуальная ветка и чистый diff для релиза.
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
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

## 4) Инициализация после старта

- [ ] Создан superuser:

```bash
docker compose -f docker-compose.prod.yml exec api uv run -- python manage.py createsuperuser
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

## 5) Пост-деплой

- [ ] Включен мониторинг логов `api`, `web`, `scheduler`.
- [ ] Проверена регулярная работа cron задач в `scheduler`.
- [ ] Сделан backup plan PostgreSQL.
- [ ] Зафиксирована дата релиза и ревизия (commit/tag).
