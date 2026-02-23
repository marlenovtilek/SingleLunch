import { CanteenQrForm } from '@/components/forms/canteen-qr-form'
import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import { getBranding } from '@/lib/branding'
import { redirect } from 'next/navigation'

export default async function CanteenQrPage() {
  const { user: me } = await getCurrentUserOrRedirect()
  if (!canManageCanteen(me)) {
    return redirect('/menu-today')
  }

  const branding = await getBranding()

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-900">QR оплаты</h1>
        <p className="text-xs text-slate-600">
          Отдельная страница управления единым QR для оплаты.
        </p>
      </header>

      <CanteenQrForm paymentQrUrl={branding.paymentQrUrl} />
    </section>
  )
}
