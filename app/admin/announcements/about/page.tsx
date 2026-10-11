import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'
export default async function OldAboutProfilesPage() { await requireAdmin(); redirect('/admin/members/about') }
