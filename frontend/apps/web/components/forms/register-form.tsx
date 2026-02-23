'use client'

import type {
  RegisterFormSchema,
  registerAction
} from '@/actions/register-action'
import { fieldApiError } from '@/lib/forms'
import { registerFormSchema } from '@/lib/validation'
import { FormFooter } from '@frontend/ui/forms/form-footer'
import { FormHeader } from '@frontend/ui/forms/form-header'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

export function RegisterForm({
  onSubmitHandler,
  departments,
  projectName = 'SingleLunch'
}: {
  onSubmitHandler: typeof registerAction
  departments: Array<{ id: string; name: string }>
  projectName?: string
}) {
  const router = useRouter()
  const { formState, handleSubmit, register, setError } =
    useForm<RegisterFormSchema>({
      resolver: zodResolver(registerFormSchema)
    })

  return (
    <>
      <FormHeader
        title={`Регистрация в ${projectName}`}
        description="Система автоматизации обедов"
      />

      <form
        method="post"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)

          if (res === true) {
            router.push('/login?registered=1')
          } else if (typeof res !== 'boolean') {
            fieldApiError('username', 'username', res, setError)
            fieldApiError('birth_date', 'birthDate', res, setError)
            fieldApiError('phone_number', 'phoneNumber', res, setError)
            fieldApiError('department', 'department', res, setError)
            fieldApiError('password', 'password', res, setError)
            fieldApiError('password_retype', 'passwordRetype', res, setError)
          }
        })}
      >
        <TextField
          type="text"
          register={register('username')}
          formState={formState}
          label="Логин"
          placeholder="Придумай логин"
        />

        <TextField
          type="date"
          register={register('birthDate')}
          formState={formState}
          label="Дата рождения"
        />

        <TextField
          type="text"
          register={register('phoneNumber')}
          formState={formState}
          label="Номер телефона"
          placeholder="+996 555 123 456"
        />

        <label className="mb-3 flex flex-col">
          <span className="mb-1.5 block text-xs font-medium leading-none text-slate-700">
            Департамент
          </span>
          <select
            className="block h-9 max-w-lg rounded-md bg-white px-3 text-sm font-medium shadow-sm outline outline-1 outline-gray-900/10"
            {...register('department')}
            defaultValue=""
          >
            <option value="" disabled>
              Выбери департамент
            </option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {formState.errors.department && (
            <div className="mt-1 text-xs text-red-600">
              {formState.errors.department.message?.toString()}
            </div>
          )}
        </label>

        <TextField
          type="password"
          register={register('password')}
          formState={formState}
          label="Пароль"
          placeholder="Введите пароль"
          allowPasswordToggle
        />

        <TextField
          type="password"
          register={register('passwordRetype')}
          formState={formState}
          label="Повтори пароль"
          placeholder="Повторите пароль"
          allowPasswordToggle
        />

        <SubmitField>Зарегистрироваться</SubmitField>
      </form>

      <FormFooter cta="Уже есть аккаунт?" link="/login" title="Войти" />
    </>
  )
}
