'use client'

import { formatKes } from '@/lib/chart-labels'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ChartTypeRegistry, TooltipItem } from 'chart.js'
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
)

const navy = '#001f50'
const orange = '#fe8015'
const green = '#166534'
const muted = '#7f9ee9'

type SeriesProps = {
  labels: string[]
  values: number[]
}

/**
 * Union (not intersection) of every chart type's tooltip item, so one tooltip config can be
 * shared across line/bar/pie/doughnut. Written as a distributed mapped type — `TooltipItem<
 * keyof ChartTypeRegistry>` would intersect the `parsed` shapes instead of unioning them.
 */
type AnyTooltipItem = { [K in keyof ChartTypeRegistry]: TooltipItem<K> }[keyof ChartTypeRegistry]

function chartValue(ctx: AnyTooltipItem) {
  const parsed = ctx.parsed as number | { y?: number | null; x?: number | null } | null
  if (typeof parsed === 'number') return parsed
  if (typeof parsed?.y === 'number') return parsed.y
  if (typeof parsed?.x === 'number') return parsed.x
  return typeof ctx.raw === 'number' ? ctx.raw : 0
}

const kesTooltip = {
  callbacks: {
    label: (ctx: AnyTooltipItem) =>
      `${ctx.label ? `${ctx.label}: ` : ''}${formatKes(chartValue(ctx))}`,
  },
}

const countTooltip = {
  callbacks: {
    label: (ctx: AnyTooltipItem) =>
      `${ctx.label ? `${ctx.label}: ` : ''}${chartValue(ctx).toLocaleString()}`,
  },
}

export function ChartEmpty({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low/40 px-4 text-center text-sm text-on-surface-variant">
      {message}
    </div>
  )
}

export function MemberGrowthChart({ labels, values }: SeriesProps) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: 'Members',
            data: values,
            borderColor: navy,
            backgroundColor: 'rgba(0,31,80,0.12)',
            fill: true,
            tension: 0.35,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false }, tooltip: countTooltip },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      }}
    />
  )
}

export function FamilyBranchChart({ labels, values }: SeriesProps) {
  return (
    <Pie
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [navy, orange, muted, '#e2e3e1', green],
          },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: countTooltip } }}
    />
  )
}

export function ApprovalStatusChart({ labels, values }: SeriesProps) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'Members',
            data: values,
            backgroundColor: [green, orange, '#ba1a1a', navy],
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false }, tooltip: countTooltip },
      }}
    />
  )
}

export function ContributionTrendChart({ labels, values }: SeriesProps) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: 'KES',
            data: values,
            borderColor: orange,
            backgroundColor: 'rgba(254,128,21,0.15)',
            fill: true,
            tension: 0.35,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false }, tooltip: kesTooltip },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      }}
    />
  )
}

export function PaymentMethodChart({ labels, values }: SeriesProps) {
  return (
    <Pie
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [orange, navy, green, muted, '#e2e3e1'],
          },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: kesTooltip } }}
    />
  )
}

export function TopContributorsChart({ labels, values }: SeriesProps) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: 'KES',
            data: values,
            backgroundColor: navy,
            borderRadius: 6,
          },
        ],
      }}
      options={{
        indexAxis: 'y' as const,
        responsive: true,
        plugins: { legend: { display: false }, tooltip: kesTooltip },
        scales: { x: { beginAtZero: true } },
      }}
    />
  )
}

export function IncomeExpenseChart({ labels, income, expense }: {
  labels: string[]
  income: number[]
  expense: number[]
}) {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label: 'Income', data: income, backgroundColor: green },
          { label: 'Expense', data: expense, backgroundColor: orange },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: kesTooltip } }}
    />
  )
}

export function BudgetDoughnutChart({ labels, values }: SeriesProps) {
  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [navy, orange, muted, green, '#e2e3e1'],
          },
        ],
      }}
      options={{ responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: kesTooltip } }}
    />
  )
}
