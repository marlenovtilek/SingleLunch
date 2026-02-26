'use client'

import type { profileAction } from '@/actions/profile-action'
import { fieldApiError } from '@/lib/forms'
import { profileFormSchema } from '@/lib/validation'
import type { UserCurrent } from '@frontend/types/api'
import { SubmitField } from '@frontend/ui/forms/submit-field'
import { TextField } from '@frontend/ui/forms/text-field'
import { SuccessMessage } from '@frontend/ui/messages/success-message'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

export type ProfileFormSchema = z.infer<typeof profileFormSchema>

export function ProfileForm({
  currentUser,
  onSubmitHandler,
  departments
}: {
  currentUser: UserCurrent
  onSubmitHandler: typeof profileAction
  departments: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(false)
  const telegramBotUrl =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL?.trim() || 'https://t.me'

  const initialValues = {
    firstName: currentUser.first_name || '',
    lastName: currentUser.last_name || '',
    birthDate: currentUser.birth_date || '',
    phoneNumber: currentUser.phone_number || '',
    department: currentUser.department || '',
    telegramId: currentUser.telegram_id || '',
    mattermostId: currentUser.mattermost_id || ''
  }

  const { formState, handleSubmit, register, setError, reset } =
    useForm<ProfileFormSchema>({
      resolver: zodResolver(profileFormSchema),
      defaultValues: initialValues
    })

  return (
    <section className="mx-auto w-full max-w-4xl space-y-2 sm:space-y-3">
      <header className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-3 sm:rounded-2xl sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Личный кабинет
        </h1>
      </header>

      <form
        method="post"
        className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5"
        onSubmit={handleSubmit(async (data) => {
          const res = await onSubmitHandler(data)

          if (res !== true && typeof res !== 'boolean') {
            setSuccess(false)

            fieldApiError('first_name', 'firstName', res, setError)
            fieldApiError('last_name', 'lastName', res, setError)
            fieldApiError('birth_date', 'birthDate', res, setError)
            fieldApiError('phone_number', 'phoneNumber', res, setError)
            fieldApiError('department', 'department', res, setError)
            fieldApiError('telegram_id', 'telegramId', res, setError)
            fieldApiError('mattermost_id', 'mattermostId', res, setError)
          } else {
            setSuccess(true)
            setIsEditing(false)
            router.refresh()
          }
        })}
      >
        {success && <SuccessMessage>Профиль успешно обновлен</SuccessMessage>}

        <div className="grid gap-2 lg:grid-cols-2 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Основные данные
            </p>
            <TextField
              type="text"
              register={register('firstName')}
              label="Имя"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />

            <TextField
              type="text"
              register={register('lastName')}
              label="Фамилия"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />

            <TextField
              type="date"
              register={register('birthDate')}
              label="Дата рождения"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />

            <label className="mb-2 flex flex-row flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] font-medium leading-none text-slate-700 sm:text-xs">
                Департамент
              </span>
              <select
                className="block h-8 max-w-none flex-1 rounded-md bg-white px-2.5 text-xs font-medium shadow-sm outline outline-1 outline-gray-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:h-9 sm:px-3 sm:text-sm"
                {...register('department')}
                disabled={!isEditing}
                defaultValue={currentUser.department || ''}
              >
                <option value="">Не выбран</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              {formState.errors.department && (
                <div className="mt-0 w-full text-xs text-red-600 [margin-left:6.5rem]">
                  {formState.errors.department.message?.toString()}
                </div>
              )}
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Контакты и уведомления
            </p>
            <TextField
              type="text"
              register={register('phoneNumber')}
              label="Номер телефона"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />

            <TextField
              type="text"
              register={register('telegramId')}
              label="Telegram ID"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />
            <p className="-mt-1 mb-2 text-[10px] text-slate-500 sm:mb-3 sm:text-[11px] [margin-left:6.5rem]">
              Для уведомлений подпишись на бота:{' '}
              <a
                href={telegramBotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
              >
                Открыть Telegram-бота
              </a>
            </p>

            <TextField
              type="text"
              register={register('mattermostId')}
              label="Mattermost ID"
              formState={formState}
              disabled={!isEditing}
              compact
              inline
            />
          </div>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setSuccess(false)
              setIsEditing(true)
            }}
            className="mt-3 block h-9 w-full rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 sm:mt-4 sm:h-10"
          >
            Редактировать профиль
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row">
            <SubmitField isLoading={formState.isSubmitting} compact>
              Сохранить
            </SubmitField>
            <button
              type="button"
              onClick={() => {
                reset(initialValues)
                setSuccess(false)
                setIsEditing(false)
              }}
              className="block h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:h-10"
            >
              Отмена
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
