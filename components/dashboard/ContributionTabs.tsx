import Link from 'next/link'

/** "My contributions" / "Members' contributions" switch for people who can see all finances. */
export default function ContributionTabs({ active }: { active: 'mine' | 'members' }) {
  const tab = (key: 'mine' | 'members', href: string, label: string, icon: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition ${
        active === key
          ? 'border-[#fe8015] bg-secondary-fixed text-on-secondary-fixed shadow-[0_3px_10px_rgba(254,128,21,0.25)]'
          : 'border-primary/30 bg-primary text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)] hover:bg-secondary-container'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </Link>
  )
  return (
    <nav aria-label="Contributions" className="flex flex-wrap items-center gap-2">
      {tab('mine', '/contributions', 'My contributions', 'person')}
      {tab('members', '/contributions?tab=members', 'Members’ contributions', 'groups')}
    </nav>
  )
}
