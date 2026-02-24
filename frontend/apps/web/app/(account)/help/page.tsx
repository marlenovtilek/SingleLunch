import { getCurrentUserOrRedirect } from '@/lib/account'
import { getBranding } from '@/lib/branding'
import type { Metadata } from 'next'

type GuideSection = {
  title: string
  steps: string[]
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding()

  return {
    title: `Инструкция - ${branding.projectName}`
  }
}

function sectionsForRole(role: string, isAdmin: boolean): GuideSection[] {
  if (isAdmin) {
    return [
      {
        title: 'Ежедневная работа',
        steps: [
          'Открой «Создать меню», выбери дату и дедлайн, добавь блюда и сохрани меню.',
          'Проверь итог в разделе «Меню» и убедись, что меню активно для сотрудников.',
          'При необходимости обнови единый QR и цену порции в разделе «QR Код».'
        ]
      },
      {
        title: 'Контроль и управление',
        steps: [
          'В разделе «Все заказы» проверяй статусы и скриншоты оплат по каждому сотруднику.',
          'В разделе «Список меню» открывай детали меню и редактируй только актуальные даты.',
          'В разделе «Пользователи» активируй новые регистрации и проверяй роли.'
        ]
      },
      {
        title: 'Дополнительно',
        steps: [
          'В разделе «Дежурство» назначай ответственных на рабочие дни.',
          'Если меню уже имеет заказы, удаление меню будет недоступно.',
          'После дедлайна изменения в заказах сотрудников автоматически ограничиваются.'
        ]
      }
    ]
  }

  if (role === 'CANTEEN') {
    return [
      {
        title: 'Ежедневная работа',
        steps: [
          'Создай меню в разделе «Создать меню»: дата, дедлайн и позиции.',
          'Обнови QR и цену порции в разделе «QR Код», если поменялись реквизиты оплаты.',
          'Проверь видимость меню для сотрудников в разделе «Меню».'
        ]
      },
      {
        title: 'Контроль заказов',
        steps: [
          'Открой «Все заказы» и отфильтруй нужную дату.',
          'Проверь статусы заказов и скриншоты оплат по каждому сотруднику.',
          'Используй «Список меню» для просмотра и редактирования только доступных дат.'
        ]
      }
    ]
  }

  return [
    {
      title: 'Как сделать заказ',
      steps: [
        'Открой «Меню» и выбери количество по каждому блюду кнопками «+» и «-».',
        'Нажми «К подтверждению» и проверь состав перед отправкой.',
        'После создания заказа открой «Мои заказы» и зайди в детали нужного заказа.'
      ]
    },
    {
      title: 'Оплата',
      steps: [
        'Оплати по QR, который отображается над списком заказов.',
        'В деталях заказа прикрепи скриншот оплаты.',
        'После загрузки скриншота статус заказа меняется на «PAID».'
      ]
    },
    {
      title: 'Если нужно изменить заказ',
      steps: [
        'До дедлайна можно отменить заказ и оформить новый.',
        'После дедлайна изменения блокируются автоматически.',
        'Проверь итоговый статус в «Мои заказы».'
      ]
    }
  ]
}

export default async function HelpPage() {
  const { session, user } = await getCurrentUserOrRedirect()
  const branding = await getBranding()
  const isAdmin = Boolean(session.user.is_staff || session.user.is_superuser)
  const roleLabel = isAdmin
    ? 'Администратор'
    : user.role === 'CANTEEN'
      ? 'Представитель столовой'
      : 'Сотрудник'

  const roleSections = sectionsForRole(user.role, isAdmin)

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4">
        <h1 className="text-lg font-semibold text-slate-900">
          Как пользоваться {branding.projectName}
        </h1>
        <p className="mt-1 text-xs text-slate-700">
          Текущая роль: <span className="font-semibold">{roleLabel}</span>
        </p>
      </header>

      {roleSections.map((section) => (
        <article
          key={section.title}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            {section.title}
          </h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-slate-700">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      ))}

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Статусы заказа</h2>
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
            Для уведомлений заполни в профиле Telegram ID и/или Mattermost ID.
          </li>
          <li>
            Если не видно новые данные после изменений, обнови страницу вручную.
          </li>
        </ul>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">FAQ</h2>
        <ul className="mt-2 space-y-2 text-xs text-slate-700">
          <li>
            <span className="font-semibold">
              Почему не приходит уведомление в Telegram/Mattermost?
            </span>
            <br />
            1) В «Личном кабинете» заполни корректный `telegram_id` и/или
            `mattermost_id`.
            <br />
            2) Открой диалог с ботом заранее: в Telegram нажми Start, в
            Mattermost бот должен иметь доступ к личным сообщениям.
            <br />
            3) Проверь, что вводишь именно свой ID (не username и не ссылку на
            профиль).
            <br />
            4) Если после этого уведомлений нет — обратись к администратору
            системы для проверки настроек интеграций и логов отправки.
          </li>
          <li>
            <span className="font-semibold">
              Почему меню нельзя редактировать?
            </span>
            <br />
            После наступления даты меню или при бизнес-ограничениях
            редактирование блокируется. Для прошедших дат доступен только
            просмотр.
          </li>
          <li>
            <span className="font-semibold">
              Почему не удается создать заказ?
            </span>
            <br />
            Обычно причина — дедлайн уже прошел для выбранной даты меню.
          </li>
          <li>
            <span className="font-semibold">
              Почему не открывается редактирование/удаление меню?
            </span>
            <br />
            Если по меню уже есть заказы, удаление блокируется. Используй
            просмотр и актуализируй следующее меню.
          </li>
          <li>
            <span className="font-semibold">
              Почему после действий данные не сразу обновились?
            </span>
            <br />
            Обнови страницу вручную. Часть данных загружается по API и может
            обновляться не мгновенно.
          </li>
        </ul>
      </article>
    </section>
  )
}
