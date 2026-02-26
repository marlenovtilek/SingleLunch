'use server'

import { getApiClient } from '@/lib/api'
import type { registerFormSchema } from '@/lib/validation'
import {
  ApiError,
  type UserCreate,
  type UserCreateError
} from '@frontend/types/api'
import type { z } from 'zod'

export type RegisterFormSchema = z.infer<typeof registerFormSchema>

export async function registerAction(
  data: RegisterFormSchema
): Promise<UserCreateError | boolean> {
  try {
    const apiClient = await getApiClient()

    const payload: {
      username: string
      password: string
      password_retype: string
      birth_date?: string
      phone_number?: string
      department?: string
    } = {
      username: data.username,
      password: data.password,
      password_retype: data.passwordRetype
    }

    if (data.birthDate) {
      payload.birth_date = data.birthDate
    }
    if (data.phoneNumber) {
      payload.phone_number = data.phoneNumber
    }
    if (data.department) {
      payload.department = data.department
    }

    await apiClient.users.usersCreate(payload as unknown as UserCreate)

    return true
  } catch (error) {
    if (error instanceof ApiError) {
      return error.body as UserCreateError
    }
  }

  return false
}
