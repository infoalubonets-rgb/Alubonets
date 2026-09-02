import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'branch_lineages' } })
  const saved: string[] = setting ? JSON.parse(setting.value) : []
  return NextResponse.json({ branches: Array.from(new Set(['Default', ...saved])) })
}
