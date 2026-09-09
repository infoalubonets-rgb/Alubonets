'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { ADMIN_LOGIN_LOGO } from '@/lib/constants'
import DevAccountsDropdown from '@/components/auth/DevAccountsDropdown'
import { homeForRole, loginRequest, logoutRequest, meLookup, registerRequest, type AuthUser } from '@/lib/auth/client'
import ErrorDialog from '@/components/ui/ErrorDialog'
import { friendlyError } from '@/lib/safe-error'
import { PasswordVisibilityIcon, UnlockIcon } from '@/components/auth/AuthIcons'

type Props = {
  title?: string
  allowRegister?: boolean
  admin?: boolean
}

export default function LoginForm({ title = 'Member Login', allowRegister = true, admin = false }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaToken, setMfaToken] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const friendly = error ? friendlyError(error, 'We could not sign you in. Please try again.') : null
  const [loading, setLoading] = useState(false)
  const [devOpen, setDevOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    meLookup()
      .then((result) => {
        if (cancelled || result.status !== 'authenticated') return
        const next = searchParams.get('next')
        router.replace(next && next.startsWith('/') ? next : homeForRole(result.user.role))
      })
      .catch(() => {
        // Ignore — login page should stay usable
      })
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'suspended') {
      setError(
        'Your account has been temporarily suspended. Please contact the group administrator.'
      )
    } else if (err === 'inactive') {
      setError('Your account is not active. Contact an administrator.')
    } else if (err === 'session_timeout') {
      setError('Your session expired after inactivity. Please sign in again.')
    } else if (err === 'oauth') {
      setError('Google sign-in failed. Please try again or use email and password.')
    }
  }, [searchParams])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'signin' && !admin) {
      try {
        const draft = JSON.parse(localStorage.getItem('alubonets-registration-draft-v1') || 'null')
        if (draft?.form?.email?.toLowerCase() === email.trim().toLowerCase() && draft.step > 0) {
          setError('Your registration is not finished. Continue your saved application before signing in.')
          window.setTimeout(() => router.push('/register'), 900)
          return
        }
      } catch {
        localStorage.removeItem('alubonets-registration-draft-v1')
      }
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      if (mode === 'register') {
        const { redirectTo } = await registerRequest({ email, password, fullName, phone })
        router.push(redirectTo || '/pending')
        router.refresh()
        return
      }
      const { user, redirectTo, status, requiresVerification } = await loginRequest(
        email,
        password,
        needsMfa ? mfaToken : undefined,
      )
      if (status === 'PENDING') {
        if (admin) {
          await logoutRequest()
          setError('Your account is still waiting for approval by an administrator.')
          return
        }
        router.push('/pending')
        return
      }
      if (requiresVerification || redirectTo === '/verify-login') {
        router.push('/verify-login')
        return
      }
      const next = searchParams.get('next')
      if (next && next.startsWith('/')) {
        router.push(next)
      } else {
        router.push(redirectTo || homeForRole(user.role))
      }
      router.refresh()
    } catch (err) {
      const mfaRequired = Boolean((err as Error & { requiresMfa?: boolean })?.requiresMfa)
      if (mfaRequired) {
        setNeedsMfa(true)
        setError('Enter the authenticator code for this account.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-primary flex items-center justify-center min-h-screen px-md overflow-y-auto py-xl">
        <div className="w-full max-w-[420px]">
          <div className="flex justify-center">
            <div className="mb-[-30px] relative z-10 bg-surface rounded-2xl px-md py-sm shadow-xl border border-outline-variant/30">
              <img src={ADMIN_LOGIN_LOGO} alt="Alubonets SHG" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <div className="bg-surface rounded-2xl pt-[52px] pb-lg px-lg shadow-2xl border border-white/10">
            <div className="text-center mb-lg">
              <h1 className="font-h3 text-h3 text-secondary-container">{title}</h1>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-md">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                      Full name
                    </label>
                    <input
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                    />
                  </div>
                  <div>
                    <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      name="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setDevOpen(true)}
                    onBlur={() => {
                      // Delay so dropdown mousedown can autofill before close
                      window.setTimeout(() => setDevOpen(false), 180)
                    }}
                    required
                    className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                  />
                  {mode === 'signin' &&
                    process.env.NODE_ENV !== 'production' &&
                    process.env.NEXT_PUBLIC_ENABLE_TEST_ACCOUNTS !== 'false' && (
                    <DevAccountsDropdown
                      open={devOpen}
                      onPick={(devEmail, devPassword) => {
                        setEmail(devEmail)
                        setPassword(devPassword)
                        setDevOpen(false)
                      }}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    className="w-full px-md py-[10px] pr-[44px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                    className="absolute right-sm top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-xs"
                  >
                    <PasswordVisibilityIcon hidden={showPw} />
                  </button>
                </div>
              </div>
              {mode === 'signin' && needsMfa && (
                <div>
                  <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                    Authenticator code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                    required
                    minLength={6}
                    maxLength={8}
                    placeholder="6-digit code"
                    className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                  />
                </div>
              )}
              {mode === 'register' && (
                <div>
                  <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                    Confirm password
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                  />
                </div>
              )}
              {friendly && (
                <p className="text-error text-center font-caption text-caption text-[12px]">
                  {friendly.message}
                </p>
              )}
              <div className="flex justify-center mt-xs">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-secondary-container text-on-secondary font-label-bold text-label-bold py-[11px] px-xl rounded-full hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-sm min-h-[44px] shadow-md disabled:opacity-60"
                >
                  <UnlockIcon />
                  {loading
                    ? mode === 'register'
                      ? 'Creating…'
                      : 'Signing in…'
                    : mode === 'register'
                      ? 'Register'
                      : 'Sign In'}
                </button>
              </div>
            </form>
            {mode === 'signin' && (
              <p className="mt-3 text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="text-primary hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    router.push('/forgot-password')
                  }}
                >
                  Forgot password?
                </Link>
              </p>
            )}

            {allowRegister && (
              <p className="text-center mt-md text-[13px] text-on-surface-variant">
                {mode === 'signin' ? (
                  <>
                    New member?{' '}
                    <button
                      type="button"
                      className="text-primary font-semibold"
                      onClick={() => {
                        router.push('/register')
                      }}
                    >
                      Register
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      className="text-primary font-semibold"
                      onClick={() => {
                        setMode('signin')
                        setConfirmPassword('')
                        setError('')
                      }}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          <p className="text-center mt-lg">
            <Link
              href="/"
              className="font-caption text-caption text-primary-fixed-dim/50 hover:text-primary-fixed-dim transition-colors"
            >
              ← Return to public site
            </Link>
          </p>
        </div>
      </div>
      {friendly && <ErrorDialog title={friendly.title} message={friendly.message} onClose={() => setError('')} />}
    </>
  )
}
