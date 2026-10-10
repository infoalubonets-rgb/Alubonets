import { redirect } from 'next/navigation'

export default function AdminCommitteeRedirect() {
  redirect('/admin/announcements/about')
}
