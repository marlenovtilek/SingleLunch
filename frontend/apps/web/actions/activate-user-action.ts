'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl,
  parseApiErrorMessage
} from '@/lib/server-api'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

function buildUsersPageUrl(messageKey?: 'error' | 'success', message?: string) {
  const params = new URLSearchParams()
  if (messageKey && message) {
    params.set(messageKey, message)
  }
  return params.size > 0 ? `/users?${params.toString()}` : '/users'
}

export async function activateUserAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    redirect(buildUsersPageUrl('error', API_URL_NOT_CONFIGURED_MESSAGE))
  }

  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) {
    redirect(
      buildUsersPageUrl('error', 'Не выбран пользователь для активации.')
    )
  }

  const response = await fetch(`${apiBaseUrl}/api/users/${userId}/activate/`, {
    method: 'POST',
    headers: buildServerApiHeaders({ session }),
    cache: 'no-store'
  })

  if (!response.ok) {
    let message = 'Не удалось активировать пользователя.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body, message)
    } catch {
      // ignore json parsing errors
    }
    redirect(buildUsersPageUrl('error', message))
  }

  redirect(buildUsersPageUrl('success', 'Пользователь активирован.'))
}
