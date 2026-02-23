'use client'

import { uploadPaymentAction } from '@/actions/upload-payment-action'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function PaymentUploadForm({
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

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await uploadPaymentAction(orderId, formData)
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
    <form action={onSubmit} className="flex w-full min-w-0 flex-col gap-1.5">
      <input
        type="file"
        name="screenshot"
        accept="image/*"
        disabled={isPending}
        className="w-full min-w-0 overflow-hidden text-[10px] text-slate-600 file:mr-1.5 file:rounded-md file:border file:border-slate-200 file:bg-slate-50 file:px-1.5 file:py-1 file:text-[10px] file:text-slate-700"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? 'Загрузка...' : 'Загрузить скрин'}
      </button>
      {message && (
        <p
          className={`text-[11px] ${isError ? 'text-rose-700' : 'text-emerald-700'}`}
        >
          {message}
        </p>
      )}
    </form>
  )
}
