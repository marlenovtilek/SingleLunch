import { CanteenMenuDeleteButton } from '@/components/forms/canteen-menu-delete-button'
import { CanteenMenuForm } from '@/components/forms/canteen-menu-form'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  formatIsoDateDdMmYyyy,
  getTodayDateStringBishkek
} from '@/lib/bishkek-date'
import { getBranding } from '@/lib/branding'
import { ApiError } from '@frontend/types/api'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type PageProps = { searchParams: Promise<{ date?: string }> }

export default async function CanteenMenuEditPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedDate = params.date

  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  const branding = await getBranding()
  const todayDate = getTodayDateStringBishkek()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  if (!selectedDate) {
    return redirect('/canteen-menu-list')
  }

  let currentMenu = null
  let errorMessage = ''
  let canDeleteMenu = false
  let deleteStateMessage = ''
  try {
    currentMenu = await apiClient.v1.v1CanteenMenuRetrieve(selectedDate)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      errorMessage = 'Меню на выбранную дату не найдено.'
    } else {
      errorMessage = 'Не удалось загрузить меню для редактирования.'
    }
  }

  const isPastDate = selectedDate < todayDate

  if (currentMenu && !isPastDate) {
    try {
      const dashboard = await apiClient.v1.v1CanteenOrdersRetrieve(selectedDate)
      canDeleteMenu = dashboard.orders_count === 0
      if (!canDeleteMenu) {
        deleteStateMessage =
          'Удаление недоступно: по этому меню уже есть заказы.'
      }
    } catch {
      deleteStateMessage =
        'Не удалось проверить наличие заказов для удаления меню.'
    }
  } else if (isPastDate) {
    deleteStateMessage = 'Удаление недоступно: дата меню уже прошла.'
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">
          Редактировать меню
        </h1>
        <p className="text-xs text-slate-600">
          Дата: {formatIsoDateDdMmYyyy(selectedDate)}
        </p>
      </header>

      {errorMessage && (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          <p>{errorMessage}</p>
          <Link
            href="/canteen-menu-list"
            className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            К списку меню
          </Link>
        </div>
      )}

      {currentMenu && (
        <div className="space-y-2">
          {canDeleteMenu ? (
            <CanteenMenuDeleteButton menuDate={selectedDate} />
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              {deleteStateMessage}
            </div>
          )}

          <CanteenMenuForm
            mode="edit"
            selectedDate={selectedDate}
            quickDateOptions={[selectedDate]}
            currentMenu={currentMenu}
            creationLocked={false}
            lockReason={null}
            lunchPrice={branding.lunchPrice}
          />
        </div>
      )}
    </section>
  )
}
