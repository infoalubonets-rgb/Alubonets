import { createHash, randomBytes } from 'crypto'

const CODE_COUNT = 10

export function hashMfaRecoveryCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

export function generateMfaRecoveryCodes() {
  const codes = Array.from({ length: CODE_COUNT }, () => {
    const raw = randomBytes(4).toString('hex').toUpperCase()
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
  return {
    codes,
    stored: JSON.stringify(codes.map(hashMfaRecoveryCode)),
  }
}

export function parseStoredRecoveryHashes(value: string | null | undefined) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return []
  }
}

export function consumeMfaRecoveryCode(stored: string | null | undefined, token: string) {
  const hashes = parseStoredRecoveryHashes(stored)
  const incoming = hashMfaRecoveryCode(token)
  const index = hashes.indexOf(incoming)
  if (index < 0) return null
  const remaining = hashes.filter((_, i) => i !== index)
  return JSON.stringify(remaining)
}
