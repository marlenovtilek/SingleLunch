'use server'

import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { parseApiClientError } from '@/lib/server-api'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

export type DeleteCanteenMenuResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export async function deleteCanteenMenuAction(
  menuDate: string
): Promise<DeleteCanteenMenuResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди заново.' }
  }

  if (!menuDate) {
    return { ok: false, message: 'Не указана дата меню.' }
  }

  try {
    const apiClient = await getApiClient(session)
    await apiClient.request.request({
      method: 'DELETE',
      url: '/api/v1/canteen/menu/edit/',
      query: {
        date: menuDate
      }
    })
    return { ok: true, message: 'Меню удалено.' }
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: parseApiClientError(error, 'Не удалось удалить меню.')
      }
    }
    return { ok: false, message: 'Сервис недоступен. Попробуй позже.' }
  }
}
