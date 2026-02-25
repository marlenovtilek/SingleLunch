import { LoginForm } from '@/components/forms/login-form'
import { getBranding } from '@/lib/branding'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Вход - SingleLunch'
}

// Branding should be read on each request in production.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Login() {
  const branding = await getBranding()

  return (
    <Suspense fallback={null}>
      <LoginForm projectName={branding.projectName} />
    </Suspense>
  )
}
