import { CreateOrderForm } from '@/components/forms/create-order-form'
import { getCurrentUserOrRedirect, isCanteenUser } from '@/lib/account'
import {
  formatIsoDateDdMmYyyy,
  formatIsoDateTimeDdMmYyyyBishkek
} from '@/lib/bishkek-date'
import { getBranding } from '@/lib/branding'
import { ApiError } from '@frontend/types/api'
import { redirect } from 'next/navigation'

export default async function MenuTodayPage() {
  const { apiClient, user: me } = await getCurrentUserOrRedirect()
  const branding = await getBranding()
  const isAdminReadonly = Boolean(me.is_staff || me.is_superuser)
  const isOrderingReadonly = isCanteenUser(me) || isAdminReadonly

  if (isOrderingReadonly) {
    return redirect('/canteen-menu-today')
  }

  let menu = null
  let errorMessage = ''

  try {
    menu = await apiClient.v1.v1MenuTodayRetrieve()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return redirect('/login')
    }

    if (error instanceof ApiError && error.status === 404) {
      errorMessage = 'Активное меню пока не опубликовано.'
    } else {
      errorMessage = 'Не удалось загрузить меню. Попробуйте чуть позже.'
    }
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Меню</h1>
        <p className="text-xs text-slate-600">
          {menu
            ? `Дата меню: ${formatIsoDateDdMmYyyy(menu.date)}. Дедлайн выбора: ${formatIsoDateTimeDdMmYyyyBishkek(menu.selection_deadline)}`
            : 'Загрузка меню из API.'}
        </p>
      </header>

      {errorMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {errorMessage}
        </div>
      )}

      {menu && (
        <CreateOrderForm menu={menu} paymentQrUrl={branding.paymentQrUrl} />
      )}
    </section>
  )
}
