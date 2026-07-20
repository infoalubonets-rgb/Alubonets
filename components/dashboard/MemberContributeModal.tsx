'use client'

import { useEffect, useRef, useState } from 'react'

type State = 'idle' | 'loading' | 'success' | 'error'

export default function MemberContributeModal() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')
  const phoneRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  function handleClose() {
    setOpen(false)
    setState('idle')
    setMessage('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const phone = phoneRef.current?.value.trim() ?? ''
    const amount = Number(amountRef.current?.value)
    if (!phone || !amount) return

    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/mpesa/stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'STK push failed')
      setState('success')
      setMessage(data.CustomerMessage ?? 'Check your phone for the M-Pesa prompt.')
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary dark:bg-[#0c1e42] text-on-primary px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        New contribution
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,31,80,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          {/* Panel */}
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant dark:border-[#1a2d4f]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 18 }}>
                    account_balance_wallet
                  </span>
                </div>
                <h2 className="font-semibold text-[15px] text-on-surface dark:text-blue-50">
                  New contribution
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex items-center justify-center h-7 w-7 rounded-full text-on-surface-variant hover:bg-surface-container dark:hover:bg-[#111f36] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {state === 'success' ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <span className="material-symbols-outlined icon-fill text-green-600 dark:text-green-400" style={{ fontSize: 24 }}>
                      check_circle
                    </span>
                  </div>
                  <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">STK push sent!</p>
                  <p className="text-[13px] text-on-surface-variant dark:text-blue-200/60">{message}</p>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-2 rounded-xl bg-primary text-on-primary px-6 py-2 text-[13px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">
                      Phone number
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>
                        phone
                      </span>
                      <input
                        ref={phoneRef}
                        type="tel"
                        name="phone"
                        placeholder="2547XXXXXXXX"
                        required
                        className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                      />
                    </div>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/40">
                      Format: 2547XXXXXXXX (no + or spaces)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">
                      Amount (KES)
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>
                        payments
                      </span>
                      <input
                        ref={amountRef}
                        type="number"
                        name="amount"
                        placeholder="e.g. 500"
                        min={1}
                        required
                        className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                      />
                      <span className="text-[12px] font-semibold text-on-surface-variant dark:text-blue-200/50">KES</span>
                    </div>
                  </div>

                  {state === 'error' && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
                      <span className="material-symbols-outlined icon-fill text-red-500 shrink-0" style={{ fontSize: 16 }}>
                        error
                      </span>
                      <p className="text-[12px] text-red-700 dark:text-red-300">{message}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all"
                  >
                    {state === 'loading' ? (
                      <>
                        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                          progress_activity
                        </span>
                        Sending STK push…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                        Send M-Pesa prompt
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
