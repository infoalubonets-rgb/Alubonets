'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import MemberAccountActions from '@/components/admin/MemberAccountActions'
import MemberFamilyActions from '@/components/admin/MemberFamilyActions'
import ExecutiveAboutSettings from '@/components/admin/ExecutiveAboutSettings'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'
import type { DirectoryMember } from '@/lib/directory'
import { matchesDirectoryFilters, memberType, type DirectoryFilterValues } from '@/lib/directory-filters'

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

function roleLabel(member: DirectoryMember) {
  if (member.isSuperAdmin) return 'Super Administrator'
  const main = member.role ? ROLE_LABEL[member.role as Role] ?? title(member.role) : '—'
  return member.isExecutive && member.role !== 'EXECUTIVE' ? `${main} · Executive` : main
}


const TYPE_STYLE: Record<string, string> = {
  Principal: 'bg-primary/10 text-primary',
  Attached: 'bg-secondary-container/15 text-secondary',
  Minor: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  Member: 'bg-surface-container text-on-surface-variant',
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  PENDING: 'bg-secondary-fixed text-secondary',
  SUSPENDED: 'bg-error-container text-error',
}


function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 border-b border-outline-variant/50 py-2 text-sm last:border-0">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right font-medium text-on-surface">{value}</dd>
    </div>
  )
}

type Props = {
  members: DirectoryMember[]
  initialQuery?: string
}

