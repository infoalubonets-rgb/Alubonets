import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireActiveRole } from '@/lib/auth/session'
import { canReadDocument } from '@/lib/documents'
import { createServerClient } from '@/lib/supabase-server'
import { writeAudit } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActiveRole(['ADMIN','SECRETARY','EXECUTIVE','TREASURER','ORGANIZER','MEMBER'])
  const { id } = await params
  const document = await prisma.document.findUnique({ where: { id } })
  if (!document || !canReadDocument(document, actor.role)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const requestHeaders = await headers()
  const ipAddress = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = requestHeaders.get('user-agent')
  await prisma.documentDownload.create({ data: { documentId: id, userId: actor.id, ipAddress, userAgent } })
  await writeAudit({ userId: actor.id, action: 'DOCUMENT_DOWNLOAD', entity: 'Document', entityId: id, ipAddress, userAgent, meta: { title: document.title, version: document.version } })
  if (document.storagePath) {
    const { data, error } = await createServerClient().storage.from('documents').createSignedUrl(document.storagePath, 60)
    if (error || !data?.signedUrl) return NextResponse.json({ error: 'File unavailable' }, { status: 404 })
    return NextResponse.redirect(data.signedUrl)
  }
  return NextResponse.redirect(document.fileUrl)
}
