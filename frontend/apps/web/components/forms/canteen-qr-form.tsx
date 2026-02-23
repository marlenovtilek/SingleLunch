'use client'

import {
  type UploadCanteenQrResult,
  uploadCanteenQrAction
} from '@/actions/upload-canteen-qr-action'
import { QrPreview } from '@/components/qr-preview'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

export function CanteenQrForm({
  paymentQrUrl
}: {
  paymentQrUrl: string | null
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
        <label className="block text-xs font-medium text-slate-700">
          Загрузить новый QR
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
            className="mt-1.5 max-w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-2 file:py-1"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending ? 'Загрузка...' : 'Сохранить QR'}
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
