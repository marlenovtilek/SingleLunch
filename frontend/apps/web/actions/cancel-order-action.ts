'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'

export type CancelOrderResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

function parseApiErrorMessage(body: unknown): string | null {
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

  return null
}

export async function cancelOrderAction(
  orderId: string
): Promise<CancelOrderResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди заново.' }
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return { ok: false, message: 'API_URL не настроен.' }
  }

  const response = await fetch(`${apiUrl}/api/v1/orders/${orderId}/cancel/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  if (!response.ok) {
    let message = 'Не удалось отменить заказ.'
    try {
      const body = await response.json()
      const parsed = parseApiErrorMessage(body)
      if (parsed) {
        message = parsed
      }
    } catch {
      // ignore JSON parse errors
    }
    return { ok: false, message }
  }

  return { ok: true, message: 'Заказ отменен.' }
}
