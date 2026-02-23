import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

type BrandLogoProps = {
  href?: string
  clickable?: boolean
  compact?: boolean
  className?: string
  subtitle?: string
  projectName?: string
  logoUrl?: string | null
}

export function BrandLogo({
  href = '/menu-today',
  clickable = true,
  compact = false,
  className,
  subtitle,
  projectName = 'SingleLunch',
  logoUrl
}: BrandLogoProps) {
  const content = (
    <>
      <Image
        src={logoUrl || '/brand/singlelunch-logo.svg'}
        alt={projectName}
        width={compact ? 36 : 64}
        height={compact ? 36 : 64}
        priority
        className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain p-1 shadow-sm sm:h-10 sm:w-10"
      />
      <div>
        <p className="text-sm font-bold leading-none text-slate-900 sm:text-base">
          {projectName}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-500 sm:text-xs">
            {subtitle}
          </p>
        )}
      </div>
    </>
  )

  if (!clickable) {
    return (
      <div
        className={twMerge(
          'inline-flex items-center gap-2 rounded-xl',
          className
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={twMerge(
        'inline-flex items-center gap-2 rounded-xl transition hover:opacity-90',
        className
      )}
    >
      {content}
    </Link>
  )
}
