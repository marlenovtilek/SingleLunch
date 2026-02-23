'use client'

import { CancelOrderButton } from '@/components/forms/cancel-order-button'
import { PaymentUploadForm } from '@/components/forms/payment-upload-form'
import { orderStatusBadgeClass } from '@/lib/order-status'
import { useCallback, useEffect, useMemo, useState } from 'react'

type OrderItem = {
  menu_option_name: string
  quantity?: number
}

type OrderRow = {
  id?: string
  daily_menu_date: string
  status?: string
  total_amount?: string
  items: OrderItem[]
}

export function OrdersHistoryList({
  orders
}: {
  orders: OrderRow[]
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  )

  const getOrderCardClass = (status?: string) => {
    if (status === 'PAID') {
      return 'border-emerald-200 bg-emerald-50/70'
    }
    if (status === 'AWAITING_PAYMENT') {
      return 'border-amber-200 bg-amber-50/70'
    }
    if (status === 'MISSED_DEADLINE') {
      return 'border-orange-200 bg-orange-50/70'
    }
    if (status === 'CANCELLED') {
      return 'border-rose-200 bg-rose-50/70'
    }
    return 'border-slate-200 bg-white'
  }

  const closeModal = useCallback(() => setSelectedOrderId(null), [])

  useEffect(() => {
    if (!selectedOrder) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedOrder, closeModal])

  return (
    <>
      <div className="space-y-2">
        {orders.map((order, index) => {
          const previewItems = order.items
            .map((item) => `${item.menu_option_name} x${item.quantity ?? 0}`)
            .join(', ')

          return (
            <button
              key={order.id ?? `order-${index}`}
              type="button"
              onClick={() => order.id && setSelectedOrderId(order.id)}
              className={`w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow ${getOrderCardClass(order.status)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Заказ №{index + 1}
                  </p>
                  <p className="mt-1 inline-flex rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700">
                    {new Date(order.daily_menu_date).toLocaleDateString(
                      'ru-RU'
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(order.status ?? 'CANCELLED')}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-700">
                Сумма: {order.total_amount} сом
              </p>
              <p className="mt-2 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600">
                {previewItems || 'Позиции не указаны'}
              </p>
            </button>
          )
        })}
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-2 sm:items-center sm:p-4"
          onMouseDown={closeModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:p-4"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Детали заказа
                </h2>
                <p className="text-xs text-slate-600">
                  {new Date(selectedOrder.daily_menu_date).toLocaleDateString(
                    'ru-RU'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-600">Статус:</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${orderStatusBadgeClass(selectedOrder.status ?? 'CANCELLED')}`}
              >
                {selectedOrder.status}
              </span>
              <span className="ml-auto text-xs text-slate-700">
                Сумма: {selectedOrder.total_amount} сом
              </span>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-xs font-medium text-slate-800">Список блюд</p>
              <ul className="mt-2 space-y-1.5">
                {selectedOrder.items.map((item, index) => (
                  <li
                    key={`${item.menu_option_name}-${index}`}
                    className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-xs"
                  >
                    <span className="text-slate-700">
                      {item.menu_option_name}
                    </span>
                    <span className="font-medium text-slate-900">
                      x{item.quantity ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {selectedOrder.status === 'AWAITING_PAYMENT' && selectedOrder.id ? (
              <div className="mt-3 space-y-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <p className="mb-1 text-xs font-medium text-slate-700">
                      Загрузить скриншот
                    </p>
                    <PaymentUploadForm
                      orderId={selectedOrder.id}
                      onSuccess={closeModal}
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <p className="mb-1 text-xs font-medium text-slate-700">
                      Отмена заказа
                    </p>
                    <CancelOrderButton
                      orderId={selectedOrder.id}
                      onSuccess={closeModal}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
                Для этого статуса действие не требуется.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
