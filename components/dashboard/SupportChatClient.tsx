'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSupportConversation, markSupportConversationRead, sendSupportMessage } from '@/app/actions/support-chat'
import ErrorDialog from '@/components/ui/ErrorDialog'
import { friendlyError } from '@/lib/safe-error'

type Message = { id: string; body: string; createdAt: string; senderId: string; sender: { id: string; fullName: string } }
type Conversation = { id: string; userId: string; subject: string | null; user: { id: string; fullName: string; email: string }; messages: Message[] }

const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()

export default function SupportChatClient({ isAdmin, actorId, conversations }: { isAdmin: boolean; actorId: string; conversations: Conversation[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState(conversations[0]?.id || '')
  const [body, setBody] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState('')
  const [deleting, startDeleteTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const selected = conversations.find(c => c.id === selectedId) || conversations[0]
  const filtered = useMemo(() => conversations.filter(c => `${c.user.fullName} ${c.user.email}`.toLowerCase().includes(query.toLowerCase())), [conversations, query])

  useEffect(() => { if (selected?.id) markSupportConversationRead(selected.id).then(() => window.dispatchEvent(new Event('support-chat-read'))).catch(() => {}) }, [selected?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selected?.messages.length])
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === 'visible') router.refresh() }, 30_000); return () => window.clearInterval(id) }, [router])

  const submit = () => {
    if (!body.trim()) return
    const message = body.trim()
    setError('')
    startTransition(async () => {
      try { await sendSupportMessage({ conversationId: selected?.id, body: message }); setBody(''); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not send message') }
    })
  }
  const friendly = error ? friendlyError(error, 'We could not send your message. Please try again.') : null

  const removeConversation = (id: string) => {
    setError('')
    startDeleteTransition(async () => {
      try {
        await deleteSupportConversation(id)
        setConfirmDeleteId('')
        if (selectedId === id) setSelectedId('')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete the conversation')
      }
    })
  }

  return (
    <div className="support-chat-compact mx-auto h-[calc(100vh-92px)] min-h-[500px] w-full max-w-[1380px] overflow-hidden rounded-[20px] border border-outline-variant/70 bg-surface shadow-[0_18px_50px_rgba(0,31,80,.11)]">
      <div className={`grid h-full ${isAdmin ? 'lg:grid-cols-[260px_minmax(0,1fr)_210px]' : 'lg:grid-cols-[minmax(0,1fr)_230px]'}`}>
        {isAdmin && (
          <aside className="flex min-h-0 flex-col border-r border-outline-variant/70 bg-surface-container-lowest">
            <div className="border-b border-outline-variant/60 p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-secondary">Support desk</p><h2 className="mt-0.5 text-lg font-bold text-primary">Conversations</h2></div><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-white">{conversations.length}</span></div><div className="relative mt-3"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-outline">search</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations" className="h-9 w-full rounded-lg border border-outline-variant bg-surface pl-9 pr-3 text-xs outline-none focus:border-secondary" /></div></div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2.5">{filtered.map(c => { const last = c.messages.at(-1); const confirming = confirmDeleteId === c.id; return <div key={c.id} role="button" tabIndex={0} onClick={() => setSelectedId(c.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c.id) } }} className={`group flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition cursor-pointer ${selected?.id === c.id ? 'bg-primary text-white shadow-md' : 'hover:bg-surface-container'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected?.id === c.id ? 'bg-white/15' : 'bg-secondary/15 text-secondary'}`}>{initials(c.user.fullName)}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><b className="truncate text-xs">{c.user.fullName}</b><small className="shrink-0 text-[8px] opacity-60">{last ? new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</small></span><span className="mt-0.5 block truncate text-[10px] opacity-65">{last?.body || 'No messages yet'}</span></span>{confirming ? <span className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}><button type="button" onClick={() => removeConversation(c.id)} disabled={deleting} aria-label={`Confirm delete conversation with ${c.user.fullName}`} title="Confirm delete" className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"><span className="material-symbols-outlined text-[13px]">check</span></button><button type="button" onClick={() => setConfirmDeleteId('')} disabled={deleting} aria-label="Cancel delete" title="Cancel" className={`flex h-6 w-6 items-center justify-center rounded-full ${selected?.id === c.id ? 'hover:bg-white/15' : 'hover:bg-surface-container-high'}`}><span className="material-symbols-outlined text-[13px]">close</span></button></span> : <button type="button" onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id) }} aria-label={`Delete conversation with ${c.user.fullName}`} title="Delete conversation" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 ${selected?.id === c.id ? 'hover:bg-white/15' : 'hover:bg-red-50 hover:text-red-600'}`}><span className="material-symbols-outlined text-[14px]">delete</span></button>}</div>})}{!filtered.length && <p className="p-5 text-center text-xs text-on-surface-variant">No conversations found.</p>}</div>
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-col bg-[radial-gradient(circle_at_top_right,rgba(254,128,21,.06),transparent_35%)]">
          <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-outline-variant/60 bg-surface/90 px-5 backdrop-blur"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{isAdmin && selected ? initials(selected.user.fullName) : 'AS'}</span><div className="min-w-0"><h2 className="truncate font-bold text-primary">{isAdmin ? selected?.user.fullName || 'Select a conversation' : 'Alubonets Support'}</h2><p className="flex items-center gap-1.5 text-xs text-on-surface-variant"><span className="h-2 w-2 rounded-full bg-emerald-500" />Administrator support · replies here</p></div></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active</span></header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7"><div className="mx-auto max-w-3xl space-y-4">{selected?.messages.map(m => { const mine = m.senderId === actorId; return <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>{!mine && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{initials(m.sender.fullName)}</span>}<div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'rounded-br-md bg-gradient-to-br from-secondary to-[#ff9c44] text-white' : 'rounded-bl-md border border-outline-variant/60 bg-surface text-on-surface'}`}><p className="whitespace-pre-wrap text-sm leading-6">{m.body}</p><p className={`mt-1 text-right text-[9px] ${mine ? 'text-white/70' : 'text-on-surface-variant'}`}>{new Date(m.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{mine && '  ✓✓'}</p></div></div>})}{!selected?.messages.length && <div className="grid min-h-[330px] place-items-center text-center"><div><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/10 text-secondary"><span className="material-symbols-outlined text-[32px]">forum</span></span><h3 className="mt-4 text-lg font-bold text-primary">How can we help?</h3><p className="mt-1 max-w-sm text-sm text-on-surface-variant">Send a message to the administrator. Your conversation stays available here.</p></div></div>}<div ref={bottomRef} /></div></div>
          <footer className="shrink-0 border-t border-outline-variant/60 bg-surface p-4"><div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-inner focus-within:border-secondary"><textarea value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} placeholder="Write a message…" rows={1} className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none" /><button onClick={submit} disabled={pending || !body.trim() || (isAdmin && !selected)} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-white shadow-[0_6px_18px_rgba(254,128,21,.35)] transition hover:-translate-y-0.5 disabled:opacity-40"><span className="material-symbols-outlined text-[21px]">send</span></button></div><p className="mt-2 text-center text-[10px] text-on-surface-variant">Enter to send · Shift + Enter for a new line</p></footer>
        </section>

        <aside className="hidden border-l border-outline-variant/60 bg-surface-container-lowest p-5 lg:block"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-on-surface-variant">Conversation details</p><div className="mt-6 text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-primary to-[#27538f] text-xl font-bold text-white shadow-lg">{isAdmin && selected ? initials(selected.user.fullName) : 'AS'}</span><h3 className="mt-4 font-bold text-primary">{isAdmin ? selected?.user.fullName || 'Member' : 'Administrator'}</h3><p className="mt-1 break-all text-xs text-on-surface-variant">{isAdmin ? selected?.user.email : 'Official Alubonets support'}</p></div><div className="mt-7 space-y-3 rounded-2xl border border-outline-variant/60 bg-surface p-4 text-xs"><div className="flex justify-between"><span className="text-on-surface-variant">Messages</span><b>{selected?.messages.length || 0}</b></div><div className="flex justify-between"><span className="text-on-surface-variant">Status</span><b className="text-emerald-600">Open</b></div><div className="flex justify-between"><span className="text-on-surface-variant">Response channel</span><b>In-app</b></div></div><div className="mt-5 rounded-2xl bg-primary p-4 text-white"><span className="material-symbols-outlined text-[24px]">verified_user</span><p className="mt-2 text-sm font-bold">Private and secure</p><p className="mt-1 text-xs leading-5 text-white/65">Only you and authorized administrators can view this conversation.</p></div></aside>
      </div>
      {friendly && <ErrorDialog title={friendly.title} message={friendly.message} onClose={() => setError('')} />}
    </div>
  )
}
