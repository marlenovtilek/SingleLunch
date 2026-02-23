import { profileAction } from '@/actions/profile-action'
import { ProfileForm } from '@/components/forms/profile-form'
import { getCurrentUserOrRedirect } from '@/lib/account'
import { getPublicDepartments } from '@/lib/departments'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Профиль - SingleLunch'
}

export default async function Profile() {
  const [{ user: currentUser }, departments] = await Promise.all([
    getCurrentUserOrRedirect(),
    getPublicDepartments()
  ])

  return (
    <ProfileForm
      currentUser={currentUser}
      onSubmitHandler={profileAction}
      departments={departments}
    />
  )
}
