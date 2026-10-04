'use client'

type DirectoryMember = {
  id: string
  fullName: string
  relationship: string | null
  principalName: string | null
  isPrincipal: boolean
  role: string | null
  profession: string | null
  skills: string | null
  location: string | null
}

export default function DirectoryClient({ members }: { members: DirectoryMember[] }) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <p className="text-sm text-on-surface-variant">
        Attached members and children stay hidden unless a Principal Member grants visibility. Sensitive fields are never shown by default.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <article key={member.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-on-surface">{member.fullName}</h2>
              {member.isPrincipal && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                  Principal
                </span>
              )}
            </div>
            <dl className="mt-2 space-y-1 text-xs text-on-surface-variant">
              {member.role && <div><dt className="inline font-semibold text-on-surface">Role: </dt><dd className="inline">{member.role}</dd></div>}
              {member.profession && <div><dt className="inline font-semibold text-on-surface">Profession: </dt><dd className="inline">{member.profession}</dd></div>}
              {member.skills && <div><dt className="inline font-semibold text-on-surface">Skills: </dt><dd className="inline">{member.skills}</dd></div>}
              {member.location && <div><dt className="inline font-semibold text-on-surface">Location: </dt><dd className="inline">{member.location}</dd></div>}
              {member.relationship && <div><dt className="inline font-semibold text-on-surface">Relationship: </dt><dd className="inline">{member.relationship}</dd></div>}
            </dl>
          </article>
        ))}
        {!members.length && (
          <p className="text-sm text-on-surface-variant sm:col-span-2 lg:col-span-3">No directory entries are visible yet.</p>
        )}
      </div>
    </div>
  )
}
