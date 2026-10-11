'use client'

export default function AboutProfilesError({ reset }: { reset: () => void }) {
  return <section role="alert" className="mx-auto my-12 max-w-lg rounded-2xl border border-outline-variant bg-surface p-6 text-center">
    <span className="material-symbols-outlined text-4xl text-primary">cloud_off</span>
    <h1 className="mt-3 text-xl font-semibold">About Us profiles could not load</h1>
    <p className="mt-2 text-sm text-on-surface-variant">The connection was interrupted. Your saved settings have not changed.</p>
    <div className="mt-5 flex justify-center gap-3"><button onClick={reset} className="rounded-full bg-primary px-5 py-2 text-on-primary">Try again</button><a href="/directory" className="rounded-full border px-5 py-2">Members</a></div>
  </section>
}
