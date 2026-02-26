'use client'

import type { changePasswordAction } from '@/actions/change-password-action'
import { fieldApiError } from '@/lib/forms'
import { changePasswordFormSchema } from '@/lib/validation'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { SuccessMessage } from '@frontend/ui/messages/success-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

export type ChangePasswordFormSchema = z.infer<typeof changePasswordFormSchema>

export function ChangePaswordForm({
  onSubmitHandler
}: {
  onSubmitHandler: typeof changePasswordAction
}) {
  const [success, setSuccess] = useState<boolean>(false)

  const { formState, handleSubmit, register, reset, setError } =
    useForm<ChangePasswordFormSchema>({
      resolver: zodResolver(changePasswordFormSchema)
    })

  return (
    <section className="mx-auto w-full max-w-2xl space-y-2 sm:space-y-3">
      <header className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-3 sm:rounded-2xl sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Безопасность
        </h1>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          Обнови пароль для входа в аккаунт.
        </p>
        <ul className="mt-2 hidden space-y-1 text-xs text-slate-600 sm:mt-3 sm:block">
          <li>• Используй минимум 8 символов.</li>
          <li>• Добавь цифры и буквы разного регистра.</li>
          <li>• Не используй старый пароль повторно.</li>
        </ul>
      </header>

      {success && <SuccessMessage>Пароль успешно изменен</SuccessMessage>}

      <form
        method="post"
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)

          if (res !== true && typeof res !== 'boolean') {
            setSuccess(false)
            fieldApiError('password', 'password', res, setError)
            fieldApiError('password_new', 'passwordNew', res, setError)
            fieldApiError('password_retype', 'passwordRetype', res, setError)
          } else {
            reset()
            setSuccess(true)
          }
        })}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
          <TextField
            type="password"
            register={register('password')}
            label="Текущий пароль"
            formState={formState}
            allowPasswordToggle
            compact
          />

          <TextField
            type="password"
            register={register('passwordNew')}
            label="Новый пароль"
            formState={formState}
            allowPasswordToggle
            compact
          />

          <TextField
            type="password"
            register={register('passwordRetype')}
            label="Повтори новый пароль"
            formState={formState}
            allowPasswordToggle
            compact
          />
        </div>

        <div className="mt-3 sm:mt-4">
          <SubmitField isLoading={formState.isSubmitting} compact>
            Сменить пароль
          </SubmitField>
        </div>
      </form>
    </section>
  )
}
