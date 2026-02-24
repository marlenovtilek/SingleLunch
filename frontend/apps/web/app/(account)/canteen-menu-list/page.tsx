import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import {
  formatIsoDateDdMmYyyy,
  getTodayDateStringBishkek
} from '@/lib/bishkek-date'
import type { CanteenMenuSummary } from '@frontend/types/api'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function CanteenMenuListPage() {
  const { apiClient, user: me } = await getCurrentUserOrRedirect()

  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  const todayDate = getTodayDateStringBishkek()
  let menusList: CanteenMenuSummary[] = []
  let errorMessage = ''

  try {
    menusList = await apiClient.v1.v1CanteenMenusList()
  } catch {
    errorMessage = 'Не удалось загрузить список меню.'
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Список меню</h1>
        <p className="text-xs text-slate-600">
          Открой меню, посмотри детали и при необходимости перейди к
          редактированию.
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        {menusList.length === 0 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Меню пока не создано.
          </div>
        )}

        <div className="space-y-2">
          {menusList.map((item) => {
            const isPastDate = item.date < todayDate
            const rawOptions = item.options as unknown
            const optionsText =
              Array.isArray(rawOptions) && rawOptions.length > 0
                ? rawOptions.join(', ')
                : typeof rawOptions === 'string' && rawOptions.trim()
                  ? rawOptions
                  : 'Позиции не добавлены'

            return (
              <Link
                key={item.date}
                href={`/canteen-menu-list/${item.date}`}
                className="block rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">
                    {formatIsoDateDdMmYyyy(item.date)}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      isPastDate
                        ? 'border border-slate-200 bg-transparent text-slate-400'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                    aria-label="Редактирование"
                    title="Редактирование"
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
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </span>
                </div>

                <div className="mt-1 text-[11px] text-slate-500">
                  {item.options_count ?? 0} поз.
                </div>

                <div className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                  {optionsText}
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </section>
  )
}
