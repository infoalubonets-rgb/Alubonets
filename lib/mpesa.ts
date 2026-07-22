const BASE =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

async function getToken(): Promise<string> {
  const key    = process.env.MPESA_CONSUMER_KEY    ?? ''
  const secret = process.env.MPESA_CONSUMER_SECRET ?? ''
  if (!key || !secret) throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.')

  const creds = Buffer.from(`${key}:${secret}`).toString('base64')
  const res   = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`)
  const json = await res.json() as { access_token: string }
  return json.access_token
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length >= 12) return digits
  if (digits.startsWith('0')   && digits.length === 10) return '254' + digits.slice(1)
  if (digits.length === 9) return '254' + digits
  return digits
}

function ts(): string {
  return new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
}

export interface StkPushResult {
  MerchantRequestID: string
  CheckoutRequestID: string
  ResponseCode: string
  ResponseDescription: string
  CustomerMessage: string
}

export async function initiateStkPush(opts: {
  phone: string
  amount: number
  accountRef: string
  description: string
  callbackUrl: string
}): Promise<StkPushResult> {
  const token     = await getToken()
  const shortcode = process.env.MPESA_SHORTCODE ?? ''
  const passkey   = process.env.MPESA_PASSKEY   ?? ''
  if (!shortcode || !passkey) throw new Error('M-Pesa shortcode/passkey not configured.')

  const now      = ts()
  const password = Buffer.from(shortcode + passkey + now).toString('base64')
  const phone    = formatPhone(opts.phone)

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         now,
      TransactionType:   'CustomerPayBillOnline',
      Amount:            Math.round(opts.amount),
      PartyA:            phone,
      PartyB:            shortcode,
      PhoneNumber:       phone,
      CallBackURL:       opts.callbackUrl,
      AccountReference:  opts.accountRef.slice(0, 12),
      TransactionDesc:   opts.description.slice(0, 13),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`STK Push failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<StkPushResult>
}
