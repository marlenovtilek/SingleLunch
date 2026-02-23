'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'

export type UploadPaymentResult =
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

export async function uploadPaymentAction(
  orderId: string,
  formData: FormData
): Promise<UploadPaymentResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди заново.' }
  }

  const screenshot = formData.get('screenshot')
  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return { ok: false, message: 'Выбери файл скриншота для загрузки.' }
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return { ok: false, message: 'API_URL не настроен.' }
  }

  const requestData = new FormData()
  requestData.append('screenshot', screenshot)

  const response = await fetch(`${apiUrl}/api/v1/orders/${orderId}/payment/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    },
    body: requestData
  })

  if (!response.ok) {
    let message = 'Не удалось загрузить скриншот оплаты.'
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

  return {
    ok: true,
    message: 'Скриншот загружен. Статус заказа: Оплачен.'
  }
}
