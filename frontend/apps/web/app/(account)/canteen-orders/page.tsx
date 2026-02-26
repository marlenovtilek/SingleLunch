import { PaymentScreenshotModal } from '@/components/payment-screenshot-modal'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  addDaysToIsoDate,
  formatIsoDateDdMmYyyy,
  getTodayDateStringBishkek
} from '@/lib/bishkek-date'
import { orderStatusBadgeClass } from '@/lib/order-status'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl
} from '@/lib/server-api'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string | string[] }> }

type CanteenOrderItem = {
  menu_option_name: string
  quantity: number
}

type CanteenOrder = {
  id: string
  employee_username: string
  daily_menu_date: string
  status: string
  total_amount: string
  created_at: string
  payment_screenshot_url?: string | null
  items: CanteenOrderItem[]
}

type ConfirmedItemTotal = {
  menu_option_id: string
  name: string
  total_quantity: number
}

type CanteenOrdersDashboard = {
  date: string
  orders_count: number
  paid_count: number
  awaiting_payment_count: number
  cancelled_count: number
  missed_deadline_count: number
  total_paid_amount: string
  orders: CanteenOrder[]
  confirmed_item_totals: ConfirmedItemTotal[]
}

export default async function CanteenOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const todayDate = getTodayDateStringBishkek()
  const yesterdayDate = addDaysToIsoDate(todayDate, -1)
  const tomorrowDate = addDaysToIsoDate(todayDate, 1)
  const dateParam = params.date
  const selectedDateCandidate = Array.isArray(dateParam)
    ? (dateParam.at(-1) ?? '')
    : (dateParam ?? '')
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDateCandidate)
    ? selectedDateCandidate
    : todayDate
  const { session, user: me } = await getCurrentUserOrRedirect()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    return (
      <section className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">
          Заказы столовой
        </h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {API_URL_NOT_CONFIGURED_MESSAGE}
        </div>
      </section>
    )
  }

  let dashboard: CanteenOrdersDashboard | null = null
  let errorMessage = ''

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/v1/canteen/orders/?date=${selectedDate}`,
      {
        method: 'GET',
        headers: buildServerApiHeaders({ session }),
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return redirect('/login')
      }
      throw new Error(`HTTP ${response.status}`)
    }
    dashboard = (await response.json()) as CanteenOrdersDashboard
  } catch {
    errorMessage = 'Не удалось загрузить заказы.'
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">
          История заказов
        </h1>
        <p className="text-xs text-slate-600">
          Только чтение: сводка по заказам на выбранную дату.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`?date=${yesterdayDate}`}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              selectedDate === yesterdayDate
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Вчера ({formatIsoDateDdMmYyyy(yesterdayDate)})
          </Link>
          <Link
            href={`?date=${todayDate}`}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              selectedDate === todayDate
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Сегодня ({formatIsoDateDdMmYyyy(todayDate)})
          </Link>
          <Link
            href={`?date=${tomorrowDate}`}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              selectedDate === tomorrowDate
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Завтра ({formatIsoDateDdMmYyyy(tomorrowDate)})
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      {dashboard && (
        <>
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
            <article className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-xs text-slate-500">Всего</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {dashboard.orders_count}
              </p>
            </article>
            <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
              <p className="text-xs text-emerald-700">Оплачено</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-900">
                {dashboard.paid_count}
              </p>
            </article>
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs text-amber-700">Ожидает оплаты</p>
              <p className="mt-0.5 text-sm font-semibold text-amber-900">
                {dashboard.awaiting_payment_count}
              </p>
            </article>
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="text-xs text-slate-700">Отменено</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {dashboard.cancelled_count}
              </p>
            </article>
            <article className="rounded-lg border border-rose-200 bg-rose-50 p-2">
              <p className="text-xs text-rose-700">Пропущен срок</p>
              <p className="mt-0.5 text-sm font-semibold text-rose-900">
                {dashboard.missed_deadline_count}
              </p>
            </article>
            <article className="rounded-lg border border-indigo-200 bg-indigo-50 p-2">
              <p className="text-xs text-indigo-700">Сумма оплаченных</p>
              <p className="mt-0.5 text-sm font-semibold text-indigo-900">
                {dashboard.total_paid_amount} сом
              </p>
            </article>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Подтвержденные позиции (оплачено)
            </h2>
            {dashboard.confirmed_item_totals.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Нет оплаченных позиций.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {dashboard.confirmed_item_totals.map((item) => (
                  <li
                    key={item.menu_option_id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-slate-700">{item.name}</span>
                    <span className="font-semibold text-slate-900">
                      {item.total_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {dashboard.orders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-sm">
              Заказов на выбранную дату нет.
            </div>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {dashboard.orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                  >
                    {order.payment_screenshot_url ? (
                      <PaymentScreenshotModal
                        url={order.payment_screenshot_url}
                        alt={`Скрин оплаты заказа ${order.id}`}
                        className="block w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {order.employee_username}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                          <span>
                            {formatIsoDateDdMmYyyy(order.daily_menu_date)}
                          </span>
                          <span className="font-medium">
                            {order.total_amount} сом
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                          {order.items
                            .map(
                              (item) =>
                                `${item.menu_option_name} x${item.quantity}`
                            )
                            .join(', ')}
                        </p>
                      </PaymentScreenshotModal>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900">
                            {order.employee_username}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                          <span>
                            {formatIsoDateDdMmYyyy(order.daily_menu_date)}
                          </span>
                          <span className="font-medium">
                            {order.total_amount} сом
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                          {order.items
                            .map(
                              (item) =>
                                `${item.menu_option_name} x${item.quantity}`
                            )
                            .join(', ')}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Скрин оплаты не прикреплен
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="min-w-[760px] divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Сотрудник
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Дата меню
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Статус
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Сумма
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Скрин оплаты
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">
                        Позиции
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboard.orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 text-slate-900">
                          {order.employee_username}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatIsoDateDdMmYyyy(order.daily_menu_date)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {order.total_amount} сом
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {order.payment_screenshot_url ? (
                            <a
                              href={order.payment_screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-sky-700 underline hover:text-sky-900"
                            >
                              Открыть
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {order.items
                            .map(
                              (item) =>
                                `${item.menu_option_name} x${item.quantity}`
                            )
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
