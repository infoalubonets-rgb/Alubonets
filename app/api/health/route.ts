import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEnvironmentStatus } from '@/lib/env'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const environment = getEnvironmentStatus()
  const requiredEnvironmentReady = Object.values(environment).every(Boolean)
  let database = false

  try {
    await prisma.$queryRaw`SELECT 1`
    database = true
  } catch (error) {
    logError('health.database.failed', error)
  }

  const healthy = requiredEnvironmentReady && database
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        environment: requiredEnvironmentReady,
        database,
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
