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

// Returns { formatted: '2547XXXXXXXX' } on success or { error: '...' } on failure
function parsePhone(raw: string): { formatted: string } | { error: string } {
  const d = raw.replace(/\D/g, '')
  if (!d) return { error: 'Phone number is required' }

  // 254 prefix (12 digits: 254 + 9)
  if (d.startsWith('254')) {
    if (d.length !== 12) return { error: 'International format must be 12 digits — e.g. 254712345678' }
    const after = d.slice(3)
    if (!after.startsWith('7') && !after.startsWith('1'))
      return { error: 'Number must start with 07 or 01 after the country code' }
    return { formatted: d }
  }

  // Local 07 / 01 (10 digits)
  if (d.startsWith('07') || d.startsWith('01')) {
    if (d.length !== 10) return { error: '10 digits required — e.g. 0712345678' }
    return { formatted: `254${d.slice(1)}` }
  }

  return { error: 'Start with 07, 01, or 254' }
}

function parseAmount(raw: string): { value: number } | { error: string } {
  const n = Number(raw)
  if (!raw || isNaN(n) || n < 1) return { error: 'Enter an amount of at least KES 1' }
  if (n > 150_000) return { error: 'Maximum single contribution is KES 150,000' }
  return { value: n }
}

export default function MemberContributeModal() {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [state, setState]             = useState<State>('idle')
  const [message, setMessage]         = useState('')
  const [checkoutId, setCheckoutId]   = useState('')
  const [phoneError, setPhoneError]   = useState('')
  const [amountError, setAmountError] = useState('')
  const phoneRef  = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  // Ref-based stop flag — always current, safe to read inside any async callback
  const pollStoppedRef = useRef(true)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  // Poll every 2 s while waiting (up to 65 s).
  // Keyed only on checkoutId: starts when an ID arrives, stops when it's cleared.
  useEffect(() => {
    if (!checkoutId) return
    pollStoppedRef.current = false
    const start = Date.now()

    async function poll() {
      if (pollStoppedRef.current) return
      if (Date.now() - start > 65_000) {
        if (!pollStoppedRef.current) {
          pollStoppedRef.current = true
          setState('error')
          setMessage(MPESA_ERRORS[1019])
        }
        return
      }
      try {
        const res  = await fetch(`/api/mpesa/status/${checkoutId}`)
        if (pollStoppedRef.current) return          // discard response if already cancelled
        const data = await res.json() as { status: string; resultCode?: number; resultDesc?: string; amount?: number }
        if (pollStoppedRef.current) return          // double-check after JSON parse
        if (data.status === 'success') {
          pollStoppedRef.current = true
          setState('success')
          setMessage(data.amount ? `KES ${Math.round(data.amount).toLocaleString()} received and recorded.` : 'Your payment has been received and recorded.')
          router.refresh()
          return
        } else if (data.status === 'failed') {
          pollStoppedRef.current = true
          setState('error')
          setMessage(friendlyError(data.resultCode, data.resultDesc))
          return
        }
      } catch { /* keep polling on network error */ }
      // Schedule next poll only if still active
      if (!pollStoppedRef.current) setTimeout(poll, 2_000)
    }

    poll()
    return () => { pollStoppedRef.current = true }
  }, [checkoutId, router])

  function stopPolling() { pollStoppedRef.current = true }

  function handleClose() {
    stopPolling()
    setOpen(false); setState('idle'); setMessage(''); setCheckoutId('')
    setPhoneError(''); setAmountError('')
  }
  function handleRetry() {
    stopPolling()
    setState('idle'); setMessage(''); setCheckoutId('')
  }

  // ── Input handlers ────────────────────────────────────────────────────────
  function onPhoneInput(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget
    // Strip non-digits, cap at 13 chars
    el.value = el.value.replace(/\D/g, '').slice(0, 13)
    setPhoneError('')
  }

  function onPhoneBlur(e: React.FocusEvent<HTMLInputElement>) {
    const result = parsePhone(e.currentTarget.value)
    if ('error' in result) setPhoneError(result.error)
  }

  function onAmountInput(e: React.FormEvent<HTMLInputElement>) {
    const el = e.currentTarget
    // Digits only, max 6 chars (150000 = 6 digits)
    el.value = el.value.replace(/\D/g, '').slice(0, 6)
    const n = Number(el.value)
    if (el.value && n > 150_000) {
      el.value = '150000'
      setAmountError('Maximum single contribution is KES 150,000')
    } else {
      setAmountError('')
    }
  }

  function onAmountBlur(e: React.FocusEvent<HTMLInputElement>) {
    const result = parseAmount(e.currentTarget.value)
    if ('error' in result) setAmountError(result.error)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const rawPhone  = phoneRef.current?.value.trim()  ?? ''
    const rawAmount = amountRef.current?.value.trim()  ?? ''

    const phoneResult  = parsePhone(rawPhone)
    const amountResult = parseAmount(rawAmount)

    let hasError = false
    if ('error' in phoneResult)  { setPhoneError(phoneResult.error);   hasError = true }
    if ('error' in amountResult) { setAmountError(amountResult.error); hasError = true }
    if (hasError) return

    const phone  = (phoneResult  as { formatted: string }).formatted
    const amount = (amountResult as { value: number }).value

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

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">
                      Phone number
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:ring-1 transition-all ${
                      phoneError
                        ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-300'
                        : 'border-outline-variant dark:border-[#1e3461] focus-within:border-primary focus-within:ring-primary'
                    }`}>
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>phone</span>
                      <input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        placeholder="0712345678"
                        onInput={onPhoneInput}
                        onBlur={onPhoneBlur}
                        required
                        className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                      />
                    </div>
                    {phoneError && (
                      <p className="text-[11px] text-red-500 flex items-center gap-1">
                        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 12 }}>error</span>
                        {phoneError}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="block text-[12px] font-semibold text-on-surface dark:text-blue-200 uppercase tracking-wide">
                      Amount (KES)
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border bg-surface-container dark:bg-[#111f36] px-3 py-2.5 focus-within:ring-1 transition-all ${
                      amountError
                        ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-300'
                        : 'border-outline-variant dark:border-[#1e3461] focus-within:border-primary focus-within:ring-primary'
                    }`}>
                      <span className="material-symbols-outlined text-outline dark:text-blue-200/40" style={{ fontSize: 16 }}>payments</span>
                      <input
                        ref={amountRef}
                        type="text"
                        inputMode="numeric"
                        placeholder="e.g. 500"
                        onInput={onAmountInput}
                        onBlur={onAmountBlur}
                        required
                        className="flex-1 bg-transparent outline-none text-[13px] text-on-surface dark:text-blue-50 placeholder:text-outline dark:placeholder:text-blue-200/30"
                      />
                      <span className="text-[12px] font-semibold text-on-surface-variant dark:text-blue-200/50">KES</span>
                    </div>
                    {amountError ? (
                      <p className="text-[11px] text-red-500 flex items-center gap-1">
                        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 12 }}>error</span>
                        {amountError}
                      </p>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant dark:text-blue-200/40">
                        Max KES 150,000 per transaction
                      </p>
                    )}
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

      {/* Error overlay — blurred card on top */}
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
