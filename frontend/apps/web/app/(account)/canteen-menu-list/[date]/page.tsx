import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  formatIsoDateDdMmYyyy,
  formatIsoDateTimeDdMmYyyyBishkek,
  getTodayDateStringBishkek
} from '@/lib/bishkek-date'
import { ApiError } from '@frontend/types/api'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type PageProps = { params: Promise<{ date: string }> }

export default async function CanteenMenuDetailsPage({ params }: PageProps) {
  const { date: selectedDate } = await params
  const { apiClient, user: me } = await getCurrentUserOrRedirect()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  const todayDate = getTodayDateStringBishkek()
  const isPastDate = selectedDate < todayDate

  let menu = null
  let errorMessage = ''

  try {
    menu = await apiClient.v1.v1CanteenMenuRetrieve(selectedDate)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      errorMessage = 'Меню на выбранную дату не найдено.'
    } else {
      errorMessage = 'Не удалось загрузить детали меню.'
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Детали меню</h1>
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

      {menu && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="grid gap-1 text-xs text-slate-700 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <span className="text-slate-500">Дата меню</span>
              <p className="font-medium text-slate-900">
                {formatIsoDateDdMmYyyy(menu.date)}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <span className="text-slate-500">Дедлайн выбора</span>
              <p className="font-medium text-slate-900">
                {formatIsoDateTimeDdMmYyyyBishkek(menu.selection_deadline)}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <span className="text-slate-500">Статус</span>
              <p className="font-medium text-slate-900">
                {menu.can_order ? 'Доступно до дедлайна' : 'Дедлайн прошел'}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="mb-1 text-xs font-semibold text-slate-700">
              Позиции меню
            </p>
            <div className="space-y-1">
              {menu.options.map((option) => (
                <div
                  key={option.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                >
                  <span>{option.name}</span>
                  <span>{option.price} сом</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
            <Link
              href="/canteen-menu-list"
              className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              Назад к списку
            </Link>
            {isPastDate ? (
              <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                Редактирование недоступно (дата прошла)
              </span>
            ) : (
              <Link
                href={`/canteen-menu-edit?date=${selectedDate}`}
                className="inline-flex rounded-md border border-slate-300 bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700"
              >
                Редактировать меню
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
