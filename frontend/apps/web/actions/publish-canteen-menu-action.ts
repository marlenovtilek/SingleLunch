'use server'

import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { parseApiClientError } from '@/lib/server-api'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

type CanteenOptionPayload = {
  name: string
}

export type PublishCanteenMenuPayload = {
  mode: 'create' | 'edit'
  menuDate: string
  selectionDeadlineLocal: string
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
      name: String(option.name ?? '').trim()
    }))
    .filter((option) => option.name)

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
    const requestBody = {
      date: payload.menuDate,
      selection_deadline: selectionDeadline,
      options: preparedOptions
    }

    if (payload.mode === 'edit') {
      await apiClient.v1.v1CanteenMenuEditUpdate(requestBody)
      return { ok: true, message: 'Меню обновлено.' }
    }

    await apiClient.v1.v1CanteenMenuUpdate(requestBody)

    return { ok: true, message: 'Меню сохранено.' }
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: parseApiClientError(error, 'Не удалось сохранить меню.')
      }
    }
    return { ok: false, message: 'Сервис недоступен. Попробуй позже.' }
  }
}
