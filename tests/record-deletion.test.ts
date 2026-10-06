import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireActiveRole: vi.fn(),
  findMany: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
  remove: vi.fn(), writeAudit: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => ({ requireActiveRole: mocks.requireActiveRole, requireAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { document: {
  findMany: mocks.findMany, findUniqueOrThrow: mocks.findUniqueOrThrow,
  updateMany: mocks.updateMany, deleteMany: mocks.deleteMany,
} } }))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: () => ({ storage: { from: () => ({ remove: mocks.remove }) } }) }))
vi.mock('@/lib/audit', () => ({ writeAudit: mocks.writeAudit }))
vi.mock('@/lib/data/queries', () => ({ TAGS: { documents: 'documents' } }))
vi.mock('@/lib/upload-signed', () => ({ createSignedUpload: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: vi.fn() }))

import { deleteSelectedRepositoryDocuments } from '@/app/actions/documents'

const document = (id: string, status: string) => ({
  id, status, title: id, version: 1, previousVersionId: null, nextVersion: null,
  publishedMeeting: null, storagePath: `${id}.pdf`, _count: { downloads: 0, projectLinks: 0 },
})
const selected = (...ids: string[]) => {
  const data = new FormData()
  ids.forEach(id => data.append('documentIds', id))
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveRole.mockResolvedValue({ id: 'admin' })
  mocks.remove.mockResolvedValue({ error: null })
})

describe('document deletion used by repository and report controls', () => {
  it('archives published records and deletes untouched drafts in one selection', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'published' }, { id: 'draft' }])
    mocks.findUniqueOrThrow.mockImplementation(({ where }) => Promise.resolve(document(where.id, where.id === 'draft' ? 'DRAFT' : 'PUBLISHED')))
    await deleteSelectedRepositoryDocuments(selected('published', 'draft'))
    expect(mocks.requireActiveRole).toHaveBeenCalledWith(['ADMIN', 'SECRETARY'])
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['published'] } }, data: { status: 'ARCHIVED', archivedAt: expect.any(Date) } })
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['draft'] } } })
    expect(mocks.remove).toHaveBeenCalledWith(['draft.pdf'])
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/meetings-reports')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/documents')
  })

  it('retains a downloaded draft and its file', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'downloaded' }])
    mocks.findUniqueOrThrow.mockResolvedValue({ ...document('downloaded', 'DRAFT'), _count: { downloads: 1, projectLinks: 0 } })
    await deleteSelectedRepositoryDocuments(selected('downloaded'))
    expect(mocks.updateMany).toHaveBeenCalled()
    expect(mocks.deleteMany).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('performs no mutations when authorization fails', async () => {
    mocks.requireActiveRole.mockRejectedValue(new Error('Not authorized'))
    await expect(deleteSelectedRepositoryDocuments(selected('draft'))).rejects.toThrow('Not authorized')
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.deleteMany).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
})
