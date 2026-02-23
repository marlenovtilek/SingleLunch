'use client'

import { useState } from 'react'

export function QrPreview({
  url,
  alt,
  downloadName,
  allowDownload = true,
  openLabel = 'Открыть QR'
}: {
  url: string
  alt: string
  downloadName?: string
  allowDownload?: boolean
  openLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
        >
          {openLabel}
        </button>
        {allowDownload && (
          <a
            href={url}
            download={downloadName}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Скачать QR
          </a>
        )}
      </div>

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
