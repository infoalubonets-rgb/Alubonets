import Link from 'next/link'
import { POLICY_LAST_UPDATED } from '@/lib/membership'
import { CONTACT_EMAIL } from '@/lib/constants'

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article className="prose prose-slate max-w-none">
        <h1>Privacy Policy</h1>
        <p><strong>Last updated:</strong> {POLICY_LAST_UPDATED}</p>
        <p>
          This policy explains how Alubonets Self-Help Group (“Alubonets”, “we”, “us”), based in Butere, Kakamega
          County, Kenya, collects, uses, shares, and protects personal information when you use www.alubonets.com and
          the Alubonets member portal (the “Service”). We handle personal data in line with the Kenya Data Protection
          Act, 2019.
        </p>

        <h2>1. Information we collect</h2>
        <p><strong>Information you give us</strong> when you apply for membership, complete your profile, or use the portal:</p>
        <ul>
          <li>Identity and contact details: full name, date of birth, gender, phone number, email address, and residential area.</li>
          <li>Family details: spouse, children, and other dependants you add to your family branch, including records of minors added by a parent or guardian.</li>
          <li>Next-of-kin and emergency-contact details.</li>
          <li>Education, profession, skills, interests, and mentorship preferences you choose to share.</li>
          <li>Membership records: application answers, approval status, roles, and meeting and event participation.</li>
          <li>Financial records: contributions, payment references (such as M-Pesa transaction codes), loans, welfare requests, and receipts.</li>
          <li>Photos and content you upload, such as profile pictures and gallery images, and messages you send through the contact form or support chat.</li>
        </ul>
        <p><strong>Information collected automatically</strong> to keep the Service secure and working:</p>
        <ul>
          <li>Sign-in and security records: login times, one-time verification codes, IP address, browser type, and audit logs of administrative actions.</li>
          <li>Technical error reports that help us find and fix problems.</li>
          <li>Essential cookies that keep you signed in and protect your session. We do not use advertising or tracking cookies.</li>
        </ul>

        <h2>2. Signing in with Google</h2>
        <p>
          If you choose “Continue with Google”, Google shares your name, email address, and profile picture with us. We
          use this information only to create and sign in to your Alubonets account and to show your name and picture in
          the portal. We do not access your Gmail, contacts, calendar, files, or any other Google data.
        </p>
        <p>
          We do not sell, rent, or transfer Google user data to anyone, and we do not use it for advertising. Our use of
          information received from Google APIs complies with the{' '}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>,
          including its Limited Use requirements. You can remove Alubonets’ access at any time from your{' '}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account permissions</a>.
        </p>

        <h2>3. How we use information</h2>
        <ul>
          <li>To review membership applications and manage your membership.</li>
          <li>To record contributions, loans, and welfare support, and to issue receipts and statements.</li>
          <li>To send you account emails such as verification codes, password resets, approvals, receipts, announcements, and event updates.</li>
          <li>To run meetings, elections, projects, and other group activities.</li>
          <li>To protect accounts, prevent fraud and misuse, and investigate errors.</li>
          <li>To keep the governance and financial records the group is required to keep, and to meet legal obligations.</li>
        </ul>
        <p>
          We process your information because it is needed to provide your membership, because you have given consent
          (for example, when you submit an application or sign in with Google), because the group has a legitimate
          interest in running and securing its activities, or because the law requires it.
        </p>

        <h2>4. Who can see your information</h2>
        <ul>
          <li><strong>You</strong> can see and update your own profile.</li>
          <li><strong>Administrators</strong> can see complete applications and profiles to manage membership.</li>
          <li><strong>Executive officials</strong>, such as the treasurer or secretary, see only what they need for their role. Sensitive details like date of birth, address, next-of-kin, and emergency contacts are restricted.</li>
          <li><strong>Other members</strong> may see limited directory information, such as your name and photo, where the portal shows it.</li>
          <li><strong>The public</strong> sees only content the group chooses to publish, such as gallery photos, events, and projects.</li>
        </ul>

        <h2>5. Service providers</h2>
        <p>We use trusted providers that process data only on our instructions to run the Service:</p>
        <ul>
          <li><strong>Supabase</strong>: database, sign-in, and file storage.</li>
          <li><strong>Vercel</strong>: website hosting.</li>
          <li><strong>Resend</strong>: sending emails.</li>
          <li><strong>Google</strong>: optional sign-in with your Google account.</li>
          <li><strong>Safaricom (M-Pesa)</strong>: processing mobile-money contributions, where used.</li>
          <li><strong>Sentry</strong>: error monitoring, set up to exclude passwords and financial details.</li>
        </ul>
        <p>
          Some of these providers store data on servers outside Kenya. Where that happens, we rely on providers that
          apply appropriate security safeguards. We do not sell personal information, and we share it with authorities
          only when the law requires us to.
        </p>

        <h2>6. How we protect information</h2>
        <p>
          We use encrypted connections (HTTPS), role-based access controls, email verification codes, private storage
          for profile images, audit logs of administrative actions, and regular backups. No online service can be
          completely secure, so please keep your password private and tell us right away if you suspect misuse of your
          account.
        </p>

        <h2>7. How long we keep information</h2>
        <p>
          We keep personal information for as long as you are a member and afterwards only as long as needed for the
          purposes above. Financial, contribution, and governance records may be kept longer where the group’s rules or
          the law require it. Security logs are deleted on a regular schedule. When information is no longer needed, we
          delete or anonymise it.
        </p>

        <h2>8. Children</h2>
        <p>
          The Service is meant for adult members. Information about children is added only by a parent or guardian who
          is a member, for family and welfare purposes. It is visible only to that member and to administrators.
        </p>

        <h2>9. Your rights</h2>
        <p>Under the Kenya Data Protection Act, 2019, you have the right to:</p>
        <ul>
          <li>Be told how your personal data is used.</li>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Ask us to delete your data or your account.</li>
          <li>Object to or restrict certain uses of your data.</li>
          <li>Withdraw consent you have given, without affecting earlier processing.</li>
        </ul>
        <p>
          You can update most profile details yourself in the portal. For anything else, including deleting your
          account, contact us using the details below. We will respond within a reasonable time. Some financial and
          governance records cannot be deleted while the group must keep them, but we will tell you if that applies. If
          you are unhappy with how we handle your data, you may complain to the Office of the Data Protection
          Commissioner (<a href="https://www.odpc.go.ke" target="_blank" rel="noreferrer">www.odpc.go.ke</a>).
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          We may update this policy when the Service or the law changes. We will post the new version on this page with
          a new “Last updated” date and tell members about important changes by email or in the portal.
        </p>

        <h2>11. Contact us</h2>
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
