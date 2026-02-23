'use client'

import { cancelOrderAction } from '@/actions/cancel-order-action'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function CancelOrderButton({
  orderId,
  onSuccess
}: {
  orderId: string
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const onCancel = () => {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId)
      setIsError(!result.ok)
      setMessage(result.message)
      if (result.ok) {
        onSuccess?.()
        router.replace('/orders-history')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="w-full rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Отмена...' : 'Отменить заказ'}
      </button>
      {message && (
        <p
          className={`text-[11px] ${isError ? 'text-rose-700' : 'text-emerald-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
