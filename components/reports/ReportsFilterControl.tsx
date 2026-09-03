'use client'

import { useReportsFilter, type ReportsFilterValue } from './ReportsFilterContext'

export default function ReportsFilterControl() {
  const { filter, setFilter } = useReportsFilter()
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
      Filter
      <select
        value={filter}
        onChange={(event) => setFilter(event.target.value as ReportsFilterValue)}
        className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm"
      >
        <option value="ALL">All</option>
        <option value="MEETING">Meetings</option>
        <option value="REPORT">Reports</option>
      </select>
    </label>
  )
}
