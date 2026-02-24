'use client'

import { AccountNavigation } from '@/components/account-navigation'
import { BrandLogo } from '@/components/brand-logo'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export function AccountShell({
  children,
  isAdmin,
  userRole,
  projectName,
  logoUrl,
  username
}: {
  children: React.ReactNode
  isAdmin: boolean
  userRole?: string
  projectName: string
  logoUrl: string | null
  username: string
}) {
  const pathname = usePathname()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)

  const isProfileActive = pathname === '/profile'
  const isSecurityActive = pathname === '/change-password'
  const isHelpActive = pathname === '/help'

  useEffect(() => {
    if (pathname) {
      setIsAccountMenuOpen(false)
    }
  }, [pathname])

  const renderProfileMenu = (className: string) => (
    <div
      className={twMerge(
        'z-20 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg',
        className
      )}
    >
      <div className="rounded px-2 py-1.5 text-xs font-semibold text-slate-900">
        @{username}
      </div>
      <Link
        href="/profile"
        onClick={() => setIsAccountMenuOpen(false)}
        className={twMerge(
          'block rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100',
          isProfileActive && 'bg-emerald-100 text-emerald-900'
        )}
      >
        Личный кабинет
      </Link>
      <Link
        href="/change-password"
        onClick={() => setIsAccountMenuOpen(false)}
        className={twMerge(
          'block rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100',
          isSecurityActive && 'bg-emerald-100 text-emerald-900'
        )}
      >
        Безопасность
      </Link>
      <div className="mt-1 border-t border-slate-100 pt-1">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="block w-full rounded px-2 py-1.5 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          Выйти
        </button>
      </div>
    </div>
  )

  return (
    <div className="h-[calc(100dvh-3rem)] w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 via-white to-emerald-50/50 p-1.5 sm:h-[calc(100dvh-4rem)] sm:p-2.5">
      {isAccountMenuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/10 lg:hidden"
          role="button"
          tabIndex={0}
          onClick={() => setIsAccountMenuOpen(false)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' ||
              event.key === 'Escape' ||
              event.key === ' '
            ) {
              setIsAccountMenuOpen(false)
            }
          }}
        />
      )}
      {isAccountMenuOpen &&
        renderProfileMenu('fixed right-4 top-24 z-30 lg:hidden')}
      <div className="grid h-full min-h-0 grid-rows-[auto,1fr] gap-2 lg:grid-cols-[210px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-2.5">
        <aside className="rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur lg:flex lg:h-full lg:flex-col lg:p-2">
          <div className="mb-2 border-b border-slate-100 pb-1.5">
            <div className="flex items-center justify-between gap-2">
              <BrandLogo
                compact
                clickable={false}
                projectName={projectName}
                logoUrl={logoUrl}
              />

              <div className="relative flex items-center gap-1.5 lg:hidden">
                <Link
                  href="/help"
                  className={twMerge(
                    'flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    isHelpActive &&
                      'border-emerald-300 bg-emerald-100 text-emerald-900'
                  )}
                  aria-label="Инструкция"
                  title="Инструкция"
                >
                  <span className="text-base font-semibold">?</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Профиль и безопасность"
                  title="Профиль и безопасность"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M4.5 16a5.5 5.5 0 0 1 11 0"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <AccountNavigation isAdmin={isAdmin} userRole={userRole} />

          <div className="relative ml-auto mt-2 hidden lg:ml-0 lg:mt-auto lg:block lg:w-full">
            <div className="flex items-center gap-1.5">
              <Link
                href="/help"
                className={twMerge(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                  isHelpActive &&
                    'border-emerald-300 bg-emerald-100 text-emerald-900'
                )}
                aria-label="Инструкция"
                title="Инструкция"
              >
                <span className="text-base font-semibold">?</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex h-9 w-full items-center justify-start gap-2 rounded-md border border-slate-300 bg-white px-2 text-slate-700 hover:bg-slate-50"
                aria-label="Профиль и безопасность"
                title="Профиль и безопасность"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M4.5 16a5.5 5.5 0 0 1 11 0"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="max-w-[120px] truncate text-xs font-semibold text-slate-700">
                  @{username}
                </span>
              </button>
            </div>

            {isAccountMenuOpen &&
              renderProfileMenu('absolute bottom-12 left-0 right-0 w-full')}
          </div>
        </aside>

        <main className="min-w-0 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3.5">
          {children}
        </main>
      </div>
    </div>
  )
}
