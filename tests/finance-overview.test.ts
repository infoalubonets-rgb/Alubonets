import { describe, it, expect } from 'vitest'
import { summariseFinance } from '../lib/finance-overview'
import { noticeAudienceWhere, enabledRequestNoticesWhere } from '../lib/notification-audience'

describe('financial overview', () => {
  it('counts posted money only and separates loan and welfare movements', () => {
    const row = (type: string, amount: number, categoryId: string | null = null, status = 'CONFIRMED') => ({ type, amount, categoryId, status })
    expect(summariseFinance([row('CONTRIBUTION', 1000), row('CONTRIBUTION', 200, 'cat-loan-repayment'), row('DISBURSEMENT', 500, 'cat-loan-disbursement'), row('DISBURSEMENT', 100, 'cat-welfare-disbursement'), row('EXPENSE', 50), row('CONTRIBUTION', 9000, null, 'PENDING'), row('CONTRIBUTION', 8000, null, 'REVERSED')])).toEqual({ income: 1200, outgoing: 650, net: 550, loanDisbursed: 500, loanRepaid: 200, welfarePaid: 100 })
  })
  it('excludes request notifications from other workspaces and disabled modules', () => {
    expect(JSON.stringify(noticeAudienceWhere('ADMIN'))).toContain('finance_request')
    expect(JSON.stringify(enabledRequestNoticesWhere({ loans_enabled: false, welfare_enabled: true }))).toContain('LoanApplication')
    expect(enabledRequestNoticesWhere({ loans_enabled: true, welfare_enabled: true })).toEqual({})
  })
})
