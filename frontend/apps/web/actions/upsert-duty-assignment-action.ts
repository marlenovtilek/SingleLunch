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

export async function upsertDutyAssignmentAction(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    redirect(buildDutyUrl('', 'error', API_URL_NOT_CONFIGURED_MESSAGE))
  }

  const month = String(formData.get('month') ?? '')
  const dutyDate = String(formData.get('date') ?? '').trim()
  const assigneeId = String(formData.get('assignee_id') ?? '').trim()

  if (!dutyDate) {
    redirect(buildDutyUrl(month, 'error', 'Выбери дату дежурства.'))
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/duty/assign/`, {
    method: 'PUT',
    headers: buildServerApiHeaders({
      session,
      headers: {
        'Content-Type': 'application/json'
      }
    }),
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
      message = parseApiErrorMessage(body, message)
    } catch {
      // ignore parse errors
    }
    redirect(buildDutyUrl(month, 'error', message))
  }

  redirect(buildDutyUrl(month, 'success', '1'))
}
