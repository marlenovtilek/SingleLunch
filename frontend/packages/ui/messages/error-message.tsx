'use client'

import type { PropsWithChildren } from 'react'

export function ErrorMessage({ children }: PropsWithChildren) {
  return (
    <div className="mb-3 rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
      {children}
    </div>
  )
}
