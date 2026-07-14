import type { Metadata } from 'next'
import { CONTACT_EMAIL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Contact Us',
}

export default function ContactPage() {
  return (
    <main className="flex-grow max-w-container-max mx-auto w-full px-md md:px-lg py-lg md:py-xl relative">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-lg md:gap-xl items-start relative z-10">
        <div className="lg:col-span-2 flex flex-col gap-lg">
          <div>
            <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.14em] text-[12px] mb-sm">
              Contact
            </p>
            <h1 className="font-h1 text-h1 text-primary mb-sm">Get in Touch</h1>
            <p className="font-body-lg text-[16px] leading-relaxed text-on-surface">
              Have a question or want to connect? We&apos;d love to hear from you.
            </p>
          </div>
          <div className="flex flex-col gap-md">
            <div className="contact-info-row flex items-start gap-md">
              <div className="bg-primary-fixed rounded-xl p-[14px] flex-shrink-0 text-primary">
                <span className="material-symbols-outlined">mail</span>
              </div>
              <div>
                <p className="font-label-bold text-[15px] text-primary mb-xs">Email</p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-body-md text-[15px] text-on-surface-variant hover:text-primary transition-colors"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
            <div className="contact-info-row flex items-start gap-md">
              <div className="bg-primary-fixed rounded-xl p-[14px] flex-shrink-0 text-primary">
                <span className="material-symbols-outlined">call</span>
              </div>
              <div>
                <p className="font-label-bold text-[15px] text-primary mb-xs">Phone</p>
                <p className="font-body-md text-[15px] text-on-surface-variant">Coming soon</p>
              </div>
            </div>
            <div className="contact-info-row flex items-start gap-md">
              <div className="bg-primary-fixed rounded-xl p-[14px] flex-shrink-0 text-primary">
                <span className="material-symbols-outlined">location_on</span>
              </div>
              <div>
                <p className="font-label-bold text-[15px] text-primary mb-xs">Location</p>
                <p className="font-body-md text-[15px] text-on-surface-variant">
                  Butere, Kakamega County, Kenya
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="contact-form-panel bg-white rounded-2xl p-md border border-primary/10">
            <div className="mb-md">
              <h2 className="font-h3 text-[22px] leading-snug text-primary">Send a Message</h2>
            </div>
            <form className="flex flex-col gap-md">
              <div>
                <div className="contact-section-label mb-sm">
                  <span className="font-label-bold text-label-bold text-primary uppercase tracking-[0.14em] text-[12px]">
                    Your Information
                  </span>
                  <span className="contact-section-accent" aria-hidden="true" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-bold text-[15px] text-on-surface" htmlFor="name">
                      Full Name <span className="req">*</span>
                    </label>
                    <div className="contact-input-wrap">
                      <input
                        className="contact-field-modern font-body-md text-[16px] text-on-surface"
                        id="name"
                        name="name"
                        placeholder="Jane Doe"
                        type="text"
                        required
                      />
                      <span className="material-symbols-outlined contact-input-icon text-[18px]">
                        person
                      </span>
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
                        placeholder="+254 7** *** ***"
                        type="tel"
                        required
                      />
                      <span className="material-symbols-outlined contact-input-icon text-[18px]">
                        call
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md mt-md">
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-bold text-[15px] text-on-surface" htmlFor="email">
                      Email Address <span className="req">*</span>
                    </label>
                    <div className="contact-input-wrap">
                      <input
                        className="contact-field-modern font-body-md text-[16px] text-on-surface"
                        id="email"
                        name="email"
                        placeholder="jane@example.com"
                        type="email"
                        required
                      />
                      <span className="material-symbols-outlined contact-input-icon text-[18px]">
                        mail
                      </span>
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
                      <span className="material-symbols-outlined contact-input-icon text-[18px]">
                        expand_more
                      </span>
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
                      placeholder="Please provide details about your inquiry..."
                      rows={4}
                      required
                    />
                    <span className="material-symbols-outlined contact-input-icon text-[18px]">
                      edit_note
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-sm">
                <button
                  className="contact-submit bg-primary text-on-primary rounded-full min-h-[48px] flex-1 font-label-bold text-[15px] flex items-center justify-center"
                  type="submit"
                >
                  Send Message
                </button>
                <button
                  className="contact-reset border-2 border-primary/35 text-primary rounded-full min-h-[48px] flex-1 font-label-bold text-[15px]"
                  type="reset"
                >
                  Clear Form
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}
