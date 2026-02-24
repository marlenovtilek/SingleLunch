import { CanteenMenuForm } from '@/components/forms/canteen-menu-form'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  getNextBusinessDateStringBishkek,
  getTodayDateStringBishkek,
  isIsoDateWeekend
} from '@/lib/bishkek-date'
import { getBranding } from '@/lib/branding'
import { ApiError } from '@frontend/types/api'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string }> }

export default async function CanteenMenuTodayPage({
  searchParams
}: PageProps) {
  const params = await searchParams
  const selectedDate = params.date ?? getNextBusinessDateStringBishkek()
  const todayDate = getTodayDateStringBishkek()
  const isPastDate = selectedDate < todayDate
  const isWeekendDate = isIsoDateWeekend(selectedDate)

  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  const branding = await getBranding()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  let errorMessage = ''
  let creationLocked = isPastDate || isWeekendDate

  if (!isPastDate && !isWeekendDate) {
    try {
      await apiClient.v1.v1CanteenMenuRetrieve(selectedDate)
      creationLocked = true
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        creationLocked = false
      } else {
        errorMessage = 'Не удалось проверить наличие меню на выбранную дату.'
      }
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Создать меню</h1>
        <p className="text-xs text-slate-600">
          На одну дату можно создать только одно меню.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <CanteenMenuForm
        mode="create"
        selectedDate={selectedDate}
        currentMenu={null}
        creationLocked={creationLocked}
        lockReason={
          isPastDate
            ? 'past-date'
            : isWeekendDate
              ? 'weekend-date'
              : creationLocked
                ? 'already-exists'
                : null
        }
        minMenuDate={todayDate}
        lunchPrice={branding.lunchPrice}
      />
    </section>
  )
}
