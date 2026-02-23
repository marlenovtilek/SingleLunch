import { upsertDutyAssignmentAction } from '@/actions/upsert-duty-assignment-action'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import { getCurrentMonthBishkek } from '@/lib/bishkek-date'
import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ month?: string; error?: string; success?: string }>
}

type DutyAssignment = {
  id: string
  date: string
  assignee_id: string
  assignee_username: string
  assignee_full_name: string
}

type DutyCalendarResponse = {
  month: string
  assignments: DutyAssignment[]
}

type DutyAssignee = {
  id: string
  username: string
  full_name: string
}

function normalizeMonth(value?: string): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return getCurrentMonthBishkek()
  }
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) {
    return getCurrentMonthBishkek()
  }
  return value
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function buildMonthDays(month: string): string[] {
  const year = Number(month.slice(0, 4))
  const monthNum = Number(month.slice(5, 7))
  const daysInMonth = getDaysInMonth(year, monthNum)
  const days: string[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = `${month}-${String(day).padStart(2, '0')}`
    const weekday = new Date(`${dateValue}T00:00:00Z`).getUTCDay()
    if (weekday === 0 || weekday === 6) {
      continue
    }
    days.push(dateValue)
  }
  return days
}

function getWeekdayLabel(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00Z`)
  const labels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  return labels[date.getUTCDay()]
}

export default async function DutyPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedMonth = normalizeMonth(params.month)
  const { session, user: me } = await getCurrentUserOrRedirect()
  const isAdmin = Boolean(me.is_staff || me.is_superuser)

  if (me.role === 'CANTEEN' && !isAdmin) {
    return redirect('/canteen-menu-today')
  }

  const canManageDuty = isAdmin

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return (
      <section className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Дежурство</h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          API_URL не настроен.
        </div>
      </section>
    )
  }

  let calendar: DutyCalendarResponse = { month: selectedMonth, assignments: [] }
  let assignees: DutyAssignee[] = []
  let errorMessage = params.error ?? ''

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/duty/?month=${selectedMonth}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return redirect('/login')
      }
      throw new Error(`HTTP ${response.status}`)
    }
    calendar = (await response.json()) as DutyCalendarResponse
  } catch {
    errorMessage = errorMessage || 'Не удалось загрузить календарь дежурств.'
  }

  if (canManageDuty) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/duty/assignees/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        },
        cache: 'no-store'
      })
      if (response.ok) {
        assignees = (await response.json()) as DutyAssignee[]
      }
    } catch {
      // ignore assignee fetch errors, calendar remains available
    }
  }

  const assignmentsByDate = new Map(
    calendar.assignments.map((assignment) => [assignment.date, assignment])
  )
  const monthDays = buildMonthDays(selectedMonth)

  return (
    <section className="space-y-2.5">
      <header className="space-y-0.5">
        <h1 className="text-lg font-semibold text-slate-900">Дежурство</h1>
        <p className="text-xs text-slate-600">
          Календарь дежурств и распределение по дням.
        </p>
      </header>

      {params.success === '1' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          Дежурство сохранено.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <form
        method="get"
        className="flex flex-wrap items-end gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
      >
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Месяц
          <input
            type="month"
            name="month"
            defaultValue={selectedMonth}
            className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
          />
        </label>
        <button
          type="submit"
          className="h-7 rounded-md bg-slate-900 px-2 text-xs font-medium text-white hover:bg-slate-700"
        >
          Показать
        </button>
      </form>

      {canManageDuty && (
        <form
          action={upsertDutyAssignmentAction}
          className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm md:grid-cols-[1fr,1fr,auto]"
        >
          <input type="hidden" name="month" value={selectedMonth} />
          <label className="space-y-1 text-xs font-medium text-slate-700">
            Дата
            <input
              type="date"
              name="date"
              required
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-700">
            Кто дежурит
            <select
              name="assignee_id"
              className="h-7 w-full rounded-md border border-slate-300 px-2 text-xs outline-none ring-slate-900/10 focus:ring"
            >
              <option value="">Снять дежурного</option>
              {assignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.full_name} (@{assignee.username})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-7 rounded-md bg-emerald-700 px-2 text-xs font-medium text-white hover:bg-emerald-600 md:self-end"
          >
            Сохранить
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-900">
          Список дежурств за {selectedMonth}
        </h2>
        <ul className="divide-y divide-slate-100">
          {monthDays.map((dateValue) => {
            const assignment = assignmentsByDate.get(dateValue)
            return (
              <li
                key={dateValue}
                className="grid grid-cols-[1fr_auto] items-center gap-2 px-2.5 py-2"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {dateValue}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {getWeekdayLabel(dateValue)} ·{' '}
                    {assignment
                      ? `@${assignment.assignee_username}`
                      : 'Не назначено'}
                  </p>
                </div>
                <p className="truncate text-right text-xs text-slate-700">
                  {assignment ? assignment.assignee_full_name : 'Свободно'}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
