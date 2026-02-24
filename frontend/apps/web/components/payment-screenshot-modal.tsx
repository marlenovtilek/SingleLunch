'use client'

import { type ReactNode, useState } from 'react'

export function PaymentScreenshotModal({
  url,
  alt,
  children,
  className
}: {
  url: string
  alt: string
  children: ReactNode
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        {children}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 rounded-md border border-white/30 bg-black/30 px-3 py-1 text-xs font-medium text-white hover:bg-black/50"
          >
            Закрыть
          </button>
          <img
            src={url}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-lg bg-white object-contain p-2"
          />
        </div>
      )}
    </>
  )
}
