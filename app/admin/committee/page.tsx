import { redirect } from 'next/navigation'

export default function AdminCommitteeRedirect() {
  redirect('/directory?role=EXECUTIVE')
}
