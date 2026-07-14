'use client'

import { useEffect, useState } from 'react'

type AuthTab = 'signin' | 'signup' | 'forgot'

let _open: (() => void) | null = null

export function openAuthModal() {
  _open?.()
}

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16" height="16" style={{ flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

function PasswordInput({ placeholder }: { placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="auth-password-wrap">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="auth-field auth-field-password"
        required
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
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<AuthTab>('signin')

  useEffect(() => {
    _open = () => setOpen(true)
    return () => {
      _open = null
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <div
      id="authModal"
      className="fixed inset-0 z-50 flex items-center justify-center p-md auth-modal-overlay"
      onClick={() => setOpen(false)}
    >
      <div
        className={`auth-modal-panel bg-white rounded-2xl w-full relative ${tab === 'signup' ? 'auth-modal-wide' : ''}`}
        onClick={e => e.stopPropagation()}
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
            <div className="auth-tab-content flex flex-col gap-md">
              <h2 className="font-h3 text-h3 text-primary">Sign In</h2>
              <button type="button" className="auth-google-btn">
                <GoogleIcon />
                Sign in with Google
              </button>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Email <span className="req">*</span>
                </label>
                <input type="email" placeholder="your@email.com" className="auth-field" required />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Password <span className="req">*</span>
                </label>
                <PasswordInput placeholder="••••••••" />
              </div>
              <button type="button" className="auth-primary-btn">
                Sign In
              </button>
              <div className="flex items-center justify-between text-[12px] text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setTab('forgot')}
                  className="hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className="hover:text-on-surface transition-colors"
                >
                  No account? <span className="auth-link-accent">Create account</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'signup' && (
            <div className="auth-tab-content flex flex-col gap-md">
              <h2 className="font-h3 text-h3 text-primary">Create Account</h2>
              <button type="button" className="auth-google-btn">
                <GoogleIcon />
                Sign up with Google
              </button>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Full Name <span className="req">*</span>
                  </label>
                  <input type="text" placeholder="Jane Doe" className="auth-field" required />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Phone <span className="req">*</span>
                  </label>
                  <input type="tel" placeholder="07XX XXX XXX" className="auth-field" required />
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Email <span className="req">*</span>
                </label>
                <input type="email" placeholder="your@email.com" className="auth-field" required />
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Password <span className="req">*</span>
                  </label>
                  <PasswordInput placeholder="••••••" />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="auth-label">
                    Confirm <span className="req">*</span>
                  </label>
                  <PasswordInput placeholder="••••••" />
                </div>
              </div>
              <button type="button" className="auth-primary-btn">
                Create Account
              </button>
              <p className="text-center text-[12px] text-on-surface-variant">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  className="auth-link-accent hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {tab === 'forgot' && (
            <div className="auth-tab-content flex flex-col gap-md">
              <h2 className="font-h3 text-h3 text-primary">Reset Password</h2>
              <div className="flex flex-col gap-xs">
                <label className="auth-label">
                  Email <span className="req">*</span>
                </label>
                <input type="email" placeholder="your@email.com" className="auth-field" required />
              </div>
              <button type="button" className="auth-primary-btn">
                Send Reset Link
              </button>
              <p className="text-center text-[12px] text-on-surface-variant">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => setTab('signin')}
                  className="auth-link-accent hover:underline"
                >
                  Go to login
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
