export type AttendanceRecordForExport = {
  status: 'PRESENT' | 'APOLOGY' | 'ABSENT'
  user: { fullName: string }
}

type MeetingAttendanceSource = {
  attendees?: string | null
  membersApology?: string | null
  membersAbsent?: string | null
  attendanceRecords?: AttendanceRecordForExport[] | null
}

function lines(text: string | null | undefined) {
  return (text || '').split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * Names per attendance group, newline-separated. Member records come first, then any
 * extra names typed in the legacy text fields (guests, or minutes recorded before the picker).
 */
export function attendanceLists(meeting: MeetingAttendanceSource) {
  const records = meeting.attendanceRecords ?? []
  const names = (status: AttendanceRecordForExport['status']) =>
    records
      .filter((record) => record.status === status)
      .map((record) => record.user.fullName)
      .sort((a, b) => a.localeCompare(b))
  return {
    present: [...names('PRESENT'), ...lines(meeting.attendees)].join('\n'),
    apology: [...names('APOLOGY'), ...lines(meeting.membersApology)].join('\n'),
    absent: [...names('ABSENT'), ...lines(meeting.membersAbsent)].join('\n'),
  }
}

export const ATTENDANCE_RECORDS_INCLUDE = {
  select: { status: true, user: { select: { fullName: true } } },
} as const
