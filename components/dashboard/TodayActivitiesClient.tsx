'use client'

type Activity = {
  id: string
  title: string
  body: string | null
  activityType: string
  startsAt: string
  endsAt: string | null
  venue: string | null
  createdByName: string
}

export default function TodayActivitiesClient({
  activities,
  canCreate,
  createAction,
}: {
  activities: Activity[]
  canCreate: boolean
  createAction: (formData: FormData) => Promise<unknown>
}) {
  return (
    <div className="space-y-5 p-4 md:p-6">
      <p className="text-sm text-on-surface-variant">
        Private daily feed for active members — family, welfare, training, project and committee activities.
      </p>

      {canCreate && (
        <form
          action={async (formData) => { await createAction(formData) }}
          className="grid gap-2 rounded-2xl border bg-surface p-4 md:grid-cols-2"
        >
          <h2 className="font-h3 text-base text-primary md:col-span-2">Post today’s activity</h2>
          <input name="title" required minLength={3} placeholder="Title" className="rounded-lg border px-3 py-2 text-sm md:col-span-2" />
          <textarea name="body" rows={3} placeholder="Details (optional)" className="rounded-lg border px-3 py-2 text-sm md:col-span-2" />
          <input name="startsAt" type="datetime-local" required className="rounded-lg border px-3 py-2 text-sm" />
          <input name="venue" placeholder="Venue (optional)" className="rounded-lg border px-3 py-2 text-sm" />
          <select name="activityType" className="rounded-lg border px-3 py-2 text-sm">
            <option value="GENERAL">General</option>
            <option value="FAMILY">Family</option>
            <option value="WELFARE">Welfare</option>
            <option value="TRAINING">Training</option>
            <option value="PROJECT">Project</option>
            <option value="COMMITTEE">Committee</option>
          </select>
          <select name="audienceType" className="rounded-lg border px-3 py-2 text-sm">
            <option value="ALL_MEMBERS">All registered members</option>
            <option value="SELECTED_ROLES">Selected roles</option>
            <option value="BRANCH_MEMBERS">Family branch</option>
          </select>
          <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary md:col-span-2">Publish activity</button>
        </form>
      )}

      <ul className="space-y-3">
        {activities.map((activity) => (
          <li key={activity.id} className="rounded-2xl border border-outline-variant bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                {activity.activityType}
              </span>
              <span className="text-xs text-on-surface-variant">
                {new Date(activity.startsAt).toLocaleString('en-KE')}
                {activity.venue ? ` · ${activity.venue}` : ''}
              </span>
            </div>
            <h3 className="mt-2 font-semibold text-on-surface">{activity.title}</h3>
            {activity.body && <p className="mt-1 whitespace-pre-line text-sm text-on-surface-variant">{activity.body}</p>}
            <p className="mt-2 text-[11px] text-on-surface-variant">Posted by {activity.createdByName}</p>
          </li>
        ))}
        {!activities.length && (
          <li className="rounded-2xl border border-dashed p-6 text-center text-sm text-on-surface-variant">
            No activities scheduled for today.
          </li>
        )}
      </ul>
    </div>
  )
}
