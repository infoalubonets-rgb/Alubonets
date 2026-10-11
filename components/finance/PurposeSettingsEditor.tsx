'use client'
import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import FullScreenModal from '@/components/ui/FullScreenModal'
import { savePurposeRule, resetMemberPurpose } from '@/app/actions/contribution-purpose-settings'
import { appliesToMember, type PurposeRule, type PurposeOverride } from '@/lib/contribution-purpose-rules'

type Category = { id: string; name: string; billingKind: string; fixedAmountKes: number | null }
type Data = { categories: Category[]; rules: PurposeRule[]; overrides: PurposeOverride[]; members: { id: string; fullName: string; email: string }[]; standing: { monthlyFeeKes: number; annualFeeKes: number }; balances: { categoryId: string; enabled: boolean; outstanding: number; nextDeadline: string | null }[] }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
const blank = (categoryId: string): PurposeRule => ({ categoryId, amountKes: 0, frequency: 'ONCE', deadline: today(), graceDays: 0, memberContribution: false, scope: 'NONE', memberIds: [] })
const field = 'mt-1 block w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-normal'

export function PurposeSettingsEditor({ memberId }: { memberId?: string }) {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [rule, setRule] = useState<PurposeRule>(blank(''))
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const choose = (id: string, source: Data) => {
    const category = source.categories.find(c => c.id === id)
    const base = source.rules.find(r => r.categoryId === id)
    const override = source.overrides.find(o => o.rule.categoryId === id)
    const next = override?.rule || base || { ...blank(id), amountKes: category?.fixedAmountKes ?? (category?.billingKind === 'MONTHLY' ? source.standing.monthlyFeeKes : category?.billingKind === 'ANNUAL' ? source.standing.annualFeeKes : 0), frequency: category?.billingKind === 'MONTHLY' ? 'MONTHLY' : category?.billingKind === 'ANNUAL' ? 'ANNUAL' : 'ONCE', memberContribution: category?.billingKind === 'MONTHLY' || category?.billingKind === 'ANNUAL' } as PurposeRule
    setRule(next)
    setEnabled(memberId ? override ? override.enabled : base ? appliesToMember(base, memberId) : false : true)
    setMessage(''); setError('')
  }
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/finance/purpose-settings${memberId ? `?member=${encodeURIComponent(memberId)}` : ''}`, { signal: controller.signal, cache: 'no-store' }).then(async res => {
      if (!res.ok) throw new Error('Could not load purpose settings.')
      const source: Data = await res.json()
      setData(source)
      if (source.categories[0]) choose(source.categories[0].id, source)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
    // `choose` only reads memberId, which is already a dependency; it is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId])
  const patch = (values: Partial<PurposeRule>) => setRule(current => ({ ...current, ...values }))
  const submit = (e: FormEvent) => {
    e.preventDefault(); setError(''); setMessage('')
    startTransition(async () => {
      try {
        // Member-specific settings inherit the purpose's application separately.
        const saved = memberId ? { ...rule, scope: 'ALL' as const, memberIds: [] } : rule
        await savePurposeRule(saved, memberId, enabled)
        setData(current => current ? { ...current, rules: memberId ? current.rules : [...current.rules.filter(r => r.categoryId !== saved.categoryId), saved], overrides: memberId ? [...current.overrides.filter(o => o.rule.categoryId !== saved.categoryId), { userId: memberId, rule: saved, enabled }] : current.overrides } : current)
        const response = await fetch(`/api/finance/purpose-settings${memberId ? `?member=${encodeURIComponent(memberId)}` : ''}`, { cache: 'no-store' })
        if (response.ok) { const fresh: Data = await response.json(); setData(fresh); choose(saved.categoryId, fresh) }
        setMessage(memberId ? 'Member settings saved.' : 'Purpose settings saved and applied.')
        router.refresh()
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not save settings.') }
    })
  }
  if (!data) return <p className="p-4 text-sm" role={error ? 'alert' : 'status'}>{error || 'Loading settings…'}</p>
  if (!data.categories.length) return <p className="text-sm">Add a payment purpose first.</p>
  const balance = data.balances.find(b => b.categoryId === rule.categoryId)
  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-semibold">Purpose<select className={field} value={rule.categoryId} onChange={e => choose(e.target.value, data)}>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Amount (KES)<input className={field} type="number" min="0" max="999999" step="0.01" required value={rule.amountKes} onChange={e => patch({ amountKes: Number(e.target.value) })} /></label>
      <label className="text-sm font-semibold">Frequency<select className={field} value={rule.frequency} onChange={e => patch({ frequency: e.target.value as PurposeRule['frequency'], ...(e.target.value === 'ONCE' ? { memberContribution: false } : {}) })}><option value="ONCE">One time</option><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option></select></label>
      <label className="text-sm font-semibold">{rule.frequency === 'ONCE' ? 'Deadline' : 'First deadline'}<input className={field} type="date" required value={rule.deadline} onChange={e => patch({ deadline: e.target.value })} /></label>
      <label className="text-sm font-semibold">Grace period (days)<input className={field} type="number" required min="0" max="365" value={rule.graceDays} onChange={e => patch({ graceDays: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={rule.memberContribution} onChange={e => patch({ memberContribution: e.target.checked, ...(e.target.checked && rule.frequency === 'ONCE' ? { frequency: 'MONTHLY' as const } : {}) })} />Membership contribution</label>
    </div>
    {rule.frequency !== 'ONCE' && <p className="text-xs text-on-surface-variant">{rule.frequency === 'MONTHLY' ? `Repeats on day ${Number(rule.deadline.slice(8))} of every month.` : `Repeats every year on ${rule.deadline.slice(5)}.`} Short months use their last day. Grace starts after the deadline.</p>}
    {memberId ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Apply this purpose to this member</label> : <>
      <label className="block text-sm font-semibold">Apply to<select className={`${field} max-w-sm`} value={rule.scope} onChange={e => patch({ scope: e.target.value as PurposeRule['scope'] })}><option value="NONE">Save purpose only</option><option value="ALL">All members</option><option value="SELECTED">Selected members</option></select></label>
      {rule.scope === 'SELECTED' && <div className="rounded-xl border border-outline-variant p-3"><input aria-label="Search members" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} className={field} /><div className="mt-2 max-h-56 overflow-y-auto">{data.members.filter(m => `${m.fullName} ${m.email}`.toLowerCase().includes(search.toLowerCase())).map(m => <label key={m.id} className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={rule.memberIds.includes(m.id)} onChange={e => patch({ memberIds: e.target.checked ? [...rule.memberIds, m.id] : rule.memberIds.filter(id => id !== m.id) })} /><span>{m.fullName}<span className="ml-2 text-xs text-on-surface-variant">{m.email}</span></span></label>)}</div><p className="mt-2 text-xs">{rule.memberIds.length} selected</p></div>}
      {rule.memberContribution && rule.scope !== 'NONE' && <p className="text-xs text-on-surface-variant">Applies to the matching monthly or annual member plan. Existing member-specific settings stay in place.</p>}
    </>}
    {memberId && balance?.enabled && <p className="text-sm">Overdue: KES {balance.outstanding.toLocaleString()}{balance.nextDeadline ? ` · Next deadline: ${balance.nextDeadline.slice(0, 10)}` : ''}</p>}
    <div className="flex flex-wrap items-center gap-3"><button disabled={pending} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{pending ? 'Saving…' : memberId ? 'Save member settings' : 'Save & apply'}</button>
      {memberId && data.overrides.some(o => o.rule.categoryId === rule.categoryId) && <button type="button" disabled={pending} className="text-sm text-primary underline" onClick={() => startTransition(async () => { try { await resetMemberPurpose(memberId, rule.categoryId); const next = { ...data, overrides: data.overrides.filter(o => o.rule.categoryId !== rule.categoryId) }; setData(next); choose(rule.categoryId, next); setMessage('Default purpose settings restored.'); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Could not reset.') } })}>Use default settings</button>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}{error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  </form>
}

export function MemberPurposeSettingsButton({ memberId, name }: { memberId: string; name: string }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" onClick={() => setOpen(true)} aria-label={`Contribution settings for ${name}`} title="Contribution settings" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10"><span className="material-symbols-outlined text-[19px]">settings</span></button><FullScreenModal open={open} onClose={() => setOpen(false)} title={`Contribution settings · ${name}`} size="wide">{open && <PurposeSettingsEditor memberId={memberId} />}</FullScreenModal></>
}

