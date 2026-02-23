import { CanteenMenuForm } from '@/components/forms/canteen-menu-form'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import { getTodayDateStringBishkek } from '@/lib/bishkek-date'
import { ApiError } from '@frontend/types/api'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string }> }

export default async function CanteenMenuTodayPage({
  searchParams
}: PageProps) {
  const params = await searchParams
  const selectedDate = params.date ?? getTodayDateStringBishkek()

  const { apiClient, user: me } = await getCurrentUserOrRedirect()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  let currentMenu = null
  let errorMessage = ''

  try {
    currentMenu = await apiClient.v1.v1CanteenMenuRetrieve(selectedDate)
  } catch (error) {
    if (error instanceof ApiError && error.status !== 404) {
      errorMessage = 'Не удалось загрузить текущее меню.'
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Меню</h1>
        <p className="text-xs text-slate-600">Выбери дату и редактируй меню.</p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <CanteenMenuForm selectedDate={selectedDate} currentMenu={currentMenu} />
    </section>
  )
}
