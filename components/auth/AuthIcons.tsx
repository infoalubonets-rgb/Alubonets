type IconProps = { hidden?: boolean; className?: string }

export function PasswordVisibilityIcon({ hidden = false, className = 'h-5 w-5' }: IconProps) {
  return hidden ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 6 9 6a15.7 15.7 0 0 1-2 2.7" />
      <path d="M6.6 6.6C4.4 8.1 3 10 3 10s3.5 6 9 6a9.7 9.7 0 0 0 3.4-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function UnlockIcon({ className = 'h-[17px] w-[17px]' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /><path d="M12 14v3" />
    </svg>
  )
}
