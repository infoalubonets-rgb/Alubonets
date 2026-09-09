'use client'

import { useState, useTransition } from 'react'
import { beginMfaEnrollment, confirmMfaEnrollment, disableMfa } from '@/app/actions/mfa'

export default function PrivilegedMfaPanel({
  enabled,
  canManage,
}: {
  enabled: boolean
  canManage: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!canManage) return null

  return (
    <section className="mt-4 rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-xl text-primary">Privileged MFA</h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Admin, Treasurer, Secretary and Executive accounts should enable authenticator MFA.
      </p>
      <p className="mt-2 text-sm">
        Status:{' '}
        <span className="font-semibold">{enabled ? 'Enabled' : 'Not enabled'}</span>
      </p>

      {!enabled && (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-50"
            onClick={() => {
              setError('')
              setMessage('')
              startTransition(async () => {
                try {
                  const result = await beginMfaEnrollment()
                  setSecret(result.secret)
                  setOtpauth(result.otpauthUrl)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not start MFA setup.')
                }
              })
            }}
          >
            Start MFA setup
          </button>
          {secret && (
            <form
              className="space-y-2 rounded-xl border border-outline-variant p-3"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                setError('')
                setMessage('')
                startTransition(async () => {
                  try {
                    const result = await confirmMfaEnrollment(formData)
                    setMessage('MFA enabled. Store the recovery codes below in a safe place — they are shown only once.')
                    setSecret(null)
                    setOtpauth(null)
                    setRecoveryCodes(result.recoveryCodes || [])
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Invalid code.')
                  }
                })
              }}
            >
              <p className="text-xs text-on-surface-variant">
                Add this secret in your authenticator app, then enter the 6-digit code.
              </p>
              <code className="block break-all rounded bg-surface-container-low px-2 py-1 text-xs">{secret}</code>
              {otpauth && (
                <a href={otpauth} className="block text-xs text-primary underline">
                  Open otpauth link
                </a>
              )}
              <input
                name="token"
                required
                minLength={6}
                maxLength={8}
                placeholder="Authenticator code"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
                Confirm MFA
              </button>
            </form>
          )}
        </div>
      )}

      {enabled && (
        <>
        <form
          className="mt-4 space-y-2 rounded-xl border border-outline-variant p-3"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            setError('')
            setMessage('')
            startTransition(async () => {
              try {
                const result = await beginMfaEnrollment(formData)
                setSecret(result.secret)
                setOtpauth(result.otpauthUrl)
                setMessage('Add the new secret below, then confirm to finish switching.')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not start MFA setup.')
              }
            })
          }}
        >
          <p className="text-xs text-on-surface-variant">
            Moving to a new phone? Enter a code from your current authenticator to swap it.
          </p>
          <input
            name="currentToken"
            required
            minLength={6}
            maxLength={8}
            placeholder="Current authenticator code"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button disabled={pending} className="rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-50">
            Replace authenticator
          </button>
        </form>

        {secret && (
          <form
            className="mt-3 space-y-2 rounded-xl border border-outline-variant p-3"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              setError('')
              startTransition(async () => {
                try {
                  const result = await confirmMfaEnrollment(formData)
                  setMessage('New authenticator confirmed. Store the new recovery codes below.')
                  setSecret(null)
                  setOtpauth(null)
                  setRecoveryCodes(result.recoveryCodes || [])
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Invalid code.')
                }
              })
            }}
          >
            <p className="text-xs text-on-surface-variant">
              Add this secret in your new authenticator, then enter the code it shows.
            </p>
            <code className="block break-all rounded bg-surface-container-low px-2 py-1 text-xs">{secret}</code>
            {otpauth && (
              <a href={otpauth} className="block text-xs text-primary underline">
                Open otpauth link
              </a>
            )}
            <input
              name="token"
              required
              minLength={6}
              maxLength={8}
              placeholder="New authenticator code"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm text-on-primary disabled:opacity-50">
              Confirm new authenticator
            </button>
          </form>
        )}

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            setError('')
            setMessage('')
            startTransition(async () => {
              try {
                await disableMfa(formData)
                setMessage('MFA disabled.')
                window.location.reload()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not disable MFA.')
              }
            })
          }}
        >
          <input
            name="token"
            required
            minLength={6}
            maxLength={8}
            placeholder="Authenticator code"
            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button disabled={pending} className="rounded-full border border-error/40 px-4 py-2 text-sm text-error disabled:opacity-50">
            Disable MFA
          </button>
        </form>
        </>
      )}

      {recoveryCodes.length > 0 && (
        <div className="mt-3 rounded-xl border border-outline-variant p-3">
          <p className="text-xs font-semibold text-on-surface">Recovery codes (save these now)</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-error">{error}</p>}
      {message && <p className="mt-3 text-sm text-primary">{message}</p>}
    </section>
  )
}
