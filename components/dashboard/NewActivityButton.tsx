'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { uploadToSignedUrl, publicUrlFor } from '@/lib/upload-client'
import { todayInputValue } from '@/lib/dates'

type CreateResult = { notified: number; emailed: number; emailRequested: boolean }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** "+ New activity" header button; the add form opens in a pop-up. */
export default function NewActivityButton({
  createAction,
  prepareImageUpload,
}: {
  createAction: (formData: FormData) => Promise<CreateResult>
  prepareImageUpload: () => Promise<{ bucket: string; path: string; token: string }>
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  function pickImage(file: File | null) {
    setError('')
    if (file && file.size > MAX_IMAGE_BYTES) {
      setError('Image must be 5 MB or smaller.')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setImage(file)
    setPreview(file ? URL.createObjectURL(file) : '')
  }

  function close() {
    if (pending) return
    setOpen(false)
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const formData = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      if (image) {
        const slot = await prepareImageUpload()
        await uploadToSignedUrl(slot.bucket, slot.path, slot.token, image)
        formData.set('imageUrl', publicUrlFor(slot.bucket, slot.path))
      }
      const result = await createAction(formData)
      setDone(
        `Activity published. ${result.notified} member${result.notified === 1 ? '' : 's'} notified` +
          (result.emailRequested ? `, ${result.emailed} email${result.emailed === 1 ? '' : 's'} sent.` : '. No emails sent.'),
      )
      window.setTimeout(() => setDone(''), 6000)
      formRef.current?.reset()
      pickImage(null)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {done && <span className="text-xs font-medium text-green-700">{done}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-secondary-container px-4 text-[13px] font-label-bold text-on-primary shadow-[0_3px_10px_rgba(254,128,21,0.22)] transition hover:opacity-90"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        New activity
      </button>

      <FullScreenModal open={open} title="New activity" onClose={close} size="compact">
        <form ref={formRef} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-on-surface">
            Date
            <input name="date" type="date" required min={todayInputValue()} defaultValue={todayInputValue()} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-on-surface">
            Heading
            <input name="title" required minLength={3} maxLength={200} placeholder="e.g. Family clean-up day" className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-on-surface sm:col-span-2">
            Subheading <span className="font-normal text-on-surface-variant">(optional)</span>
            <input name="subtitle" maxLength={240} placeholder="e.g. Meet at the community hall, 9 am" className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-semibold text-on-surface sm:col-span-2">
            Description <span className="font-normal text-on-surface-variant">(optional)</span>
            <textarea name="body" rows={4} maxLength={4000} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <div className="text-sm font-semibold text-on-surface sm:col-span-2">
            Image <span className="font-normal text-on-surface-variant">(optional)</span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-normal hover:bg-surface-container-low">
                <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                {image ? 'Change image' : 'Choose image'}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
              </label>
              {preview && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="h-16 w-24 rounded-lg object-cover" />
                  <button type="button" onClick={() => pickImage(null)} className="text-xs font-normal text-error underline">Remove</button>
                </>
              )}
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 sm:col-span-2">
            <input type="checkbox" name="sendEmail" defaultChecked className="mt-0.5 h-4 w-4" />
            <span>
              <span className="block text-sm font-semibold text-on-surface">Also email all members</span>
              <span className="block text-xs text-on-surface-variant">Everyone always gets an in-app notification. Untick to skip the email.</span>
            </span>
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={close} disabled={pending} className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:cursor-wait disabled:opacity-60">
              {pending && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              {pending ? 'Publishing…' : 'Publish activity'}
            </button>
          </div>
        </form>
      </FullScreenModal>
    </div>
  )
}
