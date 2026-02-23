'use client'

import { loginFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { ErrorMessage } from '@frontend/ui/messages/error-message'
import { SuccessMessage } from '@frontend/ui/messages/success-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

type LoginFormSchema = z.infer<typeof loginFormSchema>

export function LoginForm({
  projectName = 'SingleLunch'
}: {
  projectName?: string
}) {
  const search = useSearchParams()

  const { register, handleSubmit, formState } = useForm<LoginFormSchema>({
    resolver: zodResolver(loginFormSchema)
  })

  const onSubmitHandler = handleSubmit((data) => {
    signIn('credentials', {
      username: data.username,
      password: data.password,
      callbackUrl: '/menu-today'
    })
  })

  return (
    <>
      <FormHeader
        title={`Вход в ${projectName}`}
        description="Система автоматизации обедов"
      />

      {search.has('error') && search.get('error') === 'CredentialsSignin' && (
        <ErrorMessage>Неверный логин или пароль.</ErrorMessage>
      )}
      {search.get('registered') === '1' && (
        <SuccessMessage>
          Регистрация завершена. Дождитесь активации аккаунта администратором и
          затем войдите.
        </SuccessMessage>
      )}

      <form
        method="post"
        action="/api/auth/callback/credentials"
        onSubmit={onSubmitHandler}
      >
        <TextField
          type="text"
          register={register('username')}
          formState={formState}
          label="Логин"
          placeholder="Имя пользователя"
        />

        <TextField
          type="password"
          register={register('password', { required: true })}
          formState={formState}
          label="Пароль"
          placeholder="Введите пароль"
          allowPasswordToggle
        />

        <SubmitField>Войти</SubmitField>
      </form>

      <FormFooter cta="Нет аккаунта?" link="/register" title="Регистрация" />
    </>
  )
}