export default function DirectoryClient({ members, initialQuery = '' }: Props) {
  const params = useSearchParams()
  const filters: DirectoryFilterValues = { type: params.get('type') ?? '', role: params.get('role') ?? '', status: params.get('status') ?? '' }
  const [query, setQuery] = useState(initialQuery)
  // Keep the id, not the row, so the pop-up shows fresh data after an admin action refreshes the page.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = members.find((member) => member.id === selectedId) ?? null
  const showDetails = members.some((member) => member.details)
  const isAdmin = members.some((member) => member.account)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter(
      (member) =>
        matchesDirectoryFilters(member, filters) &&
        (!q ||
          [member.fullName, member.profession, member.skills, member.location, member.principalName, member.details?.membershipNumber, member.familyTag]
            .some((field) => field?.toLowerCase().includes(q)) ||
          // Typing a family code (e.g. PJW) lists the Principal and everyone attached to them.
          member.familyCode?.toLowerCase() === q),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, query, filters.type, filters.role, filters.status])

  const stats = [
    { label: 'Members', value: members.length },
    { label: 'Principal', value: members.filter((m) => m.isPrincipal).length },
    { label: 'Attached', value: members.filter((m) => memberType(m) === 'Attached').length },
    { label: 'Minors', value: members.filter((m) => m.isMinor).length },
    { label: 'Executive', value: members.filter((m) => m.isExecutive).length },
  ]

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-outline-variant bg-surface px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{stat.label}</p>
            <p className="mt-0.5 text-2xl font-semibold text-on-surface">{stat.value}</p>
          </div>
        ))}
      </div>

      <label className="relative block">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">search</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, member ID, family code (e.g. PJW), profession…"
          className="h-10 w-full rounded-xl border bg-surface py-2 pl-9 pr-3 text-sm"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[0_4px_12px_rgba(20,32,51,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-left">
                {['Name', 'Role', 'Type', 'Branch / Principal', 'Profession', 'Location', ...(isAdmin ? ['Status'] : [])].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">{heading}</th>
                ))}
                <th className="w-16 px-4 py-3 text-right font-label-bold text-[11px] uppercase tracking-wide text-on-surface-variant">View</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-on-surface-variant">No members match this filter.</td>
                </tr>
              ) : (
                rows.map((member, i) => {
                  const type = memberType(member)
                  return (
                    <tr
                      key={member.id}
                      className={`border-t border-outline-variant/50 transition-colors hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-surface-container-low/40' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5 font-medium text-on-surface">
                          {member.fullName}
                          {member.familyTag && (
                            <span className="rounded-md bg-secondary-container/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-secondary" title="Family tag">
                              {member.familyTag}
                            </span>
                          )}
                        </p>
                        {member.details?.membershipNumber && (
                          <p className="text-xs text-on-surface-variant">{member.details.membershipNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{roleLabel(member)}</td>
                      <td className="px-4 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${TYPE_STYLE[type]}`}>{type}</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {member.isPrincipal
                          ? member.details ? `${member.details.attachedCount} attached` : '—'
                          : member.principalName
                            ? <>{member.principalName}{member.relationship && <span className="block text-xs">{title(member.relationship)}</span>}</>
                            : '—'}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.profession || '—'}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{member.location || '—'}</td>
                      {member.account && (
                        <td className="px-4 py-3">
                          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[member.account.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                            {title(member.account.status)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(member.id)}
                          aria-label={`View ${member.fullName}`}
                          title="View details"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary transition hover:bg-primary/10"
                        >
                          <span className="material-symbols-outlined text-[19px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-on-surface-variant">
        {isAdmin
          ? 'You can see and manage every account, including pending and suspended ones. Contact and profile details are for official use only.'
          : showDetails
          ? 'You can see every active member. Contact and profile details are for official use only.'
          : 'Attached members and children stay hidden unless a Principal Member grants visibility.'}
      </p>

      <FullScreenModal open={Boolean(selected)} title={selected?.fullName ?? 'Member'} onClose={() => setSelectedId(null)} size="compact">
        {selected && (
          <>
          <dl>
            <DetailRow label="Role" value={roleLabel(selected)} />
            <DetailRow label="Member type" value={memberType(selected)} />
            <DetailRow label="Account status" value={selected.account && title(selected.account.status)} />
            <DetailRow label="Member ID" value={selected.details?.membershipNumber} />
            <DetailRow label="Family tag" value={selected.familyTag} />
            <DetailRow label="Standing" value={selected.details && title(selected.details.standing)} />
            <DetailRow label="Joined" value={selected.details && new Date(selected.details.joinedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <DetailRow label="Principal member" value={selected.principalName} />
            <DetailRow label="Relationship" value={selected.relationship && title(selected.relationship)} />
            <DetailRow label="Attached members" value={selected.isPrincipal ? selected.details?.attachedCount : null} />
            <DetailRow label="Age" value={selected.details?.age} />
            <DetailRow label="Gender" value={selected.details?.gender && title(selected.details.gender)} />
            <DetailRow label="Family branch" value={selected.details?.familyBranch} />
            <DetailRow label="Category" value={selected.details?.memberCategory && title(selected.details.memberCategory)} />
            <DetailRow label="Education" value={selected.details?.educationLevel && title(selected.details.educationLevel)} />
            <DetailRow label="Profession" value={selected.profession} />
            <DetailRow label="Skills" value={selected.skills} />
            <DetailRow label="Interests" value={selected.details?.interests} />
            <DetailRow label="Mentorship area" value={selected.details?.mentorshipArea} />
            <DetailRow label="Location" value={selected.location} />
            <DetailRow label="Email" value={selected.contact?.email} />
            <DetailRow label="Phone" value={selected.contact?.phone} />
          </dl>
          {selected.account && selected.details && (
            <MemberAccountActions
              member={{
                id: selected.id,
                isSuperAdmin: selected.isSuperAdmin,
                isMinor: selected.isMinor,
                standing: selected.details.standing,
                ...selected.account,
              }}
            />
          )}
          {selected.account && (
            <MemberFamilyActions
              key={`family-${selected.id}`}
              member={{
                id: selected.id,
                fullName: selected.fullName,
                isPrincipal: selected.isPrincipal,
                principalName: selected.principalName,
                active: selected.account.status === 'ACTIVE',
                attachedCount: selected.details?.attachedCount ?? 0,
              }}
            />
          )}
          {selected.account && (selected.isExecutive || selected.account.about.show) && (
            <ExecutiveAboutSettings key={selected.id} userId={selected.id} about={selected.account.about} />
          )}
          </>
        )}
      </FullScreenModal>
    </div>
  )
}
