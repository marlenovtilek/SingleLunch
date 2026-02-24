import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    username: string
    role: 'EMPLOYEE' | 'CANTEEN'
    is_staff: boolean
    is_superuser: boolean
    rememberMe?: boolean
  }

  interface Session {
    refreshToken: string
    accessToken: string
    user: User
    error?: string
    rememberMe?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string
    role?: 'EMPLOYEE' | 'CANTEEN'
    is_staff?: boolean
    is_superuser?: boolean
    access: string
    refresh: string
    error?: string
    userValidatedAt?: number
    rememberMe?: boolean
    sessionExpiresAt?: number
  }
}
