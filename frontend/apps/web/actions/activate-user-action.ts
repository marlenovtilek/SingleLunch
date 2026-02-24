'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

function buildUsersPageUrl(messageKey?: 'error' | 'success', message?: string) {
  const params = new URLSearchParams()
  if (messageKey && message) {
    params.set(messageKey, message)
  }
  return params.size > 0 ? `/users?${params.toString()}` : '/users'
}

function parseApiErrorMessage(body: unknown): string {
  if (typeof body === 'string' && body.length > 0) {
    return body
  }
  if (body && typeof body === 'object') {
    const firstValue = Object.values(body)[0]
    if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
      return firstValue[0]
    }
    if (typeof firstValue === 'string') {
      return firstValue
    }
  }
  return 'Не удалось активировать пользователя.'
}

export async function activateUserAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    redirect(buildUsersPageUrl('error', 'API_URL не настроен.'))
  }

  const userId = String(formData.get('user_id') ?? '').trim()
  if (!userId) {
    redirect(
      buildUsersPageUrl('error', 'Не выбран пользователь для активации.')
    )
  }

  const response = await fetch(`${apiUrl}/api/users/${userId}/activate/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    },
    cache: 'no-store'
  })

  if (!response.ok) {
    let message = 'Не удалось активировать пользователя.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body)
    } catch {
      // ignore json parsing errors
    }
    redirect(buildUsersPageUrl('error', message))
  }

  redirect(buildUsersPageUrl('success', 'Пользователь активирован.'))
}
