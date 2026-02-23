'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'

export type UploadCanteenQrResult =
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

export async function uploadCanteenQrAction(
  formData: FormData
): Promise<UploadCanteenQrResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войдите заново.' }
  }

  const qrFile = formData.get('payment_qr')
  if (!(qrFile instanceof File) || qrFile.size === 0) {
    return { ok: false, message: 'Выберите файл QR-изображения.' }
  }

  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return { ok: false, message: 'API_URL не настроен.' }
  }

  const requestData = new FormData()
  requestData.append('payment_qr', qrFile)

  const response = await fetch(`${apiUrl}/api/branding/payment-qr/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    },
    body: requestData
  })

  if (!response.ok) {
    let message = 'Не удалось загрузить QR-изображение.'
    try {
      const body = await response.json()
      const parsed = parseApiErrorMessage(body)
      if (parsed) {
        message = parsed
      }
    } catch {
      // ignore json parsing errors
    }
    return { ok: false, message }
  }

  return { ok: true, message: 'QR-изображение успешно загружено.' }
}
