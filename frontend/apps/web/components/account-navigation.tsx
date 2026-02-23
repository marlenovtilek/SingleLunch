'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const adminLinks = [
  { href: '/canteen-menu-today', label: 'Создать меню' },
  { href: '/menu-today', label: 'Меню на сегодня' },
  { href: '/canteen-orders', label: 'Все заказы' },
  { href: '/canteen-qr', label: 'QR Код' },
  { href: '/duty', label: 'Дежурство' }
]

const canteenLinks = [
  { href: '/canteen-menu-today', label: 'Создать меню' },
  { href: '/menu-today', label: 'Меню на сегодня' },
  { href: '/canteen-orders', label: 'Все заказы' },
  { href: '/canteen-qr', label: 'QR Код' }
]

const employeeLinks = [
  { href: '/menu-today', label: 'Меню на сегодня' },
  { href: '/orders-history', label: 'Мои заказы' },
  { href: '/duty', label: 'Дежурство' }
]

export function AccountNavigation({
  isAdmin,
  userRole
}: {
  isAdmin: boolean
  userRole?: string
}) {
  const pathname = usePathname()
  const visibleLinks = isAdmin
    ? adminLinks
    : userRole === 'CANTEEN'
      ? canteenLinks
      : employeeLinks

  return (
    <div className="grid grid-cols-2 gap-1 lg:block lg:space-y-1">
      {visibleLinks.map((link) => {
        const isActive = pathname === link.href

        return (
          <Link
            key={link.href}
            href={link.href}
            className={twMerge(
              'rounded-md px-2 py-1 text-center text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:block lg:px-2 lg:text-left lg:text-xs',
              isActive && 'bg-emerald-100 text-emerald-900'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
