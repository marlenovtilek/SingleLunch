'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl,
  parseApiErrorMessage
} from '@/lib/server-api'
import { getServerSession } from 'next-auth'

export type UploadPaymentResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

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

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    return { ok: false, message: API_URL_NOT_CONFIGURED_MESSAGE }
  }

  const requestData = new FormData()
  requestData.append('screenshot', screenshot)

  const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/payment/`, {
    method: 'POST',
    headers: buildServerApiHeaders({ session }),
    body: requestData
  })

  if (!response.ok) {
    let message = 'Не удалось загрузить скриншот оплаты.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body, message)
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
