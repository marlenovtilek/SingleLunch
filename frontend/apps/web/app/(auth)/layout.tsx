import { BrandLogo } from '@/components/brand-logo'
import { getBranding } from '@/lib/branding'

export default async function AuthLayout({
  children
}: { children: React.ReactNode }) {
  const branding = await getBranding()

  return (
    <div className="-mx-2 -my-6 flex min-h-[100svh] w-auto items-center justify-center overflow-y-auto px-3 py-4 sm:-mx-4 sm:-my-8 sm:px-4 sm:py-6">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-md sm:p-5">
        <BrandLogo
          href="/login"
          subtitle="Система автоматизации обедов"
          projectName={branding.projectName}
          logoUrl={branding.logoUrl}
        />
        {children}
      </div>
    </div>
  )
}
