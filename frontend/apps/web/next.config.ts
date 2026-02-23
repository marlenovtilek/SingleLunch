import type { NextConfig } from 'next'

const djangoProxyBase =
  process.env.DJANGO_PROXY_URL || process.env.API_URL || 'http://api:8000'

function parseOrigins(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

const allowedDevOrigins = Array.from(
  new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...parseOrigins(process.env.NEXTAUTH_URL),
    ...parseOrigins(process.env.NEXT_PUBLIC_APP_URL),
    ...parseOrigins(process.env.ALLOWED_DEV_ORIGINS)
  ])
)

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@frontend/types', '@frontend/ui'],
  skipTrailingSlashRedirect: true,
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: `${djangoProxyBase}/media/:path*`
      }
    ]
  }
}

export default nextConfig
