import { OrdersHistoryList } from '@/components/orders-history-list'
import { QrPreview } from '@/components/qr-preview'
import { getCurrentUserOrRedirect, isCanteenUser } from '@/lib/account'
import { getBranding } from '@/lib/branding'
import { ApiError } from '@frontend/types/api'
import { redirect } from 'next/navigation'

export default async function OrdersHistoryPage() {
  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  if (isCanteenUser(me) || me.is_staff || me.is_superuser) {
    return redirect('/canteen-orders')
  }

  const branding = await getBranding()

  let orders: Awaited<
    ReturnType<typeof apiClient.v1.v1OrdersMyList>
  >['results'] = []
  let errorMessage = ''

  try {
    const response = await apiClient.v1.v1OrdersMyList()
    orders = response.results
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirect('/login')
    }

    if (error instanceof ApiError) {
      errorMessage = 'Не удалось загрузить историю заказов.'
    }
  }

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-2.5">
        <p className="text-xs font-medium text-cyan-900">QR для оплаты</p>
        <p className="mt-0.5 text-[11px] text-cyan-800">
          После загрузки скриншота статус заказа меняется на «Оплачен»
          автоматически.
        </p>
        {branding.paymentQrUrl ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <img
              src={branding.paymentQrUrl}
              alt="Единый QR для оплаты"
              className="h-20 w-20 rounded-md border border-cyan-200 bg-white object-contain"
            />
            <QrPreview
              url={branding.paymentQrUrl}
              alt="Единый QR для оплаты"
              downloadName="singlelunch-payment-qr.png"
            />
          </div>
        ) : (
          <p className="mt-1 text-xs text-amber-700">
            QR пока не загружен. Свяжись с представителем столовой.
          </p>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">
          История заказов
        </h1>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
          Заказов пока нет.
        </div>
      ) : (
        <OrdersHistoryList orders={orders} />
      )}
    </section>
  )
}
