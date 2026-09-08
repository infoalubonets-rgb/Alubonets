'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { addContributionCategory, deleteContributionCategory } from '@/app/actions/settings'

type Category = { id: string; name: string; type: string; system: boolean }

export default function ContributionCategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [items, setItems] = useState(categories)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<Category | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isAdding, startAdding] = useTransition()
  const [isDeleting, startDeleting] = useTransition()

  useEffect(() => setItems(categories), [categories])

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    setMessage('')
    setError('')

    const tempId = `temp-${Date.now()}`
    const optimistic: Category = { id: tempId, name: trimmed, type: 'BOTH', system: false }
    setItems((current) =>
      [...current, optimistic].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    )
    setName('')

    startAdding(async () => {
      try {
        const formData = new FormData()
        formData.set('name', trimmed)
        const created = await addContributionCategory(formData)
        setItems((current) =>
          current
            .map((item) => (item.id === tempId ? created : item))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        )
        setMessage(`“${created.name}” added.`)
        router.refresh()
      } catch (err) {
        setItems((current) => current.filter((item) => item.id !== tempId))
        setName(trimmed)
        setError(err instanceof Error ? err.message : 'Could not add category. Try again.')
      }
    })
  }

  function removeCategory() {
    if (!confirming) return
    setError('')
    startDeleting(async () => {
      try {
        const formData = new FormData()
        formData.set('id', confirming.id)
        await deleteContributionCategory(formData)
        setItems((current) => current.filter((item) => item.id !== confirming.id))
        setMessage('“' + confirming.name + '” deleted.')
        setConfirming(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete category. Try again.')
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-low">
        <div className="flex items-center justify-between border-b border-outline-variant/50 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">Available categories</h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">{items.length} categories</p>
          </div>
          <span className="material-symbols-outlined text-xl text-primary">category</span>
        </div>
        <ul className="max-h-72 divide-y divide-outline-variant/40 overflow-y-auto p-2">
          {items.map((category) => (
            <li key={category.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">{category.system ? 'verified_user' : 'label'}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-on-surface">{category.name}</span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-on-surface-variant">
                  {category.type === 'BOTH' ? 'Income & expense' : category.type.toLowerCase()}
                </span>
              </span>
              {category.system ? (
                <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant">System</span>
              ) : (
                <button type="button" onClick={() => { setError(''); setMessage(''); setConfirming(category) }} aria-label={'Delete ' + category.name} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30">
                  <span className="material-symbols-outlined text-[17px]">delete</span>Delete
                </button>
              )}
            </li>
          ))}
          {!items.length && <li className="px-4 py-8 text-center text-sm text-on-surface-variant">No categories yet.</li>}
        </ul>
      </div>

      <form onSubmit={addCategory} className="rounded-2xl border border-outline-variant/60 bg-surface p-4">
        <label className="block text-sm font-semibold text-on-surface">
          Add a category
          <span className="mt-1 block text-xs font-normal text-on-surface-variant">Use a short, clear label for income and expense records.</span>
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={60} pattern="[A-Za-z0-9 ()&/,.'-]+" title="Use letters, numbers, spaces and basic punctuation only." placeholder="e.g. Member subscriptions" className="mt-3 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isAdding} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm disabled:cursor-wait disabled:opacity-60">
            <span className="material-symbols-outlined text-[18px]">add</span>{isAdding ? 'Adding…' : 'Add category'}
          </button>
          {message && <p role="status" className="text-xs font-medium text-green-700">{message}</p>}
          {error && !confirming && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
        </div>
      </form>

      {confirming && (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-[#001f50]/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setConfirming(null) }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-category-title" aria-describedby="delete-category-description" className="w-full max-w-md rounded-3xl border border-outline-variant/60 bg-surface p-6 shadow-2xl dark:bg-[#0a1628]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40"><span className="material-symbols-outlined">delete_forever</span></span>
            <h3 id="delete-category-title" className="mt-4 font-h3 text-xl text-on-surface">Delete category?</h3>
            <p id="delete-category-description" className="mt-2 text-sm leading-6 text-on-surface-variant">
              Remove <strong className="text-on-surface">“{confirming.name}”</strong> from available categories? Existing financial records will keep their category history.
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setConfirming(null); setError('') }} disabled={isDeleting} className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60">Cancel</button>
              <button type="button" onClick={removeCategory} disabled={isDeleting} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">{isDeleting ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
