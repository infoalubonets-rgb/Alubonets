export type ContactSubmitResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'rate' | 'server'; message?: string }
