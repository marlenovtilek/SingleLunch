'use client'

import {
  type PublishCanteenMenuResult,
  publishCanteenMenuAction
} from '@/actions/publish-canteen-menu-action'
import {
  formatIsoDateDdMmYyyy,
  getNowDateTimeLocalStringBishkek,
  isIsoDateWeekend,
  isLocalDateTimeWeekend
} from '@/lib/bishkek-date'
import type { TodayMenu } from '@frontend/types/api'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

type OptionDraft = {
  id: string
  name: string
}

type OptionPayload = {
  name: string
}

type MenuDraftPayload = {
  selectionDeadlineLocal: string
  options: OptionDraft[]
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

function parseLocalDateTime(value: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }
  const [, y, m, d, h, min] = match
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(h),
    minute: Number(min)
  }
}

function toLocalDateTimeString(parts: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function floorToHour(value: string): string {
  const parsed = parseLocalDateTime(value)
  if (!parsed) {
    return value
  }
  return toLocalDateTimeString({ ...parsed, minute: 0 })
}

function ceilToNextHour(value: string): string {
  const parsed = parseLocalDateTime(value)
  if (!parsed) {
    return value
  }
  if (parsed.minute === 0) {
    return toLocalDateTimeString(parsed)
  }

  const utc = new Date(
    Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute
    )
  )
  utc.setUTCMinutes(0, 0, 0)
  utc.setUTCHours(utc.getUTCHours() + 1)

  return toLocalDateTimeString({
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
    hour: utc.getUTCHours(),
    minute: utc.getUTCMinutes()
  })
}

function getDatePart(value: string): string {
  return value.slice(0, 10)
}

function getHourPart(value: string): string {
  return value.slice(11, 13)
}

