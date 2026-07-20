'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Props = {
  userId: string
  initialTotal: number
  initialWelfareCount: number
}

export default function MemberStatsRealtime({ userId, initialTotal, initialWelfareCount }: Props) {
  const [total, setTotal] = useState(initialTotal)
  const [welfareCount, setWelfareCount] = useState(initialWelfareCount)

  useEffect(() => {
    setTotal(initialTotal)
    setWelfareCount(initialWelfareCount)
  }, [initialTotal, initialWelfareCount])

  useEffect(() => {
    const supabase = createClient()

    const refetchContributions = async () => {
      const { data } = await supabase
        .from('contributions')
        .select('amount')
        .eq('userId', userId)
      if (data) setTotal(data.reduce((s, c) => s + (c.amount ?? 0), 0))
    }

    const refetchWelfare = async () => {
      const { data } = await supabase
        .from('welfare_requests')
        .select('id')
        .eq('userId', userId)
      if (data) setWelfareCount(data.length)
    }

    const contributionsChannel = supabase
      .channel('member-contributions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, refetchContributions)
      .subscribe()

    const welfareChannel = supabase
      .channel('member-welfare')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'welfare_requests' }, refetchWelfare)
      .subscribe()

    return () => {
      void supabase.removeChannel(contributionsChannel)
      void supabase.removeChannel(welfareChannel)
    }
  }, [userId])

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-surface p-4">
        <p className="text-xs text-on-surface-variant uppercase">My contributions</p>
        <p className="text-2xl font-semibold mt-1">KES {Math.round(total).toLocaleString()}</p>
      </div>
      <div className="rounded-xl border bg-surface p-4">
        <p className="text-xs text-on-surface-variant uppercase">Welfare requests</p>
        <p className="text-2xl font-semibold mt-1">{welfareCount}</p>
      </div>
    </div>
  )
}
