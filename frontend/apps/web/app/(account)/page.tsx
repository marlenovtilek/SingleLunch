import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

function statToneClass(tone: 'neutral' | 'warning' | 'success') {
  if (tone === 'warning') {
    return 'bg-amber-50 text-amber-900'
  }

  if (tone === 'success') {
    return 'bg-emerald-50 text-emerald-900'
  }

  return 'bg-slate-50 text-slate-900'
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return redirect('/login')
  }

  const apiClient = await getApiClient(session)
  let orders: Awaited<ReturnType<typeof apiClient.v1.v1OrdersMyList>>
  try {
    orders = await apiClient.v1.v1OrdersMyList()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirect('/login')
    }
    throw error
  }
  const awaitingPaymentCount = orders.results.filter(
    (order) => order.status === 'AWAITING_PAYMENT'
  ).length
  const paidCount = orders.results.filter(
    (order) => order.status === 'PAID'
  ).length
  const stats = [
    {
      label: 'Всего заказов',
      value: String(orders.count),
      tone: 'neutral' as const
    },
    {
      label: 'Ожидает оплаты',
      value: String(awaitingPaymentCount),
      tone: 'warning' as const
    },
    {
      label: 'Оплачено',
      value: String(paidCount),
      tone: 'success' as const
    }
  ]

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Обзор кабинета</h1>
        <p className="max-w-2xl text-xs text-slate-600">
          Сводка формируется на основе твоих заказов из API.
        </p>
      </header>

      <div className="grid gap-2 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className={`rounded-xl border border-slate-200 p-2.5 ${statToneClass(stat.tone)}`}
          >
            <p className="text-xs opacity-80">{stat.label}</p>
            <p className="mt-1 text-base font-semibold">{stat.value}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
