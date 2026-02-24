'use client'

import {
  type UploadCanteenQrResult,
  uploadCanteenQrAction
} from '@/actions/upload-canteen-qr-action'
import { QrPreview } from '@/components/qr-preview'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

export function CanteenQrForm({
  paymentQrUrl,
  lunchPrice
}: {
  paymentQrUrl: string | null
  lunchPrice: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<UploadCanteenQrResult | null>(null)
  const [selectedQrPreviewUrl, setSelectedQrPreviewUrl] = useState<
    string | null
  >(null)

  useEffect(() => {
    return () => {
      if (selectedQrPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedQrPreviewUrl)
      }
    }
  }, [selectedQrPreviewUrl])

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const uploadResult = await uploadCanteenQrAction(formData)
      setResult(uploadResult)
      if (uploadResult.ok) {
        setSelectedQrPreviewUrl(null)
        router.refresh()
      }
    })
  }

  const currentQrUrl = selectedQrPreviewUrl ?? paymentQrUrl

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Текущий QR оплаты
        </h2>

        {currentQrUrl ? (
          <div className="mt-2 space-y-2">
            <img
              src={currentQrUrl}
              alt="QR для оплаты"
              className="h-40 w-40 rounded-lg border border-slate-200 bg-white object-contain"
            />
            <QrPreview
              url={currentQrUrl}
              alt="QR для оплаты"
              allowDownload={false}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">QR пока не загружен.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Цена за порцию (сом)</span>
            <input
              type="text"
              name="lunch_price"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={lunchPrice}
              placeholder="170.00"
              className="h-7 w-full max-w-[100px] rounded-md border border-slate-300 px-1.5 text-[11px] outline-none ring-slate-900/10 focus:ring"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Загрузить новый QR</span>
            <input
              type="file"
              name="payment_qr"
              accept="image/*"
              disabled={isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  setSelectedQrPreviewUrl(null)
                  return
                }
                setSelectedQrPreviewUrl(URL.createObjectURL(file))
              }}
              className="block w-full max-w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? 'Сохранение...' : 'Сохранить настройки оплаты'}
        </button>

        {result && (
          <div
            className={`mt-2 rounded-lg p-2 text-xs ${
              result.ok
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </form>
  )
}