function getPreviousBusinessDay(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  do {
    date.setUTCDate(date.getUTCDate() - 1)
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDefaultDeadlineForMenuDate(menuDate: string): string {
  return `${getPreviousBusinessDay(menuDate)}T20:00`
}

function buildBusinessDateOptions(
  startDate: string,
  daysAhead = 120
): string[] {
  const [year, month, day] = startDate.split('-').map(Number)
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return []
  }

  const cursor = new Date(Date.UTC(year, month - 1, day))
  const options: string[] = []
  for (let i = 0; i <= daysAhead; i += 1) {
    const weekday = cursor.getUTCDay()
    if (weekday !== 0 && weekday !== 6) {
      const y = cursor.getUTCFullYear()
      const m = String(cursor.getUTCMonth() + 1).padStart(2, '0')
      const d = String(cursor.getUTCDate()).padStart(2, '0')
      options.push(`${y}-${m}-${d}`)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return options
}

function makeOptionDraft(index: number): OptionDraft {
  return {
    id: `option-${index}`,
    name: ''
  }
}

function mapMenuToDraft(menu: TodayMenu | null): OptionDraft[] {
  if (!menu?.options?.length) {
    return [makeOptionDraft(1), makeOptionDraft(2), makeOptionDraft(3)]
  }

  return menu.options.map((option, index) => ({
    id: option.id ?? `option-${index + 1}`,
    name: option.name
  }))
}

export function CanteenMenuForm({
  mode,
  selectedDate,
  currentMenu,
  creationLocked,
  lockReason,
  minMenuDate,
  lunchPrice
}: {
  mode: 'create' | 'edit'
  selectedDate: string
  currentMenu: TodayMenu | null
  creationLocked: boolean
  lockReason: 'past-date' | 'already-exists' | 'weekend-date' | null
  minMenuDate?: string
  lunchPrice: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isCreateMode = mode === 'create'
  const isEditMode = mode === 'edit'
  const [result, setResult] = useState<PublishCanteenMenuResult | null>(null)
  const minSelectionDeadlineLocal = ceilToNextHour(
    getNowDateTimeLocalStringBishkek()
  )
  const [selectionDeadlineLocal, setSelectionDeadlineLocal] = useState(
    (() => {
      const rawDeadline = currentMenu?.selection_deadline
        ? toLocalDatetimeInputValue(currentMenu.selection_deadline)
        : getDefaultDeadlineForMenuDate(selectedDate)
      const normalizedDeadline = floorToHour(rawDeadline)
      if (isCreateMode && normalizedDeadline < minSelectionDeadlineLocal) {
        return minSelectionDeadlineLocal
      }
      return normalizedDeadline
    })()
  )
  const [options, setOptions] = useState<OptionDraft[]>(
    mapMenuToDraft(currentMenu)
  )
  const draftStorageKey = useMemo(
    () => `singlelunch:canteen-menu-draft:${selectedDate}`,
    [selectedDate]
  )
  const businessDateOptions = useMemo(() => {
    if (!isCreateMode || !minMenuDate) {
      return []
    }
    return buildBusinessDateOptions(minMenuDate)
  }, [isCreateMode, minMenuDate])

  const totalPositions = useMemo(() => {
    return options.filter((option) => option.name.trim()).length
  }, [options])
  const selectionDeadlineDate = getDatePart(selectionDeadlineLocal)
  const selectionDeadlineHour = getHourPart(selectionDeadlineLocal)
  const availableDeadlineHours = useMemo(() => {
    const hours: string[] = []
    for (let hour = 0; hour <= 23; hour += 1) {
      const hourValue = String(hour).padStart(2, '0')
      const candidate = `${selectionDeadlineDate}T${hourValue}:00`
      if (candidate >= minSelectionDeadlineLocal) {
        hours.push(hourValue)
      }
    }
    return hours
  }, [selectionDeadlineDate, minSelectionDeadlineLocal])
  const deadlineDateOptions = useMemo(() => {
    const startDate = getDatePart(minSelectionDeadlineLocal)
    const options = buildBusinessDateOptions(startDate)
    if (
      selectionDeadlineDate &&
      !options.includes(selectionDeadlineDate) &&
      !isIsoDateWeekend(selectionDeadlineDate)
    ) {
      return [selectionDeadlineDate, ...options]
    }
    return options
  }, [minSelectionDeadlineLocal, selectionDeadlineDate])

  useEffect(() => {
    if (!isCreateMode) {
      return
    }
    try {
      const raw = localStorage.getItem(draftStorageKey)
      if (!raw) {
        return
      }
      const draft = JSON.parse(raw) as MenuDraftPayload
      if (
        !draft ||
        typeof draft.selectionDeadlineLocal !== 'string' ||
        !Array.isArray(draft.options)
      ) {
        return
      }

      const normalizedOptions = draft.options
        .map((option, index) => ({
          id:
            typeof option?.id === 'string' && option.id.trim().length > 0
              ? option.id
              : `draft-option-${index + 1}`,
          name: String(option?.name ?? '')
        }))
        .filter(
          (option) => option.name.length > 0 || draft.options.length === 1
        )

      if (draft.selectionDeadlineLocal) {
        const normalizedDraftDeadline = floorToHour(
          draft.selectionDeadlineLocal
        )
        setSelectionDeadlineLocal(
          normalizedDraftDeadline < minSelectionDeadlineLocal
            ? minSelectionDeadlineLocal
            : normalizedDraftDeadline
        )
      }
      if (normalizedOptions.length > 0) {
        setOptions(normalizedOptions)
      }
    } catch {
      // ignore broken local draft payload
    }
  }, [draftStorageKey, isCreateMode, minSelectionDeadlineLocal])

  useEffect(() => {
    if (!isCreateMode) {
      return
    }
    try {
      const payload: MenuDraftPayload = {
        selectionDeadlineLocal,
        options
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(payload))
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [draftStorageKey, isCreateMode, options, selectionDeadlineLocal])

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
    if (!nextDate) {
      return
    }
    if (isCreateMode && isIsoDateWeekend(nextDate)) {
      setResult({
        ok: false,
        message:
          'Дата меню не может быть в выходной день (суббота/воскресенье).'
      })
      return
    }
    setResult(null)
    router.push(`/canteen-menu-today?date=${nextDate}`)
  }

  const onDeadlineDateChange = (nextDate: string) => {
    if (!nextDate) {
      return
    }
    if (isIsoDateWeekend(nextDate)) {
      setResult({
        ok: false,
        message:
          'Дедлайн выбора не может быть на выходной день (суббота/воскресенье).'
      })
      return
    }

    const candidate = `${nextDate}T${selectionDeadlineHour || '00'}:00`
    if (candidate < minSelectionDeadlineLocal) {
      for (let hour = 0; hour <= 23; hour += 1) {
        const hourValue = String(hour).padStart(2, '0')
        const nextCandidate = `${nextDate}T${hourValue}:00`
        if (nextCandidate >= minSelectionDeadlineLocal) {
          setResult(null)
          setSelectionDeadlineLocal(nextCandidate)
          return
        }
      }
      setSelectionDeadlineLocal(minSelectionDeadlineLocal)
      setResult(null)
      return
    }

    setResult(null)
    setSelectionDeadlineLocal(candidate)
  }

  useEffect(() => {
    if (availableDeadlineHours.includes(selectionDeadlineHour)) {
      return
    }
    if (availableDeadlineHours.length > 0) {
      setSelectionDeadlineLocal(
        `${selectionDeadlineDate}T${availableDeadlineHours[0]}:00`
      )
    }
  }, [availableDeadlineHours, selectionDeadlineDate, selectionDeadlineHour])

  const onSave = () => {
    if (isCreateMode && creationLocked) {
      setResult({
        ok: false,
        message:
          lockReason === 'past-date'
            ? 'Нельзя создать меню на прошедшую дату. Выбери сегодняшнюю или будущую дату.'
            : lockReason === 'weekend-date'
              ? 'Нельзя создать меню на выходной день. Выбери рабочий день (пн-пт).'
              : 'На эту дату меню уже создано. Перейди в «Список меню», чтобы редактировать.'
      })
      return
    }

    if (selectionDeadlineLocal < minSelectionDeadlineLocal) {
      setResult({
        ok: false,
        message: 'Дедлайн выбора не может быть в прошлом.'
      })
      return
    }

    if (isLocalDateTimeWeekend(selectionDeadlineLocal)) {
      setResult({
        ok: false,
        message:
          'Дедлайн выбора не может быть на выходной день (суббота/воскресенье).'
      })
      return
    }

    const normalizedOptions: OptionPayload[] = options
      .map((option) => ({
        name: option.name.trim()
      }))
      .filter((option) => option.name)

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
        mode,
        menuDate: selectedDate,
        selectionDeadlineLocal,
        options: normalizedOptions
      })
      setResult(saveResult)
      if (saveResult.ok) {
        if (isCreateMode) {
          try {
            localStorage.removeItem(draftStorageKey)
          } catch {
            // ignore
          }
        }
        router.push('/canteen-menu-list')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
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

      {isCreateMode && creationLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          {lockReason === 'past-date' ? (
            <>
              Дата{' '}
              <span className="font-semibold">
                {formatIsoDateDdMmYyyy(selectedDate)}
              </span>{' '}
              уже прошла. Создание меню недоступно.
            </>
          ) : lockReason === 'weekend-date' ? (
            <>
              Дата{' '}
              <span className="font-semibold">
                {formatIsoDateDdMmYyyy(selectedDate)}
              </span>{' '}
              приходится на выходной. Создание меню доступно только для рабочих
              дней (пн-пт).
            </>
          ) : (
            <>
              На дату{' '}
              <span className="font-semibold">
                {formatIsoDateDdMmYyyy(selectedDate)}
              </span>{' '}
              меню уже существует. Создание недоступно.
            </>
          )}
        </div>
      )}

      {isEditMode && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
          Режим редактирования меню на{' '}
          <span className="font-semibold">
            {formatIsoDateDdMmYyyy(selectedDate)}
          </span>
          .
        </div>
      )}

      <div className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:grid-cols-2 md:gap-2 md:p-2.5">
        <div className="space-y-1 text-xs font-medium text-slate-700">
          <label htmlFor="menu-date-select">Дата меню</label>
          {isCreateMode ? (
            <select
              id="menu-date-select"
              value={isIsoDateWeekend(selectedDate) ? '' : selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring md:h-8"
            >
              <option value="" disabled>
                Выбери рабочий день
              </option>
              {businessDateOptions.map((dateValue) => (
                <option key={dateValue} value={dateValue}>
                  {formatIsoDateDdMmYyyy(dateValue)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="menu-date-select"
              type="date"
              value={selectedDate}
              onChange={(event) => onDateChange(event.target.value)}
              disabled
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring md:h-8"
            />
          )}
        </div>

        <div className="space-y-1 text-xs font-medium text-slate-700">
          <label htmlFor="deadline-date-select">Дедлайн выбора</label>
          <div className="grid grid-cols-[1fr_88px] gap-1">
            <select
              id="deadline-date-select"
              value={
                isIsoDateWeekend(selectionDeadlineDate)
                  ? ''
                  : selectionDeadlineDate
              }
              onChange={(event) => onDeadlineDateChange(event.target.value)}
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring md:h-8"
            >
              <option value="" disabled>
                Выбери рабочий день
              </option>
              {deadlineDateOptions.map((dateValue) => (
                <option key={dateValue} value={dateValue}>
                  {formatIsoDateDdMmYyyy(dateValue)}
                </option>
              ))}
            </select>
            <select
              id="deadline-hour-select"
              value={selectionDeadlineHour}
              onChange={(event) => {
                const nextValue = `${selectionDeadlineDate}T${event.target.value}:00`
                if (nextValue < minSelectionDeadlineLocal) {
                  setResult({
                    ok: false,
                    message: 'Дедлайн выбора не может быть в прошлом.'
                  })
                  return
                }
                if (isLocalDateTimeWeekend(nextValue)) {
                  setResult({
                    ok: false,
                    message:
                      'Дедлайн выбора не может быть на выходной день (суббота/воскресенье).'
                  })
                  return
                }
                setResult(null)
                setSelectionDeadlineLocal(nextValue)
              }}
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring md:h-8"
            >
              {availableDeadlineHours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}:00
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 md:space-y-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          Цена за порцию:{' '}
          <span className="font-semibold">{lunchPrice} сом</span>. Изменяется
          только в разделе <span className="font-semibold">QR Код</span>.
        </div>
        {options.map((option) => (
          <article
            key={option.id}
            className="flex items-end gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:gap-2 md:p-2.5"
          >
            <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-slate-700">
              Название
              <input
                type="text"
                value={option.name}
                onChange={(event) =>
                  updateOption(option.id, { name: event.target.value })
                }
                className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring md:h-8"
              />
            </label>

            <button
              type="button"
              onClick={() => removeOption(option.id)}
              disabled={options.length <= 1 || (isCreateMode && creationLocked)}
              aria-label="Удалить позицию"
              title="Удалить позицию"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40 md:h-8 md:w-8"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <button
          type="button"
          onClick={addOption}
          disabled={isCreateMode && creationLocked}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 md:px-2.5"
        >
          Добавить позицию
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || (isCreateMode && creationLocked)}
          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:px-2.5"
        >
          {isPending
            ? 'Сохраняем...'
            : `Сохранить меню (${totalPositions} поз.)`}
        </button>
      </div>
    </div>
  )
}
