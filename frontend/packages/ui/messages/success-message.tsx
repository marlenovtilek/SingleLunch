'use client'

import type { PropsWithChildren } from 'react'

export function SuccessMessage({ children }: PropsWithChildren) {
  return (
    <div className="mb-3 rounded-md bg-green-100 px-3 py-2 text-xs text-green-700">
      {children}
    </div>
  )
}
