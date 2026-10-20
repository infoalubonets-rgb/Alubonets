import { createClient } from '@supabase/supabase-js'
import { getPublicSupabaseConfig } from '@/lib/env'
import { appBaseUrl } from '@/lib/app-url'
import { logError, logInfo } from '@/lib/logger'
import { sendPasswordResetEmail } from '@/lib/email/resend'

export async function sendSupabaseRecoveryEmail(email: string, requestUrl?: string) {
  const { url, key } = getPublicSupabaseConfig()
  const redirectTo = `${appBaseUrl(requestUrl)}/auth/callback?next=/reset-password`
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw new Error(error.message)
}

/** Prefer the branded Resend message; if that provider rejects, let Supabase deliver recovery. */
export async function deliverPasswordResetLink(input: {
  userId: string
  fullName: string
  email: string
  resetUrl: string
  requestUrl?: string
}): Promise<{ channel: 'resend' | 'supabase' }> {
  try {
    await sendPasswordResetEmail(input)
    return { channel: 'resend' }
  } catch (resendError) {
    try {
      await sendSupabaseRecoveryEmail(input.email, input.requestUrl)
      logInfo('auth.password_reset.supabase_fallback', { userId: input.userId })
      return { channel: 'supabase' }
    } catch (supabaseError) {
      logError('auth.password_reset.supabase_fallback_failed', supabaseError, { userId: input.userId })
      throw resendError
    }
  }
}
