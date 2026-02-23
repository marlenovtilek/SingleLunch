import { ApiClient, ApiError } from '@frontend/types/api'
import type { AuthOptions } from 'next-auth'
import type { Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getApiClient } from './api'

async function isAccessTokenStillValid(accessToken: string): Promise<boolean> {
  const apiUrl = process.env.API_URL
  if (!apiUrl) {
    return true
  }

  try {
    const apiClient = new ApiClient({
      BASE: apiUrl,
      HEADERS: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    await apiClient.users.usersMeRetrieve()
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return false
    }
    return true
  }
}

function decodeToken(token: string): {
  token_type: string
  exp: number
  iat: number
  jti: string
  user_id: string
} {
  return JSON.parse(atob(token.split('.')[1]))
}

function decodeTokenSafe(token?: string): {
  token_type: string
  exp: number
  iat: number
  jti: string
  user_id: string
} | null {
  if (!token) {
    return null
  }

  try {
    return decodeToken(token)
  } catch {
    return null
  }
}

function unauthorizedSession(session: Session): Session {
  return {
    ...session,
    accessToken: '',
    refreshToken: '',
    error: 'UnauthorizedSession',
    user: {
      id: '',
      username: '',
      role: 'EMPLOYEE',
      is_staff: false,
      is_superuser: false
    }
  }
}

export function isSessionAuthorized(
  session?: Session | null
): session is Session {
  return Boolean(
    session?.accessToken && session?.refreshToken && session?.user?.id
  )
}

const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (token.error || !token.access || !token.refresh) {
        return unauthorizedSession(session)
      }

      const access = decodeTokenSafe(token.access)
      const refresh = decodeTokenSafe(token.refresh)

      if (!access || !refresh) {
        return unauthorizedSession(session)
      }

      if (Date.now() / 1000 > access.exp && Date.now() / 1000 > refresh.exp) {
        return unauthorizedSession(session)
      }

      session.user = {
        id: access.user_id,
        username: token.username,
        role: token.role ?? 'EMPLOYEE',
        is_staff: token.is_staff ?? false,
        is_superuser: token.is_superuser ?? false
      }

      session.refreshToken = token.refresh
      session.accessToken = token.access

      return session
    },
    jwt: async ({ token, user }) => {
      if (user?.username) {
        return {
          ...token,
          ...user,
          userValidatedAt: Math.floor(Date.now() / 1000)
        }
      }

      if (!token.access || !token.refresh) {
        return token
      }

      const access = decodeTokenSafe(token.access)
      const refresh = decodeTokenSafe(token.refresh)
      if (!access || !refresh) {
        return {
          ...token,
          access: '',
          refresh: '',
          error: 'InvalidTokenPayload'
        }
      }

      const nowUnix = Math.floor(Date.now() / 1000)

      if (nowUnix > refresh.exp) {
        return {
          ...token,
          access: '',
          refresh: '',
          error: 'RefreshTokenExpired'
        }
      }

      let shouldRevalidateUser = false

      // Refresh token
      if (nowUnix > access.exp) {
        const apiClient = await getApiClient()
        try {
          const res = await apiClient.token.tokenRefreshCreate({
            refresh: token.refresh
          } as never)
          token.access = res.access
          token.error = undefined
          shouldRevalidateUser = true
        } catch {
          return {
            ...token,
            access: '',
            refresh: '',
            error: 'RefreshAccessTokenError'
          }
        }
      }

      if (!token.userValidatedAt || nowUnix - token.userValidatedAt > 300) {
        shouldRevalidateUser = true
      }

      if (shouldRevalidateUser) {
        const isValid = await isAccessTokenStillValid(token.access)
        if (!isValid) {
          return {
            ...token,
            access: '',
            refresh: '',
            error: 'UnauthorizedUser',
            userValidatedAt: undefined
          }
        }
        token.userValidatedAt = nowUnix
      }

      return { ...token, ...user }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: {
          label: 'Email',
          type: 'text'
        },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (credentials === undefined) {
          return null
        }

        try {
          const apiClient = await getApiClient()
          const res = await apiClient.token.tokenCreate({
            username: credentials.username,
            password: credentials.password,
            access: '',
            refresh: ''
          })

          const apiClientWithToken = new ApiClient({
            BASE: process.env.API_URL,
            HEADERS: {
              Authorization: `Bearer ${res.access}`
            }
          })
          const currentUser = await apiClientWithToken.users.usersMeRetrieve()

          return {
            id: decodeToken(res.access).user_id,
            username: currentUser.username,
            role: currentUser.role ?? 'EMPLOYEE',
            is_staff: currentUser.is_staff ?? false,
            is_superuser: currentUser.is_superuser ?? false,
            access: res.access,
            refresh: res.refresh
          }
        } catch (error) {
          if (error instanceof ApiError) {
            return null
          }
        }

        return null
      }
    })
  ]
}

export { authOptions }
