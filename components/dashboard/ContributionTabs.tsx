import Link from 'next/link'

/** "My contributions" / "Members' contributions" switch for people who can see all finances. */
export default function ContributionTabs({ active }: { active: 'mine' | 'members' }) {
  const tab = (key: 'mine' | 'members', href: string, label: string, icon: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
        active === key ? 'bg-primary text-on-primary shadow-[0_3px_10px_rgba(0,31,80,0.18)]' : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </Link>
  )
  return (
    <nav aria-label="Contributions" className="flex w-fit items-center gap-1 rounded-full border border-outline-variant bg-surface p-1">
      {tab('mine', '/contributions', 'My contributions', 'person')}
      {tab('members', '/contributions?tab=members', 'Members’ contributions', 'groups')}
    </nav>
  )
}
