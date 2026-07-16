'use client'

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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
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
      options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
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
            label: 'Registrations',
            data: values,
            backgroundColor: [green, orange, '#ba1a1a', navy],
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
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
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
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
      options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
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
      options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
    />
  )
}
