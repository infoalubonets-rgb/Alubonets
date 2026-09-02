import { createResolution } from '@/app/actions/governance'
import { GOVERNANCE_CATEGORIES } from '@/lib/governance-categories'

export default function CreateResolutionForm() {
  return (
    <form action={createResolution} className="space-y-3 rounded-2xl border bg-surface p-5">
      <h2 className="font-h3 text-lg text-primary">Share a proposal for approval</h2>
      <p className="text-sm text-on-surface-variant">
        Once submitted, an Admin or Super Admin must approve this before it appears on member dashboards.
      </p>
      <select name="category" defaultValue="RESOLUTION" className="block w-full rounded-lg border px-3 py-2 text-sm">
        {GOVERNANCE_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>{category.label}</option>
        ))}
      </select>
      <input
        name="title"
        required
        minLength={3}
        placeholder="Title"
        className="block w-full rounded-lg border px-3 py-2 text-sm"
      />
      <textarea
        name="body"
        required
        minLength={5}
        rows={4}
        placeholder="Describe the proposal members need to review…"
        className="block w-full rounded-lg border px-3 py-2 text-sm"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-on-surface-variant">
          Image (optional)
          <input type="file" name="image" accept="image/*" className="mt-1 block w-full text-sm" />
        </label>
        <label className="text-xs font-bold text-on-surface-variant">
          Document (optional, PDF/Word)
          <input type="file" name="document" accept=".pdf,.doc,.docx" className="mt-1 block w-full text-sm" />
        </label>
      </div>
      <button className="w-fit rounded-full bg-primary px-4 py-2 text-sm text-on-primary">Submit for approval</button>
    </form>
  )
}
