import { CanteenMenuForm } from '@/components/forms/canteen-menu-form'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  addDaysToIsoDate,
  getTodayDateStringBishkek,
  isIsoDateWeekend
} from '@/lib/bishkek-date'
import { getBranding } from '@/lib/branding'
import { ApiError, type TodayMenu } from '@frontend/types/api'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string | string[] }> }

export default async function CanteenMenuTodayPage({
  searchParams
}: PageProps) {
  const params = await searchParams
  const todayDate = getTodayDateStringBishkek()
  const yesterdayDate = addDaysToIsoDate(todayDate, -1)
  const tomorrowDate = addDaysToIsoDate(todayDate, 1)
  const dateParam = params.date
  const selectedDateCandidate = Array.isArray(dateParam)
    ? (dateParam.at(-1) ?? '')
    : (dateParam ?? '')
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDateCandidate)
    ? selectedDateCandidate
    : todayDate
  const isTooOldDate = selectedDate < yesterdayDate
  const isWeekendDate = isIsoDateWeekend(selectedDate)

  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  const branding = await getBranding()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  let errorMessage = ''
  let mode: 'create' | 'edit' = 'create'
  let currentMenu: TodayMenu | null = null
  const creationLocked = isTooOldDate || isWeekendDate

  try {
    currentMenu = await apiClient.v1.v1CanteenMenuRetrieve(selectedDate)
    mode = 'edit'
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      mode = 'create'
    } else {
      errorMessage = 'Не удалось проверить наличие меню на выбранную дату.'
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">
          {mode === 'edit' ? 'Редактировать меню' : 'Создать меню'}
        </h1>
        <p className="text-xs text-slate-600">
          Быстрый выбор даты: вчера, сегодня, завтра.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <CanteenMenuForm
        mode={mode}
        selectedDate={selectedDate}
        quickDateOptions={[yesterdayDate, todayDate, tomorrowDate]}
        currentMenu={currentMenu}
        creationLocked={creationLocked}
        lockReason={
          isTooOldDate
            ? 'past-date'
            : isWeekendDate
              ? 'weekend-date'
              : null
        }
        lunchPrice={branding.lunchPrice}
      />
    </section>
  )
}
