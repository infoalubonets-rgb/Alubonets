from pathlib import Path
for f in ['components/finance/AddContributionButton.tsx','components/finance/LedgerActions.tsx']:
 p=Path(f);s=p.read_text(encoding='utf-8');s=s.replace("where: { status: 'ACTIVE' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, membershipNumber: true }", "orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, membershipNumber: true }")
 s=s.replace('            <p className="text-xs text-on-surface-variant">\n              Every payment needs a purpose. Choose a campaign or project to count the payment towards its target. Historical payments can be backdated.\n            </p>\n','');p.write_text(s,encoding='utf-8')
p=Path('components/finance/RecordContributionForm.tsx');s=p.read_text(encoding='utf-8');s=s.replace('fullName: string; membershipNumber:', 'fullName: string; email?: string; membershipNumber:');s=s.replace("  const [billingKind", "  const [method, setMethod] = useState('MPESA')\n  const [billingKind",1)
a=s.index('      if (!evidenceFile');b=s.index('      await recordLedgerContribution',a)
s=s[:a]+'''      const customMethod = String(formData.get('customMethod') || '').trim()
      if (method === 'OTHER' && customMethod) {
        formData.set('description', [formData.get('description'), `Payment method: ${customMethod}`].filter(Boolean).join(' · '))
      }
      if (evidenceFile?.size) {
        if (!/\\.(pdf|png|webp|jpe?g)$/i.test(evidenceFile.name) || !['application/pdf', 'image/png', 'image/webp', 'image/jpeg'].includes(evidenceFile.type)) {
          throw new Error('Upload a PDF, PNG, WebP, JPEG or JPG file.')
        }
        setProgress({ percent: 0, status: 'Uploading proof…' })
        const requestFd = new FormData()
        requestFd.set('fileName', evidenceFile.name)
        const { bucket, path, token } = await requestEvidenceUploadUrl(requestFd)
        await uploadToSignedUrlWithProgress(bucket, path, token, evidenceFile, (percent) =>
          setProgress({ percent, status: `Uploading proof… ${percent}%` }),
        )
        formData.set('evidencePath', path)
        formData.set('evidenceMimeType', evidenceFile.type)
        formData.set('evidenceTitle', evidenceFile.name)
      }
      formData.delete('evidence')

'''+s[b:]
s=s.replace('className="mt-3 grid gap-2 md:grid-cols-3"','className="grid gap-4 md:grid-cols-2"')
a=s.index('      <select name="userId"');b=s.index('      <PaymentCategoryFields',a)
s=s[:a]+'''      <label className="text-sm">Member
        <select name="userId" required disabled={pending} defaultValue="" className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="" disabled>Select member</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} — {m.email}</option>)}
        </select>
      </label>
      <label className="text-sm">Amount (KES)
        <input name="amount" type="number" min="1" step="0.01" required disabled={pending} placeholder="0.00" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="text-sm">Payment method
        <select name="paymentMethod" value={method} onChange={(e) => setMethod(e.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border px-3 py-2">
          <option value="MPESA">M-Pesa</option><option value="BANK">Bank</option><option value="CASH">Cash</option><option value="OTHER">Other</option>
        </select>
      </label>
      {method === 'OTHER' && <label className="text-sm">Specify method
        <input name="customMethod" required maxLength={100} disabled={pending} placeholder="Type payment method" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>}
'''+s[b:]
s=s.replace('        kind="income"','        kind="income"\n        showDescription={false}')
a=s.index('      <input name="amount"',s.index('<PaymentCategoryFields'));b=s.index('      {progress &&',a)
s=s[:a]+'''      <label className="text-sm md:col-span-2">Proof / note (optional)
        <textarea name="description" maxLength={350} rows={2} disabled={pending} placeholder="Payment reference or note" className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="text-sm md:col-span-2">Upload proof (optional)
        <input type="file" name="evidence" disabled={pending} accept=".pdf,.png,.webp,.jpeg,.jpg,application/pdf,image/png,image/webp,image/jpeg" className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white" />
      </label>
      <details className="md:col-span-2">
        <summary className="cursor-pointer text-sm text-on-surface-variant">More details</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Receiving account
            <select name="sourceAccountId" required disabled={pending} className="mt-1 w-full rounded-lg border px-3 py-2">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Date paid
            <input name="occurredAt" type="date" required disabled={pending} max={today} defaultValue={today} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <input name="providerReference" disabled={pending} placeholder="Transaction reference (optional)" className="rounded-lg border px-3 py-2" />
        </div>
      </details>
'''+s[b:]
s=s.replace('md:col-span-3','md:col-span-2');p.write_text(s,encoding='utf-8')
p=Path('app/actions/finance.ts');s=p.read_text(encoding='utf-8');s=s.replace("description: formData.get('description'),", "description: formData.get('description') || undefined,",1)
s=s.replace("  if (!otherLabel) {\n    z.string().trim().min(2).max(500).parse(data.description)\n  } else {", "  if (otherLabel) {",1)
a=s.index('  const evidence = z.object({',s.index('export async function recordLedgerContribution'));b=s.index('  // Incoming contributions',a)
s=s[:a]+'''  const evidence = formData.get('evidencePath') ? z.object({
    evidencePath: z.string().min(1),
    evidenceMimeType: z.enum(['application/pdf', 'image/png', 'image/webp', 'image/jpeg']),
    evidenceTitle: z.string().regex(/\\.(pdf|png|webp|jpe?g)$/i, 'Unsupported proof file type.'),
  }).parse({
    evidencePath: formData.get('evidencePath'),
    evidenceMimeType: formData.get('evidenceMimeType'),
    evidenceTitle: formData.get('evidenceTitle'),
  }) : null
'''+s[b:]
s=s.replace('proofPath: evidence.evidencePath','proofPath: evidence?.evidencePath',1).replace('proofMimeType: evidence.evidenceMimeType','proofMimeType: evidence?.evidenceMimeType',1).replace('proofTitle: evidence.evidenceTitle','proofTitle: evidence?.evidenceTitle',1)
s=s.replace("  const safe = fileName.replace", "  if (!/\\.(pdf|png|webp|jpe?g)$/i.test(fileName)) throw new Error('Upload a PDF, PNG, WebP, JPEG or JPG file.')\n  const safe = fileName.replace",1);p.write_text(s,encoding='utf-8')
