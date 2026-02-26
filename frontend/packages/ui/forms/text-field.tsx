'use client'

import { Eye, EyeOff } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type {
  FieldValues,
  FormState,
  UseFormRegisterReturn
} from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

export function TextField({
  type,
  label,
  placeholder,
  register,
  formState,
  disabled,
  allowPasswordToggle = false,
  compact = false
}: {
  type: 'text' | 'password' | 'number' | 'date'
  label: string
  placeholder?: string
  register: UseFormRegisterReturn
  formState: FormState<FieldValues>
  disabled?: boolean
  allowPasswordToggle?: boolean
  compact?: boolean
}): React.ReactElement {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const hasError = formState.errors[register.name]
  const canTogglePassword = type === 'password' && allowPasswordToggle
  const currentType = canTogglePassword && isPasswordVisible ? 'text' : type

  return (
    <label
      className={twMerge(
        'mb-3 flex flex-col last:mb-0',
        compact && 'mb-2'
      )}
    >
      <span
        className={twMerge(
          'mb-1.5 block text-xs font-medium leading-none text-slate-700',
          compact && 'mb-1 text-[11px]'
        )}
      >
        {label}
      </span>

      <div className="relative max-w-lg">
        <input
          type={currentType}
          placeholder={placeholder}
          disabled={disabled}
          className={twMerge(
            'block h-9 w-full rounded-md bg-white px-3 text-sm font-medium shadow-sm outline outline-1 outline-gray-900/10 focus:outline-sky-600 focus:ring-2 focus:ring-sky-200',
            compact && 'h-8 px-2.5 text-xs',
            canTogglePassword && 'pr-12',
            compact && canTogglePassword && 'pr-10',
            hasError &&
              'outline-red-700 focus:outline-red-600 focus:ring-red-300',
            disabled && 'cursor-not-allowed bg-slate-100 text-slate-500'
          )}
          {...register}
        />
        {canTogglePassword && (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            className={twMerge(
              'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 hover:bg-slate-100',
              compact && 'right-1.5 p-0.5'
            )}
            aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {isPasswordVisible ? (
              <EyeOff size={compact ? 14 : 16} />
            ) : (
              <Eye size={compact ? 14 : 16} />
            )}
          </button>
        )}
      </div>

      {hasError && (
        <div className={twMerge('mt-1 text-xs text-red-600', compact && 'mt-0.5 text-[11px]')}>
          {formState.errors[register.name]?.message?.toString()}
        </div>
      )}
    </label>
  )
}
