/**
 * Sends the real new-member welcome email (lib/email/member-setup.ts) to an address, with a fake
 * setup link and a clearly fake password, to check delivery and how it looks.
 *
 *   node --env-file=.env.local --import tsx scripts/send-test-email.ts someone@example.com
 *
 * Prints where it went, or the provider's exact error.
 */
import { sendMemberSetupEmail } from '../lib/email/member-setup'

async function main() {
  const to = process.argv[2]?.trim()
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    console.error('Usage: node --env-file=.env.local --import tsx scripts/send-test-email.ts someone@example.com')
    process.exit(1)
  }
  const site = process.env.NEXT_PUBLIC_APP_URL || 'https://www.alubonets.com'
  const result = await sendMemberSetupEmail({
    userId: 'test-email',
    actorId: 'test-email',
    to,
    fullName: 'Test Member',
    roleLabel: 'Member',
    principalName: null,
    setupUrl: `${site}/account-setup?token=TEST-ONLY-this-link-does-not-work`,
    temporaryPassword: 'TEST-only-not-real',
  })
  if (result.sent) {
    console.log(`Sent to ${result.deliveredTo}${result.redirectedToTestInbox ? ' (TEST MODE: RESEND_TEST_EMAIL redirected it there)' : ''}`)
  } else {
    console.error(`NOT sent: ${result.error}`)
    process.exitCode = 1
  }
  process.exit()
}

void main()
