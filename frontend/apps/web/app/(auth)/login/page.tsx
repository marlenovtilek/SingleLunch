import { LoginForm } from '@/components/forms/login-form'
import { getBranding } from '@/lib/branding'
import type { Metadata } from 'next'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: 'Вход - SingleLunch'
}

export default async function Login() {
  const branding = await getBranding()

  return (
    <Suspense fallback={null}>
      <LoginForm projectName={branding.projectName} />
    </Suspense>
  )
}
