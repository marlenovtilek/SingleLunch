'use server'

import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

type CanteenOptionPayload = {
  name: string
  price?: string
}

export type PublishCanteenMenuPayload = {
  menuDate: string
  selectionDeadlineLocal: string
  isActive: boolean
  options: CanteenOptionPayload[]
}

export type PublishCanteenMenuResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

function toBishkekOffsetDateTime(localValue: string): string | null {
  const normalized = String(localValue ?? '').trim()
  if (!normalized) {
    return null
  }

  // `datetime-local` value from browser, but business timezone is fixed:
  // always store as Asia/Bishkek (+06:00), independent from client OS timezone.
  const hasMinutesPrecision = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
  if (hasMinutesPrecision) {
    return `${normalized}:00+06:00`
  }

  const hasSecondsPrecision = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(
    normalized
  )
  if (hasSecondsPrecision) {
    return `${normalized}+06:00`
  }

  return null
}

function extractApiErrorMessage(error: ApiError): string {
  const body = error.body
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

  return 'Не удалось сохранить меню.'
}

export async function publishCanteenMenuAction(
  payload: PublishCanteenMenuPayload
): Promise<PublishCanteenMenuResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди заново.' }
  }

  if (!payload.menuDate) {
    return { ok: false, message: 'Укажи дату меню.' }
  }

  if (!payload.selectionDeadlineLocal) {
    return { ok: false, message: 'Укажи дедлайн выбора меню.' }
  }

  const selectionDeadline = toBishkekOffsetDateTime(
    payload.selectionDeadlineLocal
  )
  if (!selectionDeadline) {
    return { ok: false, message: 'Неверный формат дедлайна.' }
  }

  const preparedOptions = (
    Array.isArray(payload.options) ? payload.options : []
  )
    .map((option) => ({
      name: String(option.name ?? '').trim(),
      price: option.price?.trim() || undefined
    }))
    .filter((option) => option.name || option.price)

  if (preparedOptions.length === 0) {
    return { ok: false, message: 'Добавь хотя бы одну позицию меню.' }
  }

  if (preparedOptions.some((option) => !option.name)) {
    return {
      ok: false,
      message: 'У каждой позиции обязательно заполни название.'
    }
  }

  try {
    const apiClient = await getApiClient(session)
    await apiClient.v1.v1CanteenMenuUpdate({
      date: payload.menuDate,
      selection_deadline: selectionDeadline,
      is_active: payload.isActive,
      options: preparedOptions
    })

    return { ok: true, message: 'Меню сохранено.' }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: extractApiErrorMessage(error) }
    }
    return { ok: false, message: 'Сервис недоступен. Попробуй позже.' }
  }
}
