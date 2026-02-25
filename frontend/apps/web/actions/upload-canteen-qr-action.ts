'use server'

import { authOptions, isSessionAuthorized } from '@/lib/auth'
import {
  API_URL_NOT_CONFIGURED_MESSAGE,
  buildServerApiHeaders,
  getServerApiBaseUrl,
  parseApiErrorMessage
} from '@/lib/server-api'
import { getServerSession } from 'next-auth'

export type UploadCanteenQrResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export async function uploadCanteenQrAction(
  formData: FormData
): Promise<UploadCanteenQrResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войдите заново.' }
  }

  const qrFile = formData.get('payment_qr')
  const lunchPriceRaw = String(formData.get('lunch_price') ?? '').trim()

  const apiBaseUrl = getServerApiBaseUrl()
  if (!apiBaseUrl) {
    return { ok: false, message: API_URL_NOT_CONFIGURED_MESSAGE }
  }

  const requestData = new FormData()
  const hasQrFile = qrFile instanceof File && qrFile.size > 0
  if (hasQrFile) {
    requestData.append('payment_qr', qrFile)
  }

  let hasLunchPrice = false
  if (lunchPriceRaw.length > 0) {
    const normalizedLunchPrice = lunchPriceRaw.replace(',', '.')
    const validFormat = /^\d+(\.\d{1,2})?$/.test(normalizedLunchPrice)
    if (!validFormat) {
      return { ok: false, message: 'Введи цену в формате 170 или 170.00.' }
    }
    const price = Number(normalizedLunchPrice)
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, message: 'Цена за порцию должна быть больше нуля.' }
    }
    requestData.append('lunch_price', normalizedLunchPrice)
    hasLunchPrice = true
  }

  if (!hasQrFile && !hasLunchPrice) {
    return { ok: false, message: 'Укажи цену или загрузи QR-изображение.' }
  }

  const response = await fetch(`${apiBaseUrl}/api/branding/payment-qr/`, {
    method: 'POST',
    headers: buildServerApiHeaders({ session }),
    body: requestData
  })

  if (!response.ok) {
    let message = 'Не удалось сохранить настройки оплаты.'
    try {
      const body = await response.json()
      message = parseApiErrorMessage(body, message)
    } catch {
      // ignore json parsing errors
    }
    return { ok: false, message }
  }

  return { ok: true, message: 'Настройки оплаты успешно сохранены.' }
}
