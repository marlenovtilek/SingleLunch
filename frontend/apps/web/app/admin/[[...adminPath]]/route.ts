import { NextRequest, NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ adminPath?: string[] }>
}

function resolveDjangoPublicUrl(request: NextRequest): string {
  const configured = process.env.DJANGO_PUBLIC_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }

  const protocol = request.nextUrl.protocol.replace(':', '') === 'https' ? 'https' : 'http'
  return `${protocol}://${request.nextUrl.hostname}:8765`
}

function clearDjangoAuthCookies(response: NextResponse) {
  response.cookies.set({
    name: 'sessionid',
    value: '',
    path: '/',
    maxAge: 0
  })
  response.cookies.set({
    name: 'csrftoken',
    value: '',
    path: '/',
    maxAge: 0
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  const pathParts = (await context.params).adminPath ?? []
  const pathSuffix = pathParts.length > 0 ? `${pathParts.join('/')}/` : ''
  const requestedAdminPath = `/admin/${pathSuffix}${request.nextUrl.search}`
  const djangoPublicUrl = resolveDjangoPublicUrl(request)
  const target = `${djangoPublicUrl}/admin/login/?next=${encodeURIComponent(requestedAdminPath)}`

  const response = NextResponse.redirect(target)
  clearDjangoAuthCookies(response)
  return response
}
