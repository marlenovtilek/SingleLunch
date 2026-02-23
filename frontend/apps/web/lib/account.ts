import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import type { UserCurrent } from '@frontend/types/api'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import { redirect } from 'next/navigation'

export async function getSessionOrRedirect(): Promise<Session> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }
  return session
}

export async function getCurrentUserOrRedirect(): Promise<{
  session: Session
  apiClient: Awaited<ReturnType<typeof getApiClient>>
  user: UserCurrent
}> {
  const session = await getSessionOrRedirect()
  const apiClient = await getApiClient(session)

  try {
    const user = await apiClient.users.usersMeRetrieve()
    return { session, apiClient, user }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/login')
    }
    throw error
  }
}

export function canManageCanteen(user: UserCurrent): boolean {
  return Boolean(user.role === 'CANTEEN' || user.is_staff || user.is_superuser)
}

export function isCanteenUser(user: UserCurrent): boolean {
  return user.role === 'CANTEEN'
}
