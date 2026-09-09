'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setProfileVisibility, DIRECTORY_SAFE_FIELDS } from '@/app/actions/directory'

type Attached = {
  id: string
  fullName: string
  visibleToMembers: boolean
  allowedFields: string[]
  isChild: boolean
}

export default function FamilyVisibilityControls({ members }: { members: Attached[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!members.length) return null

  return (
    <section className="mx-auto w-full max-w-6xl rounded-2xl border border-outline-variant/70 bg-surface p-4">
      <h2 className="text-sm font-bold text-primary">Attached member directory visibility</h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        Profiles stay hidden unless you allow them. Children default to hidden.
      </p>
      <ul className="mt-3 space-y-2">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{member.fullName}</p>
              <p className="text-[11px] text-on-surface-variant">
                {member.isChild ? 'Child/dependent · ' : ''}
                {member.visibleToMembers ? 'Visible in directory' : 'Hidden from directory'}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={() => {
                startTransition(async () => {
                  await setProfileVisibility({
                    userId: member.id,
                    visibleToMembers: !member.visibleToMembers,
                    allowedFields: (member.allowedFields.length
                      ? member.allowedFields
                      : ['fullName', 'role', 'familyBranch']) as typeof DIRECTORY_SAFE_FIELDS[number][],
                  })
                  router.refresh()
                })
              }}
            >
              {member.visibleToMembers ? 'Hide profile' : 'Allow in directory'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
