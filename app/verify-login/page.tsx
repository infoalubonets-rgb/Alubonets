'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
export default function VerifyLoginPage() {
  const router = useRouter(); const [code,setCode]=useState(''); const [error,setError]=useState('')
  useEffect(()=>{fetch('/api/auth/verify-login',{method:'PUT'}).then(async(res)=>{if(!res.ok){const data=await res.json();setError(data.error||'Could not send code.')}})},[])
  async function submit(e:FormEvent){e.preventDefault();const res=await fetch('/api/auth/verify-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});const data=await res.json();if(!res.ok)return setError(data.error);router.replace(data.redirectTo)}
  return <main className="min-h-screen bg-primary px-4 py-16"><form onSubmit={submit} className="mx-auto max-w-md space-y-4 rounded-2xl bg-surface p-6"><h1 className="font-h2 text-2xl text-primary">Verify your sign-in</h1><p className="text-sm">Enter the six-digit code sent to your email. During testing it is redirected to infoalubonets@gmail.com.</p><input value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="\d{6}" required className="w-full rounded-lg border px-3 py-3 text-center text-2xl tracking-[.4em]"/>{error&&<p className="text-error">{error}</p>}<button className="w-full rounded-full bg-primary py-3 text-on-primary">Verify</button></form></main>
}
