import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateMfaSecret(bytes = 20) {
  const buf = randomBytes(bytes)
  let bits = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32[parseInt(bits.slice(i, i + 5), 2)]
  }
  return out
}

function base32ToBuffer(secret: string) {
  const cleaned = secret.replace(/=+$/, '').toUpperCase()
  let bits = ''
  for (const char of cleaned) {
    const val = BASE32.indexOf(char)
    if (val < 0) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number) {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secret: string, token: string, window = 1) {
  const key = base32ToBuffer(secret)
  const timestep = Math.floor(Date.now() / 1000 / 30)
  const normalized = token.replace(/\s+/g, '')
  for (let w = -window; w <= window; w++) {
    if (hotp(key, timestep + w) === normalized) return true
  }
  return false
}

export function otpauthUrl(secret: string, email: string, issuer = 'Alubonets') {
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`
}

export const PRIVILEGED_MFA_ROLES = ['ADMIN', 'TREASURER', 'SECRETARY', 'EXECUTIVE'] as const
