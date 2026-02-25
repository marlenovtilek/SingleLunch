import { ApiError } from '@frontend/types/api'
import type { Session } from 'next-auth'

export const API_URL_NOT_CONFIGURED_MESSAGE = 'API_URL не настроен.'

type SessionWithAccessToken = Pick<Session, 'accessToken'>

export function getServerApiBaseUrl(): string | null {
  const raw = process.env.API_URL?.trim()
  if (!raw) {
    return null
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

export function buildServerApiUrl(path: string): string | null {
  const baseUrl = getServerApiBaseUrl()
  if (!baseUrl) {
    return null
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

export function buildServerApiHeaders({
  session,
  headers
}: {
  session?: SessionWithAccessToken | null
  headers?: HeadersInit
} = {}): Headers {
  const result = new Headers(headers)
  result.set('X-Forwarded-Proto', 'https')
  if (session?.accessToken) {
    result.set('Authorization', `Bearer ${session.accessToken}`)
  }
  return result
}

export function parseApiErrorBody(body: unknown): string | null {
  if (typeof body === 'string' && body.length > 0) {
    return body
  }

  if (body && typeof body === 'object') {
    const firstValue = Object.values(body)[0]
    if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
      return firstValue[0]
    }
    if (typeof firstValue === 'string') {
      return firstValue
    }
  }

  return null
}

export function parseApiErrorMessage(body: unknown, fallback: string): string {
  return parseApiErrorBody(body) ?? fallback
}

export function parseApiClientError(error: ApiError, fallback: string): string {
  return parseApiErrorMessage(error.body, fallback)
}
