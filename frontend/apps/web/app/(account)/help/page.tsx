import { getCurrentUserOrRedirect } from '@/lib/account'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Инструкция - SingleLunch'
}

function stepsForRole(role: string, isAdmin: boolean): string[] {
  if (isAdmin) {
    return [
      'Открой «Создать меню» и заполни позиции на нужную дату.',
      'При необходимости загрузи единый QR в разделе «QR Код».',
      'Проверь «Все заказы» и «Меню на сегодня».',
      'Назначь дежурных в разделе «Дежурство».'
    ]
  }

  if (role === 'CANTEEN') {
    return [
      'В разделе «Создать меню» добавь меню на дату и дедлайн.',
      'В разделе «QR Код» загрузи реквизиты оплаты (QR).',
      'Проверь, как выглядит меню, в «Меню на сегодня».',
      'Следи за статусами заказов в «Все заказы».'
    ]
  }

  return [
    'Открой «Меню на сегодня» и выбери нужные блюда.',
    'Нажми «К подтверждению» и создай заказ.',
    'Открой «Мои заказы», оплати по QR и загрузи скриншот.',
    'Проверь статус заказа: AWAITING_PAYMENT → PAID.'
  ]
}

export default async function HelpPage() {
  const { session, user } = await getCurrentUserOrRedirect()
  const isAdmin = Boolean(session.user.is_staff || session.user.is_superuser)
  const roleLabel = isAdmin
    ? 'Администратор'
    : user.role === 'CANTEEN'
      ? 'Представитель столовой'
      : 'Сотрудник'

  const roleSteps = stepsForRole(user.role, isAdmin)

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
        <h1 className="text-lg font-semibold text-slate-900">
          Как пользоваться SingleLunch
        </h1>
        <p className="mt-1 text-xs text-slate-700">
          Текущая роль: <span className="font-semibold">{roleLabel}</span>
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Твои шаги</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-slate-700">
          {roleSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Статусы заказа (для сотрудников)
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
          <li>
            <span className="font-semibold">AWAITING_PAYMENT</span> — заказ
            создан, ожидается скриншот оплаты.
          </li>
          <li>
            <span className="font-semibold">PAID</span> — скриншот загружен,
            заказ подтвержден.
          </li>
          <li>
            <span className="font-semibold">CANCELLED</span> — заказ отменен
            пользователем.
          </li>
          <li>
            <span className="font-semibold">MISSED_DEADLINE</span> — дедлайн
            оплаты прошел.
          </li>
        </ul>
      </article>

      <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">Важно</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-amber-900">
          <li>Заказы доступны только до дедлайна, указанного в меню.</li>
          <li>
            Уведомления в Telegram/Mattermost приходят только при заполненном
            ID.
          </li>
          <li>Если что-то не отображается, обнови страницу после входа.</li>
        </ul>
      </article>
    </section>
  )
}
