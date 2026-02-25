'use server'

import { getApiClient } from '@/lib/api'
import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { parseApiClientError } from '@/lib/server-api'
import { ApiError } from '@frontend/types/api'
import { getServerSession } from 'next-auth'

type CreateOrderItemPayload = {
  menuOptionId: string
  quantity: number
}

export type CreateOrderPayload = {
  dailyMenuId: string
  items: CreateOrderItemPayload[]
}

export type CreateOrderResult =
  | { ok: true; orderId: string | undefined }
  | { ok: false; message: string }

export async function createOrderAction(
  payload: CreateOrderPayload
): Promise<CreateOrderResult> {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    return { ok: false, message: 'Сессия истекла. Войди в аккаунт заново.' }
  }

  if (session.user.is_staff || session.user.is_superuser) {
    return {
      ok: false,
      message: 'Администратор не может оформлять заказы.'
    }
  }

  if (payload.items.length === 0) {
    return { ok: false, message: 'Выбери хотя бы одно блюдо.' }
  }

  try {
    const apiClient = await getApiClient(session)
    const order = await apiClient.v1.v1OrdersCreate({
      daily_menu_id: payload.dailyMenuId,
      items: payload.items.map((item) => ({
        menu_option_id: item.menuOptionId,
        quantity: item.quantity
      }))
    })

    return { ok: true, orderId: order.id }
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: parseApiClientError(
          error,
          'Не удалось создать заказ. Проверь данные и попробуй снова.'
        )
      }
    }
    return { ok: false, message: 'Сервис недоступен. Попробуй позже.' }
  }
}
