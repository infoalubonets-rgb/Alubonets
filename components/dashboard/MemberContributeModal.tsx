'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type State = 'idle' | 'loading' | 'waiting' | 'success' | 'error'

const MPESA_ERRORS: Record<number, string> = {
  1:    'Your M-Pesa balance is too low for this payment',
  1001: 'Another payment is already in progress — wait a moment and try again',
  1019: 'The payment request timed out',
  1032: 'You cancelled the payment',
  1037: "Your phone couldn't be reached — check your connection and try again",
  2001: 'You entered the wrong M-Pesa PIN',
}

function friendlyError(code: number | undefined, desc: string | undefined) {
  if (code !== undefined && MPESA_ERRORS[code]) return MPESA_ERRORS[code]
  if (desc?.toLowerCase().includes('pin'))          return 'You entered the wrong M-Pesa PIN'
  if (desc?.toLowerCase().includes('cancel'))       return 'You cancelled the payment'
  if (desc?.toLowerCase().includes('insufficient')) return 'Your M-Pesa balance is too low'
  return 'The payment could not be completed — please try again'
}

export default function MemberContributeModal() {
  const router = useRouter()
  const [open, setOpen]           = useState(false)
  const [state, setState]         = useState<State>('idle')
  const [message, setMessage]     = useState('')
  const [checkoutId, setCheckoutId] = useState('')
  const phoneRef  = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  // Poll every 2 s while waiting (up to 65 s)
  useEffect(() => {
    if (state !== 'waiting' || !checkoutId) return
    const start = Date.now()
    let stopped = false

    async function poll() {
      if (stopped) return
      if (Date.now() - start > 65_000) {
        setState('error')
        setMessage(MPESA_ERRORS[1019])
        return
      }
      try {
        const res  = await fetch(`/api/mpesa/status/${checkoutId}`)
        const data = await res.json() as { status: string; resultCode?: number; resultDesc?: string; amount?: number }
        if (data.status === 'success') {
          setState('success')
          setMessage(data.amount ? `KES ${Math.round(data.amount).toLocaleString()} received and recorded.` : 'Your payment has been received and recorded.')
          router.refresh()
        } else if (data.status === 'failed') {
          setState('error')
          setMessage(friendlyError(data.resultCode, data.resultDesc))
        }
      } catch { /* keep polling */ }
    }

    poll()
    const tid = setInterval(poll, 2_000)
    return () => { stopped = true; clearInterval(tid) }
  }, [state, checkoutId, router])

  function handleClose() {
    setOpen(false); setState('idle'); setMessage(''); setCheckoutId('')
  }
  function handleRetry() {
    setState('idle'); setMessage(''); setCheckoutId('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const raw    = phoneRef.current?.value.trim() ?? ''
    const amount = Number(amountRef.current?.value)

    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 10 || (!digits.startsWith('07') && !digits.startsWith('01'))) {
      setState('error')
      setMessage('Enter a valid Safaricom number starting with 07 or 01 — 10 digits, e.g. 0712345678')
      return
    }
    if (!amount || amount < 1) return

    const phone = `254${digits.slice(1)}`
    setState('loading')
    setMessage('')
    try {
      const res  = await fetch('/api/mpesa/stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      })
      const data = await res.json() as { CheckoutRequestID?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'STK push failed')
      if (!data.CheckoutRequestID) throw new Error('No checkout ID returned — try again')
      setCheckoutId(data.CheckoutRequestID)
      setState('waiting')
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong — please try again')
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-primary dark:bg-[#0c1e42] text-on-primary px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
        New contribution
      </button>

      {/* Main modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,31,80,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget && state !== 'error') handleClose() }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant dark:border-[#1a2d4f] bg-surface dark:bg-[#0d1729] shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-outline-variant dark:border-[#1a2d4f]">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${state === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10 dark:bg-primary/20'}`}>
                  <span className={`material-symbols-outlined icon-fill ${state === 'success' ? 'text-green-600 dark:text-green-400' : 'text-primary'}`} style={{ fontSize: 18 }}>
                    {state === 'success' ? 'check_circle' : 'account_balance_wallet'}
                  </span>
                </div>
                <h2 className="font-semibold text-[15px] text-on-surface dark:text-blue-50">
                  {state === 'success' ? 'Payment confirmed' : 'New contribution'}
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

              {/* SUCCESS */}
              {state === 'success' && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <span className="material-symbols-outlined icon-fill text-green-600 dark:text-green-400" style={{ fontSize: 30 }}>check_circle</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">Payment received!</p>
                    <p className="text-[13px] text-on-surface-variant dark:text-blue-200/60 mt-1">{message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="mt-2 w-full rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* WAITING */}
              {state === 'waiting' && (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                    <span className="material-symbols-outlined icon-fill text-primary animate-pulse" style={{ fontSize: 30 }}>smartphone</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-on-surface dark:text-blue-50">Check your phone</p>
                    <p className="text-[13px] text-on-surface-variant dark:text-blue-200/60 mt-1">Enter your M-Pesa PIN to complete the payment</p>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin flex-shrink-0" />
                    Waiting for confirmation…
                  </div>
                  <button type="button" onClick={handleClose} className="text-[12px] text-on-surface-variant hover:text-primary transition-colors underline">
                    Cancel
                  </button>
                </div>
              )}

              {/* FORM (idle / loading) */}
              {(state === 'idle' || state === 'loading') && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">Phone number</label>
                    <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>phone</span>
                      <input
                        ref={phoneRef}
                        type="tel"
                        name="phone"
                        placeholder="0712345678"
                        required
                        className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                      />
                    </div>
                    <p className="text-[11px] text-on-surface-variant dark:text-blue-200/40">Safaricom number starting with 07 or 01 — 10 digits</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">Amount (KES)</label>
                    <div className="flex items-center gap-2 rounded-xl border border-outline-variant dark:border-[#1e3461] bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>payments</span>
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

                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary py-2.5 text-[13px] font-semibold hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all"
                  >
                    {state === 'loading' ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin flex-shrink-0" />
                        Sending M-Pesa prompt…
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

      {/* Error overlay — small floating card on top, blurs everything behind */}
      {open && state === 'error' && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.25)' }}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1c0a0a] border border-red-200 dark:border-red-900/60 shadow-2xl p-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <span className="material-symbols-outlined icon-fill text-red-500" style={{ fontSize: 22 }}>error</span>
            </div>
            <p className="text-[14px] font-medium text-gray-800 dark:text-red-100 leading-snug">{message}</p>
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-gray-200 dark:border-red-900/40 py-2 text-[13px] font-semibold text-gray-600 dark:text-red-200 hover:bg-gray-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="flex-1 rounded-xl bg-red-500 text-white py-2 text-[13px] font-semibold hover:bg-red-600 active:scale-95 transition-all"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
