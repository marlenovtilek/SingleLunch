import { registerAction } from '@/actions/register-action'
import { RegisterForm } from '@/components/forms/register-form'
import { getBranding } from '@/lib/branding'
import { getPublicDepartments } from '@/lib/departments'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Регистрация - SingleLunch'
}

export default async function Register() {
  const [branding, departments] = await Promise.all([
    getBranding(),
    getPublicDepartments()
  ])

  return (
    <RegisterForm
      onSubmitHandler={registerAction}
      departments={departments}
      projectName={branding.projectName}
    />
  )
}
