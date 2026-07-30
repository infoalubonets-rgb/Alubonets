import type { Metadata } from 'next'
import RegistrationForm from '@/components/auth/RegistrationForm'

export const metadata: Metadata = {
  title: 'Membership application',
  description: 'Apply to become an Alubonets member.',
}

export default function RegisterPage() {
  return <RegistrationForm />
}
