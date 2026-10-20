'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { sendContactMessage } from '@/app/actions/contact'
import type { ContactSubmitResult } from '@/lib/contact-types'

function ContactSuccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-success-title"
      className="contact-success-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-[#001f50]/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="contact-success-card w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          <span className="contact-success-ring absolute inset-0 rounded-full bg-secondary-container/25" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg">
            <span className="contact-success-check material-symbols-outlined text-[32px]">check</span>
          </div>
        </div>
        <h3 id="contact-success-title" className="mt-5 text-center font-h3 text-xl text-primary">
          Message sent
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-on-surface-variant">
          Thanks for reaching out. We&apos;ll get back to you shortly.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setError(null)
    startTransition(async () => {
      try {
        const result: ContactSubmitResult = await sendContactMessage(formData)
        if (!result.ok) {
          setError(result.error === 'rate'
            ? 'Too many messages were submitted. Please wait before trying again.'
            : result.message || 'Please check the form fields.')
          return
        }
        formRef.current?.reset()
        setSuccessOpen(true)
      } catch {
        setError('We could not send your message. Please try again.')
      }
    })
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-md flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span className="material-symbols-outlined icon-fill text-red-500" aria-hidden="true">error</span>
          <p className="text-[14px] font-medium">{error}</p>
        </div>
      )}

      <form ref={formRef} onSubmit={onSubmit} onInput={() => setError(null)} onReset={() => setError(null)} className="flex flex-col gap-md">
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <div>
          <div className="contact-section-label mb-sm">
            <span className="font-label-bold text-label-bold text-primary uppercase tracking-[0.14em] text-[12px]">
              Your Information
            </span>
            <span className="contact-section-accent" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="flex flex-col gap-xs">
              <label className="font-label-bold text-[15px] text-on-surface" htmlFor="name">
                Full Name <span className="req">*</span>
              </label>
              <div className="contact-input-wrap">
                <input
                  className="contact-field-modern font-body-md text-[16px] text-on-surface"
                  id="name"
                  name="name"
                  minLength={2}
                  maxLength={120}
                  placeholder="Jane Doe"
                  type="text"
                  required
                  disabled={pending}
                />
                <span className="material-symbols-outlined contact-input-icon text-[18px]">person</span>
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-bold text-[15px] text-on-surface" htmlFor="phone">
                Phone Number <span className="req">*</span>
              </label>
              <div className="contact-input-wrap">
                <input
                  className="contact-field-modern font-body-md text-[16px] text-on-surface"
                  id="phone"
                  name="phone"
                  maxLength={40}
                  placeholder="+254 7** *** ***"
                  type="tel"
                  required
                  disabled={pending}
                />
                <span className="material-symbols-outlined contact-input-icon text-[18px]">call</span>
              </div>
            </div>
          </div>
          <div className="mt-md grid grid-cols-1 gap-md md:grid-cols-2">
            <div className="flex flex-col gap-xs">
              <label className="font-label-bold text-[15px] text-on-surface" htmlFor="email">
                Email Address <span className="req">*</span>
              </label>
              <div className="contact-input-wrap">
                <input
                  className="contact-field-modern font-body-md text-[16px] text-on-surface"
                  id="email"
                  name="email"
                  maxLength={254}
                  placeholder="jane@example.com"
                  type="email"
                  required
                  disabled={pending}
                />
                <span className="material-symbols-outlined contact-input-icon text-[18px]">mail</span>
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-bold text-[15px] text-on-surface" htmlFor="category">
                Category
              </label>
              <div className="contact-input-wrap">
                <select
                  className="contact-select-modern font-body-md text-[16px] text-on-surface"
                  id="category"
                  name="category"
                  disabled={pending}
                >
                  <option value="">Select a category</option>
                  <option value="general">General Inquiry</option>
                  <option value="membership">Membership</option>
                  <option value="welfare">Welfare Support</option>
                  <option value="financial">Financial / Loans</option>
                  <option value="meetings">Meetings &amp; Events</option>
                  <option value="projects">Projects</option>
                  <option value="other">Other</option>
                </select>
                <span className="material-symbols-outlined contact-input-icon text-[18px]">expand_more</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary/15" />

        <div>
          <div className="contact-section-label mb-sm">
            <span className="font-label-bold text-label-bold text-primary uppercase tracking-[0.14em] text-[12px]">
              Message Details
            </span>
            <span className="contact-section-accent" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-bold text-[15px] text-on-surface" htmlFor="message">
              Message <span className="req">*</span>
            </label>
            <div className="contact-input-wrap items-start">
              <textarea
                className="contact-field-modern font-body-md text-[16px] text-on-surface resize-none"
                id="message"
                name="message"
                maxLength={5000}
                placeholder="Please provide details about your inquiry..."
                rows={4}
                required
                disabled={pending}
              />
              <span className="material-symbols-outlined contact-input-icon text-[18px]">edit_note</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-sm sm:flex-row">
          <button
            className="contact-submit flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-primary font-label-bold text-[15px] text-on-primary disabled:opacity-70"
            type="submit"
            disabled={pending}
          >
            {pending ? (
              <>
                <span className="material-symbols-outlined mr-2 animate-spin text-[18px]">progress_activity</span>
                Sending…
              </>
            ) : (
              'Send Message'
            )}
          </button>
          <button
            className="contact-reset min-h-[48px] flex-1 rounded-full border-2 border-primary/35 font-label-bold text-[15px] text-primary disabled:opacity-70"
            type="reset"
            disabled={pending}
          >
            Clear Form
          </button>
        </div>
      </form>

      <ContactSuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} />
    </>
  )
}
