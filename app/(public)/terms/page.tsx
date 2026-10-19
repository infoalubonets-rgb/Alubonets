import Link from 'next/link'
import { POLICY_LAST_UPDATED } from '@/lib/membership'
import { CONTACT_EMAIL } from '@/lib/constants'

export const metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-slate max-w-none">
        <h1>Terms of Service</h1>
        <p><strong>Last updated:</strong> {POLICY_LAST_UPDATED}</p>
        <p>
          These terms govern your use of www.alubonets.com and the Alubonets member portal (the “Service”), run by
          Alubonets Self-Help Group (“Alubonets”, “we”, “us”) of Butere, Kakamega County, Kenya. By creating an account
          or using the Service, you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you
          do not agree, please do not use the Service.
        </p>

        <h2>1. Membership and eligibility</h2>
        <ul>
          <li>You must be at least 18 years old to apply for membership and hold an account. Records of children may be added only by a parent or guardian who is a member.</li>
          <li>You must give complete, accurate, and current information, and keep it up to date.</li>
          <li>Submitting an application does not make you a member. Membership and portal access begin only after an administrator approves your application.</li>
          <li>Membership is also governed by the group’s constitution, by-laws, and resolutions. If they conflict with these terms, the group’s constitution and by-laws prevail.</li>
        </ul>

        <h2>2. Your account</h2>
        <ul>
          <li>You may sign in with an email and password or with your Google account.</li>
          <li>Keep your password and verification codes private. Do not share your account with anyone.</li>
          <li>You are responsible for activity on your account. Tell us right away if you suspect unauthorised access.</li>
          <li>We may ask you to verify your identity or email address before granting access.</li>
        </ul>

        <h2>3. Contributions, loans, and welfare</h2>
        <ul>
          <li>Contributions, loans, welfare support, and penalties follow the amounts, schedules, and rules set by the group.</li>
          <li>Payments made through M-Pesa or other channels are recorded against your account. Keep your payment references in case a record needs to be checked.</li>
          <li>Records in the portal are kept for transparency, but the group’s approved financial records are final. If you believe a record is wrong, contact the treasurer or an administrator.</li>
          <li>Loan and welfare requests are subject to approval under the group’s rules and are not guaranteed.</li>
        </ul>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Give false information or pretend to be someone else.</li>
          <li>Access another member’s account or data, or try to get around security controls.</li>
          <li>Copy, share, or misuse other members’ personal information.</li>
          <li>Upload content that is unlawful, offensive, defamatory, or infringes someone else’s rights.</li>
          <li>Disrupt or overload the Service, or upload viruses or harmful code.</li>
          <li>Use the Service for fraud, harassment, or any unlawful purpose.</li>
        </ul>

        <h2>5. Content you share</h2>
        <p>
          You keep ownership of photos, messages, and other content you upload. You give Alubonets permission to store,
          display, and share that content within the Service for group purposes, such as showing event photos in the
          gallery. You must have the right to share anything you upload, including permission from people who appear in
          your photos. We may remove content that breaks these terms.
        </p>

        <h2>6. Communications</h2>
        <p>
          By creating an account, you agree to receive emails needed to run your membership, such as verification codes,
          password resets, approvals, receipts, meeting notices, and group announcements.
        </p>

        <h2>7. Suspension and termination</h2>
        <p>
          We may suspend or close an account that breaks these terms or the group’s rules, or to protect members and the
          Service. You may ask to close your account at any time. Ending your membership is handled under the group’s
          constitution. Some records may be kept after an account is closed, as described in the Privacy Policy.
        </p>

        <h2>8. Availability and changes to the Service</h2>
        <p>
          We work to keep the Service running, but it may sometimes be unavailable because of maintenance, outages, or
          events outside our control. We may add, change, or remove features at any time.
        </p>

        <h2>9. Disclaimer and limitation of liability</h2>
        <p>
          The Service is provided “as is” and “as available”. To the extent the law allows, Alubonets is not liable for
          indirect or consequential losses, or for losses caused by service interruptions, by third-party services such
          as payment or email providers, or by unauthorised use of your account that results from you not keeping your
          sign-in details safe. Nothing in these terms limits rights that cannot be limited under Kenyan law.
        </p>

        <h2>10. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. We will post the new version on this page with a new “Last
          updated” date and tell members about important changes. If you keep using the Service after changes take
          effect, you accept the updated terms.
        </p>

        <h2>11. Governing law</h2>
        <p>
          These terms are governed by the laws of Kenya. We will first try to settle any dispute through the group’s
          internal procedures. If that fails, the dispute will go to the courts of Kenya.
        </p>

        <h2>12. Contact us</h2>
        <p>
          Alubonets Self-Help Group, Butere, Kakamega County, Kenya.
          <br />
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <br />
          Or use our <Link href="/contact">contact page</Link>.
        </p>
      </article>
    </main>
  )
}
