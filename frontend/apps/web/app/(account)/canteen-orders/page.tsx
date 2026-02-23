import { QrPreview } from '@/components/qr-preview'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import { getTodayDateStringBishkek } from '@/lib/bishkek-date'
import { orderStatusBadgeClass } from '@/lib/order-status'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string }> }

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
  const selectedDate = params.date ?? getTodayDateStringBishkek()
  const { session, user: me } = await getCurrentUserOrRedirect()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return (
      <section className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">
          Заказы столовой
        </h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          API_URL не настроен.
        </div>
      </section>
    )
  }

  let dashboard: CanteenOrdersDashboard | null = null
  let errorMessage = ''

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/canteen/orders/?date=${selectedDate}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        },
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

      <form
        method="get"
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="space-y-1">
          <label
            htmlFor="canteen-orders-date"
            className="block text-xs font-medium text-slate-700"
          >
            Дата
          </label>
          <input
            id="canteen-orders-date"
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="block w-full max-w-xs rounded-md border border-slate-300 px-2.5 py-1.5 text-xs outline-none ring-slate-900/10 focus:ring"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          Показать
        </button>
      </form>

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
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <p className="text-xs text-slate-500">Сотрудник</p>
                    <p className="text-xs font-medium text-slate-900">
                      {order.employee_username}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Статус</p>
                    <p className="mt-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Дата меню</p>
                    <p className="text-xs text-slate-700">
                      {new Date(order.daily_menu_date).toLocaleDateString(
                        'ru-RU'
                      )}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Сумма</p>
                    <p className="text-xs text-slate-700">
                      {order.total_amount} сом
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Позиции</p>
                    <p className="text-xs text-slate-700">
                      {order.items
                        .map(
                          (item) => `${item.menu_option_name} x${item.quantity}`
                        )
                        .join(', ')}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Скрин оплаты</p>
                    {order.payment_screenshot_url ? (
                      <QrPreview
                        url={order.payment_screenshot_url}
                        alt={`Скрин оплаты заказа ${order.id}`}
                        allowDownload={false}
                        openLabel="Открыть скрин"
                      />
                    ) : (
                      <p className="text-xs text-slate-400">—</p>
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
                          {new Date(order.daily_menu_date).toLocaleDateString(
                            'ru-RU'
                          )}
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
                            <QrPreview
                              url={order.payment_screenshot_url}
                              alt={`Скрин оплаты заказа ${order.id}`}
                              allowDownload={false}
                              openLabel="Открыть скрин"
                            />
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
