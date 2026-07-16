'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { ADMIN_LOGIN_LOGO } from '@/lib/constants'
import { homeForRole, loginRequest, meRequest, registerRequest, type AuthUser } from '@/lib/auth/client'

type Props = {
  title?: string
  allowRegister?: boolean
}

export default function LoginForm({ title = 'Member Login', allowRegister = true }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    meRequest().then((user: AuthUser | null) => {
      if (user) {
        const next = searchParams.get('next')
        router.replace(next && next.startsWith('/') ? next : homeForRole(user.role))
      }
    })
  }, [router, searchParams])

  useEffect(() => {
    if (searchParams.get('error') === 'inactive') {
      setError('Your account is not active. Contact an administrator.')
    }
  }, [searchParams])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
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
      const { user, redirectTo, status } = await loginRequest(email, password)
      if (status === 'PENDING') {
        router.push('/pending')
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
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
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
            <p className="font-caption text-caption text-on-surface-variant mt-xs">
              Secure sign-in with Supabase Auth
            </p>
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
              />
            </div>
            <div>
              <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  className="w-full px-md py-[10px] pr-[44px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors p-xs"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
            {mode === 'register' && (
              <div>
                <label className="block font-label-bold text-label-bold text-on-surface-variant mb-xs text-[13px]">
                  Confirm password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-md py-[10px] bg-surface border border-secondary-container rounded-lg text-on-surface font-body-md text-[14px]"
                />
              </div>
            )}
            {error && (
              <p className="text-error text-center font-caption text-caption text-[12px]">{error}</p>
            )}
            <div className="flex justify-center mt-xs">
              <button
                type="submit"
                disabled={loading}
                className="bg-secondary-container text-on-secondary font-label-bold text-label-bold py-[11px] px-xl rounded-full hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-sm min-h-[44px] shadow-md disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[17px]">lock_open</span>
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

          {allowRegister && (
            <p className="text-center mt-md text-[13px] text-on-surface-variant">
              {mode === 'signin' ? (
                <>
                  New member?{' '}
                  <button
                    type="button"
                    className="text-primary font-semibold"
                    onClick={() => {
                      setMode('register')
                      setConfirmPassword('')
                      setError('')
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
  )
}
