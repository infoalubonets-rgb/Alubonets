'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onUploadProgress, type UploadProgressEvent } from '@/lib/upload-progress-events'

/**
 * Floating upload-progress toast, mounted once near the app root so it keeps showing
 * progress even after the form/modal that started the upload has closed.
 */
export default function UploadProgressToast() {
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<Record<string, UploadProgressEvent>>({})

  useEffect(() => setMounted(true), [])

  function dismiss(id: string) {
    setItems((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  useEffect(() => {
    return onUploadProgress((event) => {
      setItems((current) => ({ ...current, [event.id]: event }))
      if (event.status === 'done') {
        window.setTimeout(() => dismiss(event.id), 2500)
      } else if (event.status === 'error') {
        window.setTimeout(() => dismiss(event.id), 8000)
      }
    })
  }, [])

  const list = Object.values(items)
  if (!mounted || list.length === 0) return null

  return createPortal(
    <div className="fixed bottom-5 left-5 z-[300] flex w-[300px] flex-col gap-2">
      {list.map((item) => (
        <div key={item.id} className="rounded-2xl border border-outline-variant/60 bg-surface p-3.5 shadow-2xl dark:bg-[#0d1729]">
          <div className="flex items-center gap-2">
            <span
              className={`material-symbols-outlined text-[18px] ${
                item.status === 'error' ? 'text-error' : item.status === 'done' ? 'text-green-600' : 'text-primary'
              }`}
            >
              {item.status === 'error' ? 'error' : item.status === 'done' ? 'check_circle' : 'upload'}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">{item.label}</p>
            {item.status !== 'uploading' && (
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss"
                className="shrink-0 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            )}
          </div>
          {item.status === 'uploading' && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.percent}%` }} />
            </div>
          )}
          {item.message && (
            <p className={`mt-1.5 text-[11px] ${item.status === 'error' ? 'text-error' : 'text-on-surface-variant'}`}>
              {item.message}
            </p>
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}
