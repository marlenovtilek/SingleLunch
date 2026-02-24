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
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

type LoginFormSchema = z.infer<typeof loginFormSchema>

export function LoginForm({
  projectName = 'SingleLunch'
}: {
  projectName?: string
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [authError, setAuthError] = useState<string | null>(null)

  const { register, handleSubmit, formState, setValue } =
    useForm<LoginFormSchema>({
      resolver: zodResolver(loginFormSchema)
    })

  const onSubmitHandler = handleSubmit(async (data) => {
    setAuthError(null)

    const result = await signIn('credentials', {
      username: data.username,
      password: data.password,
      rememberMe: data.rememberMe ? '1' : '0',
      callbackUrl: '/menu-today',
      redirect: false
    })

    if (result?.error) {
      if (result.error === 'InvalidUsername') {
        setAuthError('Неверный логин.')
        setValue('username', '', { shouldValidate: true })
        return
      }
      if (result.error === 'InvalidPassword') {
        setAuthError('Неверный пароль.')
        setValue('password', '', { shouldValidate: true })
        return
      }
      setAuthError('Неверный логин или пароль.')
      return
    }

    router.push(result?.url ?? '/menu-today')
  })

  return (
    <>
      <FormHeader
        title={`Вход в ${projectName}`}
        description="Система автоматизации обедов"
      />

      {authError && <ErrorMessage>{authError}</ErrorMessage>}
      {!authError &&
        search.has('error') &&
        search.get('error') === 'CredentialsSignin' && (
          <ErrorMessage>Неверный логин или пароль.</ErrorMessage>
        )}
      {search.get('registered') === '1' && (
        <SuccessMessage>
          Регистрация завершена. Дождитесь активации аккаунта администратором и
          затем войдите.
        </SuccessMessage>
      )}

      <form onSubmit={onSubmitHandler}>
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

        <label className="mb-3 flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            {...register('rememberMe')}
          />
          Запомнить меня
        </label>

        <SubmitField>Войти</SubmitField>
      </form>

      <FormFooter cta="Нет аккаунта?" link="/register" title="Регистрация" />
    </>
  )
}
