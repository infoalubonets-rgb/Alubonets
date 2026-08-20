'use client'

export default function ErrorDialog({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="friendly-error-title" className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
      <div className="flex gap-3"><span className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container text-error">error</span><div><h2 id="friendly-error-title" className="font-h3 text-lg text-primary">{title}</h2><p className="mt-1 text-sm leading-6 text-on-surface-variant">{message}</p></div></div>
      <button autoFocus type="button" onClick={onClose} className="mt-5 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">OK</button>
    </section>
  </div>
}
