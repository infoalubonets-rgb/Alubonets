/**
 * Safaricom Daraja helpers.
 *
 * Env:
 * - MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY
 * - MPESA_SHORTCODE: PayBill number, or the Buy Goods *store* (head office) number
 * - MPESA_ENV: `production` for live, anything else uses the sandbox
 * - MPESA_TRANSACTION_TYPE: `CustomerPayBillOnline` (default) or `CustomerBuyGoodsOnline`
 * - MPESA_TILL_NUMBER: required for Buy Goods; receives the money (PartyB)
 * - MPESA_CALLBACK_URL (optional): defaults to NEXT_PUBLIC_APP_URL/api/mpesa/callback
 * - MPESA_CALLBACK_TOKEN (recommended): random secret appended to the callback URL
 */

import { timingSafeEqual } from 'crypto'

export type MpesaTransactionType = 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline'

function required(name: string) {
  const v = process.env[name]
  if (!v || v.startsWith('your-')) {
    throw new Error(`${name} is not configured`)
  }
  return v
}

function baseUrl() {
  return process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}

export function mpesaTransactionType(): MpesaTransactionType {
  return process.env.MPESA_TRANSACTION_TYPE === 'CustomerBuyGoodsOnline' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline'
}

export function mpesaConfigured() {
  const base = Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      !process.env.MPESA_CONSUMER_KEY.startsWith('your-') &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY
  )
  if (!base) return false
  return mpesaTransactionType() === 'CustomerBuyGoodsOnline' ? Boolean(process.env.MPESA_TILL_NUMBER) : true
}

export function mpesaCallbackUrl() {
  const base = process.env.MPESA_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/mpesa/callback`
  // A secret only Safaricom learns (it is sent inside each STK request), so forged callbacks
  // without it are rejected. Optional: the STK Query check below is the real safeguard.
  const token = process.env.MPESA_CALLBACK_TOKEN?.trim()
  if (!token) return base
  const url = new URL(base)
  url.searchParams.set('token', token)
  return url.toString()
}

/** True when the callback carries the configured secret token (or no token is configured). */
export function mpesaCallbackTokenValid(received: string | null) {
  const expected = process.env.MPESA_CALLBACK_TOKEN?.trim()
  if (!expected) return true
  if (!received || received.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}

/**
 * Asks Safaricom directly whether an STK request was paid. Callbacks are unauthenticated HTTP
 * posts, so a payment is only credited after this confirms ResultCode 0 for that request.
 */
export async function stkQuery(checkoutRequestId: string): Promise<{ paid: boolean; resultCode: string; resultDesc: string }> {
  const token = await getMpesaAccessToken()
  const shortcode = required('MPESA_SHORTCODE')
  const passkey = required('MPESA_PASSKEY')
  const ts = timestamp()
  const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64'),
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  })
  const data = await res.json().catch(() => ({}))
  const resultCode = String(data.ResultCode ?? data.errorCode ?? '')
  return { paid: res.ok && resultCode === '0', resultCode, resultDesc: String(data.ResultDesc ?? data.errorMessage ?? '') }
}

export function formatMpesaPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length >= 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  return digits
}

export async function getMpesaAccessToken() {
  const key = required('MPESA_CONSUMER_KEY')
  const secret = required('MPESA_CONSUMER_SECRET')
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`M-Pesa OAuth failed: ${res.status}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/** Daraja expects the timestamp in Kenyan local time (YYYYMMDDHHmmss). */
function timestamp() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`
}

export type StkPushResult = {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription?: string
  CustomerMessage: string
}

export async function stkPush(input: {
  phone: string
  amount: number
  accountReference: string
  description: string
  callbackUrl?: string
}): Promise<StkPushResult> {
  const token = await getMpesaAccessToken()
  const shortcode = required('MPESA_SHORTCODE')
  const passkey = required('MPESA_PASSKEY')
  const transactionType = mpesaTransactionType()
  const partyB = transactionType === 'CustomerBuyGoodsOnline' ? required('MPESA_TILL_NUMBER') : shortcode
  const ts = timestamp()
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64')
  const phone = formatMpesaPhone(input.phone)

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: transactionType,
      Amount: Math.round(input.amount),
      PartyA: phone,
      PartyB: partyB,
      PhoneNumber: phone,
      CallBackURL: input.callbackUrl || mpesaCallbackUrl(),
      AccountReference: input.accountReference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.errorMessage || data.error_description || 'STK push failed')
  }
  return data as StkPushResult
}
