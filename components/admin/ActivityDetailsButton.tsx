import type { AuditLog } from '@prisma/client'
import IconModalButton from '@/components/ui/IconModalButton'
import { formatAuditAction } from '@/lib/audit-labels'
import { APP_TIMEZONE } from '@/lib/dates'
import { ROLE_LABEL, type Role } from '@/lib/auth/types'

export default function ActivityDetailsButton({ activity }: { activity: AuditLog & { user: { fullName: string; email: string } | null } }) {
  const role = (value: string | null) => value ? ROLE_LABEL[value as Role] || value : '—'
  const details = [
    ['Action', formatAuditAction(activity.action)],
    ['Date and time', activity.createdAt.toLocaleString('en-GB', { timeZone: APP_TIMEZONE, dateStyle: 'full', timeStyle: 'long' })],
    ['By', activity.user?.fullName || 'System'],
    ['Email', activity.user?.email || '—'],
    ['Account role', role(activity.actorRole)],
    ['Acting role', role(activity.actingRole)],
    ['Record type', activity.entity || '—'],
    ['Record ID', activity.entityId || '—'],
    ['Reason', activity.reason || '—'],
    ...(activity.ipAddress ? [['IP address', activity.ipAddress]] : []),
    ...(activity.userAgent ? [['Browser / device', activity.userAgent]] : []),
    ['Log ID', activity.id],
  ]
  return <IconModalButton icon="visibility" label={`View details: ${formatAuditAction(activity.action)}`} title="Activity details" size="wide">
    <div className="space-y-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-semibold text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}
      </dl>
      {([['Before', activity.oldValue], ['After', activity.newValue], ['Additional details', activity.meta]] as const).map(([label, value]) => value !== null && <section key={label}>
        <h3 className="mb-2 text-sm font-semibold">{label}</h3>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
      </section>)}
    </div>
  </IconModalButton>
}
