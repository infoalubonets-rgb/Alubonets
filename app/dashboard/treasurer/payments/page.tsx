import { redirect } from 'next/navigation'

export default function TreasurerPaymentsRedirect() {
  redirect('/dashboard/treasurer/contributions')
}
