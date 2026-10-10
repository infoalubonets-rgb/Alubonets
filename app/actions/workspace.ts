'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAccountProfile } from '@/lib/auth/session'
import { allowedDashboards } from '@/lib/auth/types'
import { isRoleActive } from '@/lib/disabled-roles'
import { WORKSPACE_COOKIE, workspaceCookieValue } from '@/lib/auth/workspace'

export async function switchWorkspace(input: string) {
  const account = await getAccountProfile()
  if (!account || account.status !== 'ACTIVE') redirect('/login')
  const role = z.enum(['SUPER_ADMIN', 'ADMIN', 'EXECUTIVE', 'TREASURER', 'SECRETARY', 'ORGANIZER', 'MEMBER', 'AUDITOR']).parse(input)
  if (role === 'SUPER_ADMIN' ? !account.isSuperAdmin : !allowedDashboards(account).includes(role)) throw new Error('You do not have access to that workspace.')
  // Admins and Super Admins may open a deactivated workspace; the dashboard shows a notice there.
  const operator = account.role === 'ADMIN' || account.isSuperAdmin
  if (!operator && !(await isRoleActive(role === 'SUPER_ADMIN' ? 'ADMIN' : role))) throw new Error('That workspace is currently deactivated.')
  const store = await cookies()
  store.set(WORKSPACE_COOKIE, workspaceCookieValue(account.id, role), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  })
}
