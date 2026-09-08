import type { Metadata } from 'next'
import ContactForm from '@/components/contact/ContactForm'
import { getPublicContent } from '@/lib/public-content'
import { getPublicContact } from '@/lib/settings'

export const metadata: Metadata = {
  title: 'Contact Us',
}

export default async function ContactPage() {
  const [content, contact] = await Promise.all([getPublicContent('CONTACT'), getPublicContact()])
  const displayEmail = contact.email
  const displayPhone = contact.phone || content.phone || 'Coming soon'
  return (
    <main className="relative z-10 mx-auto w-full max-w-container-max flex-grow px-md py-lg pb-24 md:px-lg md:py-xl">
      <div className="relative z-10 grid grid-cols-1 items-start gap-lg md:gap-xl lg:grid-cols-5">
        <div className="reveal-left flex flex-col gap-lg lg:col-span-2">
          <div>
            <p className="font-label-bold text-label-bold text-primary uppercase tracking-[0.14em] text-[12px] mb-sm">
              Contact
            </p>
            <h1 className="font-h1 text-h1-mobile md:text-h1 text-primary mb-sm">Get in Touch</h1>
            <p className="font-body-lg text-[16px] leading-relaxed text-on-surface">
              {content.introduction}
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
                  href={`mailto:${displayEmail}`}
                  className="font-body-md text-[15px] text-on-surface-variant hover:text-primary transition-colors break-all"
                >
                  {displayEmail}
                </a>
              </div>
            </div>
            <div className="contact-info-row flex items-start gap-md">
              <div className="bg-primary-fixed rounded-xl p-[14px] flex-shrink-0 text-primary">
                <span className="material-symbols-outlined">call</span>
              </div>
              <div>
                <p className="font-label-bold text-[15px] text-primary mb-xs">Phone</p>
                <p className="font-body-md text-[15px] text-on-surface-variant">{displayPhone}</p>
              </div>
            </div>
            <div className="contact-info-row flex items-start gap-md">
              <div className="bg-primary-fixed rounded-xl p-[14px] flex-shrink-0 text-primary">
                <span className="material-symbols-outlined">location_on</span>
              </div>
              <div>
                <p className="font-label-bold text-[15px] text-primary mb-xs">Location</p>
                <p className="font-body-md text-[15px] text-on-surface-variant">
                  {content.location}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="reveal-right lg:col-span-3">
          <div className="contact-form-panel rounded-2xl border border-primary/10 bg-white p-md">
            <div className="mb-md">
              <h2 className="font-h3 text-[22px] leading-snug text-primary">Send a Message</h2>
            </div>
            <ContactForm />
          </div>
        </div>
      </div>
    </main>
  )
}
