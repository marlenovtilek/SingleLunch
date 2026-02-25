'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl,
  parseApiErrorMessage
} from '@/lib/server-api'
import { getServerSession } from 'next-auth'

export type CancelOrderResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export async function cancelOrderAction(
  orderId: string
): Promise<CancelOrderResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди заново.' }
  }

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    return { ok: false, message: API_URL_NOT_CONFIGURED_MESSAGE }
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/cancel/`, {
    method: 'POST',
    headers: buildServerApiHeaders({ session })
  })

  if (!response.ok) {
    let message = 'Не удалось отменить заказ.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body, message)
    } catch {
      // ignore JSON parse errors
    }
    return { ok: false, message }
  }

  return { ok: true, message: 'Заказ отменен.' }
}
