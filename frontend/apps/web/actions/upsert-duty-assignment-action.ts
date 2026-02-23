'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

function buildDutyUrl(
  month: string,
  messageKey?: 'error' | 'success',
  message?: string
) {
  const safeMonth = month || new Date().toISOString().slice(0, 7)
  const params = new URLSearchParams({ month: safeMonth })
  if (messageKey && message) {
    params.set(messageKey, message)
  }
  return `/duty?${params.toString()}`
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

  return 'Не удалось сохранить дежурство.'
}

export async function upsertDutyAssignmentAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    redirect(buildDutyUrl('', 'error', 'API_URL не настроен.'))
  }

  const month = String(formData.get('month') ?? '')
  const dutyDate = String(formData.get('date') ?? '').trim()
  const assigneeId = String(formData.get('assignee_id') ?? '').trim()

  if (!dutyDate) {
    redirect(buildDutyUrl(month, 'error', 'Выбери дату дежурства.'))
  }

  const response = await fetch(`${apiUrl}/api/v1/duty/assign/`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      date: dutyDate,
      assignee_id: assigneeId || null
    }),
    cache: 'no-store'
  })

  if (!response.ok) {
    let message = 'Не удалось сохранить дежурство.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body)
    } catch {
      // ignore parse errors
    }
    redirect(buildDutyUrl(month, 'error', message))
  }

  redirect(buildDutyUrl(month, 'success', '1'))
}
