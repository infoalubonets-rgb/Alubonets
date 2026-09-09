export default function OfficialPaymentDestination({
  destination,
}: {
  destination: {
    bankName: string
    accountName: string
    accountNumber: string
    paybillOrTill: string | null
    branchName: string | null
    notes: string | null
  } | null
}) {
  if (!destination) {
    return (
      <section className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Official group payment details have not been published yet. Contact the Treasurer or Admin.
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface p-4">
      <h2 className="font-h3 text-base text-primary">Official payment destination</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">Bank</dt>
          <dd className="font-semibold">{destination.bankName}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">Account name</dt>
          <dd className="font-semibold">{destination.accountName}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">Account number</dt>
          <dd className="font-semibold tracking-wide">{destination.accountNumber}</dd>
        </div>
        {destination.paybillOrTill && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">Paybill / Till</dt>
            <dd className="font-semibold">{destination.paybillOrTill}</dd>
          </div>
        )}
        {destination.branchName && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-on-surface-variant">Branch</dt>
            <dd className="font-semibold">{destination.branchName}</dd>
          </div>
        )}
      </dl>
      {destination.notes && (
        <p className="mt-2 text-xs text-on-surface-variant">{destination.notes}</p>
      )}
    </section>
  )
}
