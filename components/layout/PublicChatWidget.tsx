import Link from 'next/link'

export default function PublicChatWidget() {
  return (
    <Link
      href="/contact"
      aria-label="Contact us with any issues or enquiries"
      title="Contact us"
      className="fixed bottom-5 right-5 z-[150] flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary shadow-[0_10px_30px_rgba(254,128,21,0.4)] transition hover:opacity-90 active:scale-95"
    >
      <span className="material-symbols-outlined text-[26px]">chat</span>
    </Link>
  )
}
