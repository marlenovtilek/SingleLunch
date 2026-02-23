'use client'

import {
  type CreateOrderResult,
  createOrderAction
} from '@/actions/create-order-action'
import {
  type UploadPaymentResult,
  uploadPaymentAction
} from '@/actions/upload-payment-action'
import { QrPreview } from '@/components/qr-preview'
import type { TodayMenu } from '@frontend/types/api'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

type QuantitiesState = Record<string, number>

export function CreateOrderForm({
  menu,
  paymentQrUrl
}: {
  menu: TodayMenu
  paymentQrUrl: string | null
}) {
  const router = useRouter()
  const [isCreatingOrder, startCreateOrderTransition] = useTransition()
  const [isUploadingPayment, startUploadPaymentTransition] = useTransition()
  const [quantities, setQuantities] = useState<QuantitiesState>({})
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null)
  const [submitResult, setSubmitResult] = useState<CreateOrderResult | null>(
    null
  )
  const [infoMessage, setInfoMessage] = useState('')
  const [paymentResult, setPaymentResult] =
    useState<UploadPaymentResult | null>(null)
  const effectivePaymentQrUrl = paymentQrUrl ?? menu.payment_qr_url ?? null

  const renderQuantityControls = (
    optionId: string | undefined,
    quantity: number
  ) => (
    <div className="mt-1 flex items-center gap-1">
      <button
        type="button"
        disabled={
          !menu.can_order ||
          !optionId ||
          isCreatingOrder ||
          isUploadingPayment ||
          quantity === 0
        }
        onClick={() => optionId && setQuantity(optionId, quantity - 1)}
        className="h-7 w-7 rounded-md border border-slate-300 bg-white text-sm font-semibold leading-none text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        -
      </button>
      <div className="flex h-7 min-w-9 items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-900">
        {quantity}
      </div>
      <button
        type="button"
        disabled={
          !menu.can_order || !optionId || isCreatingOrder || isUploadingPayment
        }
        onClick={() => optionId && setQuantity(optionId, quantity + 1)}
        className="h-7 w-7 rounded-md border border-slate-300 bg-white text-sm font-semibold leading-none text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>
    </div>
  )

  const total = useMemo(() => {
    return menu.options.reduce((acc, option) => {
      const optionId = option.id
      if (!optionId) {
        return acc
      }
      const quantity = quantities[optionId] ?? 0
      const price = Number(option.price ?? 0)
      return acc + quantity * price
    }, 0)
  }, [menu.options, quantities])

  const selectedItemsCount = useMemo(() => {
    return Object.values(quantities).filter((quantity) => quantity > 0).length
  }, [quantities])

  const selectedItems = useMemo(() => {
    return menu.options
      .filter((option) => option.id)
      .map((option) => {
        const optionId = option.id as string
        const quantity = quantities[optionId] ?? 0
        return {
          id: optionId,
          name: option.name,
          quantity,
          price: Number(option.price ?? 0),
          lineTotal: Number(option.price ?? 0) * quantity
        }
      })
      .filter((item) => item.quantity > 0)
  }, [menu.options, quantities])

  const setQuantity = (optionId: string, quantity: number) => {
    setQuantities((prev) => ({
      ...prev,
      [optionId]: Math.max(0, quantity)
    }))
  }

  const submitOrder = () => {
    startCreateOrderTransition(async () => {
      const result = await createOrderAction({
        dailyMenuId: menu.id,
        items: selectedItems.map((item) => ({
          menuOptionId: item.id,
          quantity: item.quantity
        }))
      })
      setSubmitResult(result)
      if (result.ok) {
        setQuantities({})
        setIsConfirmOpen(false)
        setPaymentResult(null)
        setCreatedOrderId(result.orderId ?? null)
        setInfoMessage(
          'Заказ создан. Теперь загрузи скриншот оплаты в модальном окне.'
        )
        if (result.orderId) {
          setIsPaymentModalOpen(true)
        }
      }
      router.refresh()
    })
  }

  const uploadPaymentNow = (formData: FormData) => {
    if (!createdOrderId) {
      return
    }

    startUploadPaymentTransition(async () => {
      const result = await uploadPaymentAction(createdOrderId, formData)
      setPaymentResult(result)
      if (result.ok) {
        setIsPaymentModalOpen(false)
        setCreatedOrderId(null)
        setInfoMessage('Скриншот загружен. Заказ отмечен как оплаченный.')
        router.push('/orders-history')
      }
    })
  }

  const openConfirm = () => {
    if (selectedItems.length === 0) {
      setSubmitResult({ ok: false, message: 'Выбери хотя бы одно блюдо.' })
      return
    }
    setSubmitResult(null)
    setInfoMessage('')
    setIsConfirmOpen(true)
  }

  useEffect(() => {
    if (!isConfirmOpen && !isPaymentModalOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isConfirmOpen, isPaymentModalOpen])

  return (
    <div className="space-y-3">
      {!menu.can_order && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          Заказ сейчас недоступен: дедлайн уже прошел.
        </div>
      )}

      {submitResult?.ok === false && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {submitResult.message}
        </div>
      )}

      {infoMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
          {infoMessage}
        </div>
      )}

      <div className="space-y-1.5 md:hidden">
        {menu.options.map((item, index) => {
          const optionId = item.id ?? `option-${index}`
          const quantity = item.id ? (quantities[item.id] ?? 0) : 0
          return (
            <article
              key={optionId}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-xs font-semibold text-slate-900">
                    {item.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">{item.price} сом</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium text-slate-500">
                    Кол-во
                  </p>
                  {renderQuantityControls(item.id, quantity)}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden gap-2.5 md:grid md:grid-cols-2 xl:grid-cols-3">
        {menu.options.map((item, index) => {
          const optionId = item.id ?? `option-${index}`
          const quantity = item.id ? (quantities[item.id] ?? 0) : 0
          return (
            <article
              key={optionId}
              className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-slate-900">
                {item.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Цена: {item.price} сом
              </p>
              <div className="mt-1.5">
                <p className="text-xs font-medium text-slate-700">Количество</p>
                {renderQuantityControls(item.id, quantity)}
              </div>
            </article>
          )
        })}
      </div>

      <div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block">
        <p className="text-xs text-slate-600">
          Выбрано позиций: {selectedItemsCount}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          Итого: {total} сом
        </p>
        <button
          type="button"
          disabled={
            !menu.can_order ||
            selectedItemsCount === 0 ||
            isCreatingOrder ||
            isUploadingPayment
          }
          onClick={openConfirm}
          className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isCreatingOrder ? 'Оформляем...' : 'Перейти к подтверждению'}
        </button>
      </div>

      <div className="fixed bottom-1.5 left-1.5 right-1.5 z-20 rounded-lg border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] text-slate-600">
              Позиций: {selectedItemsCount}
            </p>
            <p className="text-xs font-semibold text-slate-900">{total} сом</p>
          </div>
          <button
            type="button"
            disabled={
              !menu.can_order ||
              selectedItemsCount === 0 ||
              isCreatingOrder ||
              isUploadingPayment
            }
            onClick={openConfirm}
            className="h-8 rounded-md bg-slate-900 px-2.5 text-[11px] font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isCreatingOrder ? 'Оформляем...' : 'К подтверждению'}
          </button>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-1.5 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Подтверждение заказа
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                Проверь позиции перед окончательным оформлением.
              </p>
            </div>

            <div className="max-h-[42vh] overflow-y-auto p-2.5">
              <div className="space-y-1.5">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs"
                  >
                    <div className="text-slate-700">
                      {item.name} x {item.quantity}
                    </div>
                    <div className="font-medium text-slate-900">
                      {item.lineTotal} сом
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-xs text-slate-700">
                Итог к оплате:{' '}
                <span className="font-semibold text-slate-900">
                  {total} сом
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 p-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isCreatingOrder}
                className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Назад к выбору
              </button>
              <button
                type="button"
                onClick={submitOrder}
                disabled={isCreatingOrder}
                className="h-8 rounded-md bg-emerald-700 px-2.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isCreatingOrder ? 'Оформляем...' : 'Подтвердить и оформить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && createdOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-1.5 sm:items-center">
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Оплати сейчас и загрузи скриншот
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                После оплаты загрузи скрин — заказ сразу перейдет в статус PAID.
              </p>
            </div>

            <div className="space-y-2.5 p-2.5">
              {effectivePaymentQrUrl ? (
                <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-2.5">
                  <p className="text-xs font-medium text-cyan-900">
                    QR для оплаты
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <img
                      src={effectivePaymentQrUrl}
                      alt="QR для оплаты"
                      className="h-20 w-20 rounded-md border border-cyan-200 bg-white object-contain"
                    />
                    <QrPreview
                      url={effectivePaymentQrUrl}
                      alt="QR для оплаты"
                      downloadName="singlelunch-payment-qr.png"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  QR пока не загружен. Можно закрыть окно и оплатить позже в
                  «История заказов».
                </div>
              )}

              <form action={uploadPaymentNow} className="space-y-2">
                <input
                  type="file"
                  name="screenshot"
                  accept="image/*"
                  disabled={isUploadingPayment}
                  className="w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-2 file:py-1 file:text-xs file:text-slate-700"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentModalOpen(false)
                      router.push('/orders-history')
                    }}
                    disabled={isUploadingPayment}
                    className="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Позже
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingPayment}
                    className="h-8 rounded-md bg-emerald-700 px-2.5 text-[11px] font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {isUploadingPayment ? 'Загрузка...' : 'Загрузить скриншот'}
                  </button>
                </div>
              </form>

              {paymentResult && (
                <div
                  className={`rounded-lg p-2 text-xs ${
                    paymentResult.ok
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {paymentResult.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="h-12 md:hidden" />
    </div>
  )
}
