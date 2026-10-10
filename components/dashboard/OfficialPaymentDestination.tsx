export type PaymentDestination = {
  bankName: string
  accountName: string
  accountNumber: string
  paybillOrTill: string | null
  branchName: string | null
  mpesaType: string | null
  mpesaNumber: string | null
  mpesaAccount: string | null
  mpesaName: string | null
  notes: string | null
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</dt>
      <dd className={`font-semibold ${wide ? 'tracking-wide' : ''}`}>{value}</dd>
    </div>
  )
}

export default function OfficialPaymentDestination({ destination }: { destination: PaymentDestination | null }) {
  const hasBank = Boolean(destination?.bankName && destination.accountNumber)
  const hasMpesa = Boolean(destination?.mpesaNumber)

  if (!destination || (!hasBank && !hasMpesa)) {
    return (
      <section className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Official group payment details have not been published yet. Contact the Treasurer or Admin.
      </section>
    )
  }

  const isPaybill = destination.mpesaType === 'PAYBILL'

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant bg-surface p-4">
      <h2 className="font-h3 text-base text-primary">Official payment destination</h2>

      {hasMpesa && (
        <div className="rounded-xl bg-surface-container-low p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[18px]">smartphone</span>
            M-Pesa {isPaybill ? 'Paybill' : 'Till (Buy Goods)'}
          </h3>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <Item label={isPaybill ? 'Paybill number' : 'Till number'} value={destination.mpesaNumber!} wide />
            {isPaybill && destination.mpesaAccount && <Item label="Account number" value={destination.mpesaAccount} wide />}
            {destination.mpesaName && <Item label="Business name" value={destination.mpesaName} />}
          </dl>
        </div>
      )}

      {hasBank && (
        <div className="rounded-xl bg-surface-container-low p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            Bank account
          </h3>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <Item label="Bank" value={destination.bankName} />
            <Item label="Account name" value={destination.accountName} />
            <Item label="Account number" value={destination.accountNumber} wide />
            {destination.paybillOrTill && <Item label="Bank paybill" value={destination.paybillOrTill} />}
            {destination.branchName && <Item label="Branch" value={destination.branchName} />}
          </dl>
        </div>
      )}

      {destination.notes && <p className="text-xs text-on-surface-variant">{destination.notes}</p>}
    </section>
  )
}
