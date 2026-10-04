import Link from 'next/link'

type Props = {
  variant: 'login' | 'renew'
  what: string
  reason?: string | null
  returnTo?: string
}

export default function MemberGate({ variant, what, reason, returnTo }: Props) {
  const loginHref = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login'
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-xl text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <span className="material-symbols-outlined icon-fill text-primary" style={{ fontSize: 30 }}>
          {variant === 'login' ? 'lock' : 'credit_card_off'}
        </span>
      </div>
      {variant === 'login' ? (
        <>
          <p className="font-semibold text-on-surface">Members only</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">Log in to your member account to see {what.toLowerCase()}.</p>
          <Link href={loginHref} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary">
            <span className="material-symbols-outlined text-[18px]">login</span>
            Log in
          </Link>
        </>
      ) : (
        <>
          <p className="font-semibold text-on-surface">Renew your membership to see {what.toLowerCase()}.</p>
          <p className="mt-1 text-[13px] text-on-surface-variant">
            {reason ? `${reason}. ` : ''}Full access returns automatically once your payment is confirmed by the Treasurer.
          </p>
          <Link href="/contributions" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-5 py-2 text-sm font-semibold text-on-primary">
            <span className="material-symbols-outlined text-[18px]">payments</span>
            View my contributions
          </Link>
        </>
      )}
    </div>
  )
}
