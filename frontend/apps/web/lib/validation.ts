import { z } from 'zod'

function isValidBirthDate(value: string): boolean {
  if (!value) {
    return false
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return false
  }
  const today = new Date()
  if (date > today) {
    return false
  }
  return date.getUTCFullYear() >= 1900
}

const loginFormSchema = z.object({
  username: z.string().min(1, 'Логин обязателен'),
  password: z.string().min(1, 'Пароль обязателен')
})

const registerFormSchema = z
  .object({
    username: z.string().min(1, 'Логин обязателен'),
    birthDate: z
      .string()
      .refine((value) => isValidBirthDate(value), 'Некорректная дата рождения'),
    phoneNumber: z
      .string()
      .min(9, 'Номер телефона обязателен')
      .regex(/^[0-9+\-() ]+$/, 'Некорректный формат номера телефона'),
    department: z.string().uuid('Выберите департамент'),
    password: z.string().min(8, 'Пароль должен быть не менее 8 символов'),
    passwordRetype: z.string().min(8, 'Пароль должен быть не менее 8 символов')
  })
  .refine((data) => data.password === data.passwordRetype, {
    message: 'Пароли не совпадают',
    path: ['passwordRetype']
  })

const profileFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  birthDate: z
    .string()
    .refine(
      (value) => value === '' || isValidBirthDate(value),
      'Birth date is invalid'
    )
    .optional()
    .or(z.literal('')),
  phoneNumber: z
    .string()
    .regex(/^[0-9+\-() ]+$/, 'Phone number format is invalid')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .uuid('Department is required')
    .optional()
    .or(z.literal('')),
  telegramId: z
    .string()
    .max(50, 'Telegram ID должен быть не длиннее 50 символов')
    .optional()
    .or(z.literal('')),
  mattermostId: z
    .string()
    .max(50, 'Mattermost ID должен быть не длиннее 50 символов')
    .optional()
    .or(z.literal(''))
})

const changePasswordFormSchema = z
  .object({
    password: z.string().min(1, 'Current password is required'),
    passwordNew: z.string().min(8, 'Password must be at least 8 characters'),
    passwordRetype: z.string().min(8, 'Password must be at least 8 characters')
  })
  .refine((data) => data.passwordNew !== data.password, {
    message: 'Both new and current passwords are same',
    path: ['passwordNew']
  })
  .refine((data) => data.passwordNew === data.passwordRetype, {
    message: 'Passwords are not matching',
    path: ['passwordRetype']
  })

export {
  changePasswordFormSchema,
  loginFormSchema,
  profileFormSchema,
  registerFormSchema
}
