import { CreateOrderForm } from '@/components/forms/create-order-form'
import { getCurrentUserOrRedirect, isCanteenUser } from '@/lib/account'
import { getBranding } from '@/lib/branding'
import { ApiError } from '@frontend/types/api'
import { redirect } from 'next/navigation'

export default async function MenuTodayPage() {
  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  const branding = await getBranding()
  const isAdminReadonly = Boolean(me.is_staff || me.is_superuser)
  const isOrderingReadonly = isCanteenUser(me) || isAdminReadonly

  let menu = null
  let errorMessage = ''

  try {
    menu = await apiClient.v1.v1MenuTodayRetrieve()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirect('/login')
    }

    if (error instanceof ApiError && error.status === 404) {
      errorMessage = 'На сегодня активное меню пока не опубликовано.'
    } else {
      errorMessage = 'Не удалось загрузить меню. Попробуйте чуть позже.'
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">
          Меню на сегодня
        </h1>
        <p className="text-xs text-slate-600">
          {menu
            ? `Дата меню: ${menu.date}. Дедлайн выбора: ${new Date(menu.selection_deadline).toLocaleString('ru-RU')}`
            : 'Загрузка меню из API.'}
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {errorMessage}
        </div>
      )}

      {menu && isOrderingReadonly ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-600">
            {isAdminReadonly
              ? 'Режим чтения для администратора.'
              : 'Режим чтения для представителя столовой.'}
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {menu.options.map((item, index) => (
              <article
                key={item.id ?? `menu-option-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5"
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {item.name}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Цена: {item.price} сом
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        menu && (
          <CreateOrderForm menu={menu} paymentQrUrl={branding.paymentQrUrl} />
        )
      )}
    </section>
  )
}
