/**
 * Safaricom Daraja helpers (sandbox-friendly).
 * Uses env: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE,
 * MPESA_PASSKEY, MPESA_CALLBACK_URL
 */

function required(name: string) {
  const v = process.env[name]
  if (!v || v.startsWith('your-')) {
    throw new Error(`${name} is not configured`)
  }
  return v
}

export function mpesaConfigured() {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      !process.env.MPESA_CONSUMER_KEY.startsWith('your-') &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY
  )
}

export async function getMpesaAccessToken() {
  const key = required('MPESA_CONSUMER_KEY')
  const secret = required('MPESA_CONSUMER_SECRET')
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  )
  if (!res.ok) {
    throw new Error(`M-Pesa OAuth failed: ${res.status}`)
  }
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

function timestamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

export async function stkPush(input: {
  phone: string
  amount: number
  accountReference: string
  description: string
}) {
  const token = await getMpesaAccessToken()
  const shortcode = required('MPESA_SHORTCODE')
  const passkey = required('MPESA_PASSKEY')
  const callback =
    process.env.MPESA_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`
  const ts = timestamp()
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64')

  let phone = input.phone.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`
  if (phone.startsWith('+')) phone = phone.slice(1)

  const res = await fetch(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(input.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callback,
        AccountReference: input.accountReference.slice(0, 12),
        TransactionDesc: input.description.slice(0, 13),
      }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.errorMessage || data.error_description || 'STK push failed')
  }
  return data as {
    MerchantRequestID: string
    CheckoutRequestID: string
    ResponseCode: string
    CustomerMessage: string
  }
}
