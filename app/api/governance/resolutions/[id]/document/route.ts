import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase-server'

/** Signed download for a proposal attachment (PDF/Word/Excel) stored in the private documents bucket. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole(['ADMIN', 'SECRETARY', 'EXECUTIVE', 'TREASURER', 'ORGANIZER', 'MEMBER', 'AUDITOR'])
  const { id } = await params
  const resolution = await prisma.resolution.findUnique({ where: { id } })
  if (!resolution?.documentUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Legacy public gallery URLs remain open as-is.
  if (!resolution.documentUrl.startsWith('storage://')) {
    return NextResponse.redirect(resolution.documentUrl)
  }

  const path = resolution.documentUrl.replace(/^storage:\/\/documents\//, '')
  if (!path || path === resolution.documentUrl) {
    return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  }

  // Creators and admins can always open; others need an approved visible proposal.
  const isStaff = ['ADMIN', 'SECRETARY'].includes(actor.role)
  const isCreator = resolution.createdById === actor.id
  const isVisible =
    resolution.status === 'APPROVED' &&
    (actor.role === 'AUDITOR' ||
      resolution.visibleToRoles.length === 0 ||
      resolution.visibleToRoles.includes(actor.role))
  if (!isStaff && !isCreator && !isVisible) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await createServerClient().storage.from('documents').createSignedUrl(path, 120)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
