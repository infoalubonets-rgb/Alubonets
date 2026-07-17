'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { homeForRole, loginRequest, registerRequest } from '@/lib/auth/client'
import { createClient } from '@/utils/supabase/client'
import DevAccountsDropdown from '@/components/auth/DevAccountsDropdown'

type AuthTab = 'signin' | 'signup' | 'forgot'

let _open: ((tab?: AuthTab) => void) | null = null

export function openAuthModal(tab: AuthTab = 'signin') {
  _open?.(tab)
}

function PasswordInput({
  placeholder,
  value,
  onChange,
  minLength,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="auth-password-wrap">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="auth-field auth-field-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
      />
      <button
        type="button"
        className="auth-password-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow(!show)}
      >
        <span className="material-symbols-outlined text-[20px]">
          {show ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  )
}

export default function AuthModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<AuthTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [devOpen, setDevOpen] = useState(false)

  useEffect(() => {
    _open = (t: AuthTab = 'signin') => {
      setTab(t)
      setOpen(true)
    }
    return () => {
      _open = null
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, redirectTo, status } = await loginRequest(email, password)
      setOpen(false)
      router.push(status === 'PENDING' ? '/pending' : redirectTo || homeForRole(user.role))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const onSignUp = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { redirectTo } = await registerRequest({ email, password, fullName, phone })
      setOpen(false)
      router.push(redirectTo || '/pending')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const onGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const origin = window.location.origin
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      id="authModal"
      className="fixed inset-0 z-50 flex items-center justify-center p-md auth-modal-overlay"
      onClick={() => setOpen(false)}
    >
      <div
        className={`auth-modal-panel bg-white rounded-2xl w-full relative ${tab === 'signup' ? 'auth-modal-wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="auth-modal-close"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>

        <div className="auth-modal-body">
          {tab === 'signin' && (
            <form className="auth-tab-content flex flex-col gap-md" onSubmit={onSignIn}>
              <h2 className="font-h3 text-h3 text-primary">Sign In</h2>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Email <span className="req">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="auth-field w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setDevOpen(true)}
                    onBlur={() => setDevOpen(false)}
                    required
                  />
                  <DevAccountsDropdown
                    open={devOpen}
                    onPick={(devEmail, devPassword) => {
                      setEmail(devEmail)
                      setPassword(devPassword)
                      setDevOpen(false)
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Password <span className="req">*</span>
                </label>
                <PasswordInput placeholder="••••••••" value={password} onChange={setPassword} />
              </div>
              {error && <p className="text-error text-[12px] text-center">{error}</p>}
              <button type="submit" className="auth-primary-btn" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-outline-variant/50" />
                <span className="text-[11px] text-on-surface-variant">or</span>
                <div className="flex-1 h-px bg-outline-variant/50" />
              </div>
              <button
                type="button"
                onClick={onGoogle}
                disabled={loading}
                className="w-full border border-outline-variant rounded-lg py-2.5 text-[13px] font-label-bold hover:bg-surface-container transition-colors disabled:opacity-60"
              >
                Continue with Google
              </button>
              <div className="flex items-center justify-between text-[12px] text-on-surface-variant">
                <button type="button" onClick={() => setTab('forgot')} className="hover:text-primary">
                  Forgot password?
                </button>
                <button type="button" onClick={() => setTab('signup')} className="hover:text-on-surface">
                  No account? <span className="auth-link-accent">Create account</span>
                </button>
              </div>
            </form>
          )}

          {tab === 'signup' && (
            <form className="auth-tab-content flex flex-col gap-md" onSubmit={onSignUp}>
              <h2 className="font-h3 text-h3 text-primary">Create Account</h2>
              <div className="grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Full Name <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="auth-field"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">Phone</label>
                  <input
                    type="tel"
                    className="auth-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Email <span className="req">*</span>
                </label>
                <input
                  type="email"
                  className="auth-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Password <span className="req">*</span>
                  </label>
                  <PasswordInput
                    placeholder="••••••"
                    value={password}
                    onChange={setPassword}
                    minLength={8}
                  />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Confirm <span className="req">*</span>
                  </label>
                  <PasswordInput
                    placeholder="••••••"
                    value={confirm}
                    onChange={setConfirm}
                    minLength={8}
                  />
                </div>
              </div>
              {error && <p className="text-error text-[12px] text-center">{error}</p>}
              <button type="submit" className="auth-primary-btn" disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'}
              </button>
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 h-px bg-outline-variant/50" />
                <span className="text-[11px] text-on-surface-variant">or</span>
                <div className="flex-1 h-px bg-outline-variant/50" />
              </div>
              <button
                type="button"
                onClick={onGoogle}
                disabled={loading}
                className="w-full border border-outline-variant rounded-lg py-2.5 text-[13px] font-label-bold hover:bg-surface-container transition-colors disabled:opacity-60"
              >
                Continue with Google
              </button>
              <p className="text-center text-[12px] text-on-surface-variant">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('signin')} className="auth-link-accent">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {tab === 'forgot' && (
            <div className="auth-tab-content flex flex-col gap-md">
              <h2 className="font-h3 text-h3 text-primary">Reset Password</h2>
              <p className="text-sm text-on-surface-variant">
                Please contact the group administrator and they will help you reset your password.
              </p>
              <button type="button" onClick={() => setTab('signin')} className="auth-primary-btn">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
