import DashboardShell from '@/components/dashboard/DashboardShell'
import { SECRETARY_NAV } from '@/lib/dashboard/nav'
import MeetingMinutesEditor from '@/components/meetings/MeetingMinutesEditor'

export default function NewMeetingPage() {
  return (
    <DashboardShell role="SECRETARY" title="New meeting" nav={SECRETARY_NAV}>
      <div className="p-4 md:p-6">
        <MeetingMinutesEditor
          mode="create"
          initial={{
            title: '',
            heldAt: new Date().toISOString(),
            attendance: 0,
            location: '',
            opening: '',
            attendees: '',
            membersAbsent: '',
            membersApology: '',
            aob: '',
            agenda: '',
            minutes: '',
            resolutions: '',
            nextMeetingAt: '',
            status: 'DRAFT',
          }}
        />
      </div>
    </DashboardShell>
  )
}
