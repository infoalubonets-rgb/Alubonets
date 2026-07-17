'use client'

import Link from 'next/link'
import { openAuthModal } from '@/components/auth/AuthModal'

export default function HeroActions() {
  return (
    <div className="flex flex-col sm:flex-row gap-md mt-sm">
      <button
        type="button"
        onClick={() => openAuthModal('signup')}
        className="hero-cta hero-cta-primary bg-secondary-container text-on-primary font-label-bold text-label-bold px-lg py-sm rounded-lg min-h-[48px] w-full sm:w-auto flex items-center justify-center gap-sm"
      >
        Join the Group
        <span className="material-symbols-outlined hero-cta-icon text-[20px]" aria-hidden="true">
          person_add
        </span>
      </button>
      <Link
        href="/about"
        className="hero-cta hero-cta-outline border-2 border-on-primary text-on-primary font-label-bold text-label-bold px-lg py-sm rounded-lg min-h-[48px] w-full sm:w-auto flex items-center justify-center gap-sm"
      >
        Learn More
        <span className="material-symbols-outlined hero-cta-icon text-[20px]" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </div>
  )
}
