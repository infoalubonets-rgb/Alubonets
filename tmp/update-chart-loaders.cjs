const fs = require('fs')
const path = 'lib/data/queries.ts'
let source = fs.readFileSync(path, 'utf8')
for (const [name, key, options] of [
  ['getTreasurerDashboardData', 'treasurer-dashboard', '{ tags: [TAGS.contributions, TAGS.welfare, TAGS.members], revalidate: 60 }'],
  ['getContributionChartSeries', 'contribution-chart', '{ tags: [TAGS.contributions], revalidate: 120 }'],
  ['getContributionAnalytics', 'contribution-analytics', '{ tags: [TAGS.contributions, TAGS.members], revalidate: 120 }'],
]) {
  const start = source.indexOf(`export const ${name} = unstable_cache(`)
  const end = source.indexOf('\n)', source.indexOf(`['${key}']`, start)) + 2
  const chunk = source.slice(start, end)
  const body = chunk.slice(chunk.indexOf('async () => {') + 13, chunk.lastIndexOf('\n  },'))
  source = source.slice(0, start) + `export async function ${name}Fresh() {${body}\n}\n\nexport const ${name} = unstable_cache(\n  ${name}Fresh,\n  ['${key}'],\n  ${options},\n)` + source.slice(end)
}
source = source.replace("formatMonthKey, formatMonthKeys, formatPaymentMethod", "formatMonthKey, formatMonthKeys, formatPaymentMethod, monthKeyFromDate")
source = source.replace("import { prisma }", "import { appDayRange } from '@/lib/dates'\nimport { prisma }")
source = source.replace(/const monthStart = new Date\(\)\s+monthStart.setDate\(1\)\s+monthStart.setHours\(0, 0, 0, 0\)/, "const now = new Date()\n    const monthStart = appDayRange(`${monthKeyFromDate(now)}-01`).start")
source = source.replace('paidAt: { gte: monthStart }', 'paidAt: { gte: monthStart, lte: now }')
source = source.replace('`${row.paidAt.getFullYear()}-${String(row.paidAt.getMonth() + 1).padStart(2, \'0\')}`', 'monthKeyFromDate(row.paidAt)')
fs.writeFileSync(path, source)
const component = 'components/finance/ContributionRecordsSection.tsx'
let content = fs.readFileSync(component, 'utf8')
for (const name of ['getTreasurerDashboardData', 'getContributionChartSeries', 'getContributionAnalytics']) {
  content = content.replaceAll(name, name + 'Fresh')
}
fs.writeFileSync(component, content)
