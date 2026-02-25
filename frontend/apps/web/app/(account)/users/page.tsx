import { activateUserAction } from '@/actions/activate-user-action'
import { getCurrentUserOrRedirect } from '@/lib/account'
import { formatIsoDateTimeDdMmYyyyBishkek } from '@/lib/bishkek-date'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl
} from '@/lib/server-api'
import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<{ error?: string; success?: string }>
}

type AdminUserRow = {
  id: string
  username: string
  first_name: string
  last_name: string
  role: 'EMPLOYEE' | 'CANTEEN'
  is_active: boolean
  department_name?: string | null
  created_at: string
}

export default async function UsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { session, user: me } = await getCurrentUserOrRedirect()

  if (!me.is_staff && !me.is_superuser) {
    return redirect('/menu-today')
  }

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    return (
      <section className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Пользователи</h1>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
          {API_URL_NOT_CONFIGURED_MESSAGE}
        </div>
      </section>
    )
  }

  let users: AdminUserRow[] = []
  let errorMessage = params.error ?? ''
  const successMessage = params.success ?? ''

  try {
    const response = await fetch(`${apiBaseUrl}/api/users/admin-list/`, {
      method: 'GET',
      headers: buildServerApiHeaders({ session }),
      cache: 'no-store'
    })

    if (!response.ok) {
      if (response.status === 401) {
        return redirect('/login')
      }
      if (response.status === 403) {
        return redirect('/menu-today')
      }
      throw new Error(`HTTP ${response.status}`)
    }

    users = (await response.json()) as AdminUserRow[]
  } catch {
    errorMessage = errorMessage || 'Не удалось загрузить список пользователей.'
  }

  const pendingUsers = users.filter((user) => !user.is_active)
  const activeUsers = users.filter((user) => user.is_active)
  const desktopGridCols =
    'md:grid-cols-[minmax(160px,1.2fr)_minmax(240px,1.7fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]'

  const renderTableHeader = () => (
    <div
      className={`hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${desktopGridCols}`}
    >
      <span>Логин</span>
      <span>Департамент</span>
      <span>Роль</span>
      <span>Регистрация</span>
      <span className="text-right">Статус</span>
    </div>
  )

  const renderUserRow = (user: AdminUserRow) => (
    <article
      key={user.id}
      className={`grid gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs md:items-center ${desktopGridCols}`}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">
          @{user.username}
        </p>
        <p className="truncate text-slate-500">
          {user.first_name || user.last_name
            ? `${user.first_name} ${user.last_name}`.trim()
            : 'Без ФИО'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 md:hidden">Департамент</p>
        <p
          className="truncate text-slate-700"
          title={user.department_name || '—'}
        >
          {user.department_name || '—'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 md:hidden">Роль</p>
        <p className="truncate text-slate-700">
          {user.role === 'CANTEEN' ? 'Представитель столовой' : 'Сотрудник'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 md:hidden">Регистрация</p>
        <p className="text-slate-700">
          {formatIsoDateTimeDdMmYyyyBishkek(user.created_at)}
        </p>
      </div>
      <div className="flex items-center md:justify-end">
        {user.is_active ? (
          <span className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
            Активирован
          </span>
        ) : (
          <form action={activateUserAction}>
            <input type="hidden" name="user_id" value={user.id} />
            <button
              type="submit"
              className="whitespace-nowrap rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 hover:bg-sky-100"
            >
              Активировать
            </button>
          </form>
        )}
      </div>
    </article>
  )

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Пользователи</h1>
        <p className="text-xs text-slate-600">
          Новые регистрации появляются здесь автоматически. Активируй доступ
          одной кнопкой.
        </p>
      </header>

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
          {errorMessage}
        </div>
      )}

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Ожидают активации ({pendingUsers.length})
        </h2>
        {pendingUsers.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
            Нет новых пользователей для активации.
          </p>
        ) : (
          <div className="space-y-1.5">
            {renderTableHeader()}
            {pendingUsers.map(renderUserRow)}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Активные пользователи ({activeUsers.length})
        </h2>
        {activeUsers.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">
            Пока нет активных пользователей.
          </p>
        ) : (
          <div className="space-y-1.5">
            {renderTableHeader()}
            {activeUsers.map(renderUserRow)}
          </div>
        )}
      </section>
    </section>
  )
}
