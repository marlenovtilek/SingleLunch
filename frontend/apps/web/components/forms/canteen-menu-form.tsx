'use client'

import {
  type PublishCanteenMenuResult,
  publishCanteenMenuAction
} from '@/actions/publish-canteen-menu-action'
import type { TodayMenu } from '@frontend/types/api'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

type OptionDraft = {
  id: string
  name: string
  price: string
}

type OptionPayload = {
  name: string
  price?: string
}

function toLocalDatetimeInputValue(iso: string): string {
  // Fixed business timezone: Asia/Bishkek (UTC+6), no DST.
  const source = new Date(iso)
  if (Number.isNaN(source.getTime())) {
    return ''
  }

  const bishkekTime = new Date(source.getTime() + 6 * 60 * 60 * 1000)
  const year = bishkekTime.getUTCFullYear()
  const month = String(bishkekTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(bishkekTime.getUTCDate()).padStart(2, '0')
  const hours = String(bishkekTime.getUTCHours()).padStart(2, '0')
  const minutes = String(bishkekTime.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getYesterday(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDefaultDeadlineForMenuDate(menuDate: string): string {
  return `${getYesterday(menuDate)}T20:00`
}

function makeOptionDraft(index: number): OptionDraft {
  return {
    id: `option-${index}`,
    name: '',
    price: '170.00'
  }
}

function mapMenuToDraft(menu: TodayMenu | null): OptionDraft[] {
  if (!menu?.options?.length) {
    return [makeOptionDraft(1), makeOptionDraft(2), makeOptionDraft(3)]
  }

  return menu.options.map((option, index) => ({
    id: option.id ?? `option-${index + 1}`,
    name: option.name,
    price: option.price ?? '170.00'
  }))
}

export function CanteenMenuForm({
  selectedDate,
  currentMenu
}: {
  selectedDate: string
  currentMenu: TodayMenu | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PublishCanteenMenuResult | null>(null)
  const [selectionDeadlineLocal, setSelectionDeadlineLocal] = useState(
    currentMenu?.selection_deadline
      ? toLocalDatetimeInputValue(currentMenu.selection_deadline)
      : getDefaultDeadlineForMenuDate(selectedDate)
  )
  const [isActive, setIsActive] = useState(currentMenu?.can_order ?? true)
  const [options, setOptions] = useState<OptionDraft[]>(
    mapMenuToDraft(currentMenu)
  )

  const totalPositions = useMemo(() => {
    return options.filter((option) => option.name.trim()).length
  }, [options])

  const updateOption = (id: string, patch: Partial<OptionDraft>) => {
    setOptions((prev) =>
      prev.map((option) =>
        option.id === id ? { ...option, ...patch } : option
      )
    )
  }

  const addOption = () => {
    setOptions((prev) => [...prev, makeOptionDraft(prev.length + 1)])
  }

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((option) => option.id !== id))
  }

  const onDateChange = (nextDate: string) => {
    router.push(`/canteen-menu-today?date=${nextDate}`)
  }

  const onSave = () => {
    const normalizedOptions: OptionPayload[] = options
      .map((option) => ({
        name: option.name.trim(),
        price: option.price.trim() || undefined
      }))
      .filter((option) => option.name || option.price)

    if (normalizedOptions.length === 0) {
      setResult({ ok: false, message: 'Добавь хотя бы одну позицию меню.' })
      return
    }

    const hasIncompleteOption = normalizedOptions.some((option) => !option.name)
    if (hasIncompleteOption) {
      setResult({
        ok: false,
        message: 'У каждой позиции обязательно заполни название.'
      })
      return
    }

    startTransition(async () => {
      const saveResult = await publishCanteenMenuAction({
        menuDate: selectedDate,
        selectionDeadlineLocal,
        isActive,
        options: normalizedOptions
      })
      setResult(saveResult)
      if (saveResult.ok) {
        router.push('/menu-today')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {result && (
        <div
          className={`rounded-lg p-2 text-xs ${
            result.ok
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Дата меню
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
          />
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-700">
          Дедлайн выбора
          <input
            type="datetime-local"
            value={selectionDeadlineLocal}
            onChange={(event) => setSelectionDeadlineLocal(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
          />
        </label>

        <label className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-700 md:mt-0">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Меню активно для выбора
        </label>
      </div>

      <div className="space-y-2">
        {options.map((option) => (
          <article
            key={option.id}
            className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Название
                <input
                  type="text"
                  value={option.name}
                  onChange={(event) =>
                    updateOption(option.id, { name: event.target.value })
                  }
                  className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
                />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Цена (сом)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={option.price}
                  onChange={(event) =>
                    updateOption(option.id, { price: event.target.value })
                  }
                  className="h-8 w-28 rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
                />
              </label>
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                disabled={options.length <= 1}
                className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Удалить позицию
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addOption}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Добавить позицию
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending}
          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isPending
            ? 'Сохраняем...'
            : `Сохранить меню (${totalPositions} поз.)`}
        </button>
      </div>
    </div>
  )
}
