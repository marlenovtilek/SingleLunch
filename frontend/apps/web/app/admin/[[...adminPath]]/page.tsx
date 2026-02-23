import { authOptions, isSessionAuthorized } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ adminPath?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function buildSearch(
  searchParams: Record<string, string | string[] | undefined>
) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      q.set(key, value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        q.append(key, item)
      }
    }
  }
  const query = q.toString()
  return query ? `?${query}` : ''
}

export default async function AdminRedirectPage({
  params,
  searchParams
}: PageProps) {
  const session = await getServerSession(authOptions)
  if (!isSessionAuthorized(session)) {
    redirect('/login')
  }
  if (!session.user.is_superuser) {
    redirect('/menu-today')
  }

  const requestHeaders = await headers()
  const host = requestHeaders.get('host') || 'localhost:3000'
  const forwardedProto = requestHeaders.get('x-forwarded-proto')
  const protocol = forwardedProto === 'https' ? 'https' : 'http'
  const hostname = host.split(':')[0]
  const djangoPublicUrl =
    process.env.DJANGO_PUBLIC_URL || `${protocol}://${hostname}:8765`

  const pathParts = (await params).adminPath ?? []
  const pathSuffix = pathParts.length > 0 ? `${pathParts.join('/')}/` : ''
  const query = buildSearch(await searchParams)
  const target = `${djangoPublicUrl.replace(/\/$/, '')}/admin/${pathSuffix}${query}`

  redirect(target)
}
