'use client'

import type React from 'react'
import { twMerge } from 'tailwind-merge'

export function SubmitField({
  children,
  isLoading,
  compact = false
}: React.PropsWithChildren<{
  isLoading?: boolean
  compact?: boolean
}>) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className={twMerge(
        'block h-10 w-full rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700',
        compact && 'h-9 text-xs',
        isLoading && 'bg-slate-400'
      )}
    >
      {children}
    </button>
  )
}
