'use client'

import {
  type DeleteCanteenMenuResult,
  deleteCanteenMenuAction
} from '@/actions/delete-canteen-menu-action'
import { formatIsoDateDdMmYyyy } from '@/lib/bishkek-date'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export function CanteenMenuDeleteButton({ menuDate }: { menuDate: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<DeleteCanteenMenuResult | null>(null)

  const onDelete = () => {
    const shouldDelete = window.confirm(
      `Удалить меню на ${formatIsoDateDdMmYyyy(menuDate)}? Это действие нельзя отменить.`
    )
    if (!shouldDelete) {
      return
    }

    startTransition(async () => {
      const deleteResult = await deleteCanteenMenuAction(menuDate)
      setResult(deleteResult)
      if (deleteResult.ok) {
        router.replace('/canteen-menu-list')
      }
    })
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5">
      <p className="text-xs text-rose-900">
        Если по меню еще нет заказов, его можно удалить.
      </p>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Удаляем...' : 'Удалить меню'}
      </button>

      {result && (
        <div
          className={`rounded-md p-1.5 text-xs ${
            result.ok
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-rose-200 bg-white text-rose-900'
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
