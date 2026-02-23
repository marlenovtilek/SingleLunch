import { canManageCanteen, getCurrentUserOrRedirect } from '@/lib/account'
import { redirect } from 'next/navigation'

export default async function Home() {
  try {
    const { user } = await getCurrentUserOrRedirect()
    if (canManageCanteen(user)) {
      return redirect('/canteen-menu-today')
    }
  } catch {
    return redirect('/login')
  }

  return redirect('/menu-today')
}
