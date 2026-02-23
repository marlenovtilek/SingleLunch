'use client'

import { SessionProvider } from 'next-auth/react'
import type { PropsWithChildren } from 'react'

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  )
}
