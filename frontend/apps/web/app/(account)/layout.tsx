import { AccountShell } from '@/components/account-shell'
import { getCurrentUserOrRedirect } from '@/lib/account'
import { getBranding } from '@/lib/branding'

export default async function AccountLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { session, user } = await getCurrentUserOrRedirect()
  const isAdmin = Boolean(session.user.is_staff || session.user.is_superuser)
  const branding = await getBranding()

  return (
    <AccountShell
      isAdmin={isAdmin}
      userRole={user.role}
      projectName={branding.projectName}
      logoUrl={branding.logoUrl}
      username={session.user.username}
    >
      {children}
    </AccountShell>
  )
}
