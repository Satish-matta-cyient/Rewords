import { LegalShell } from './LegalPages';

const SECTIONS = [
  {
    title: '1. What we collect',
    body: 'Account details (name, email, phone), profile information you choose to add, the social post URLs and screenshots you submit, and technical data such as IP address and device characteristics used for fraud prevention.',
  },
  {
    title: '2. Sensitive financial data',
    body: 'Bank account numbers and PAN details are encrypted at rest and are never returned in full by our APIs. Staff interfaces display only masked values, and PAN visibility is restricted to Super Administrators.',
  },
  {
    title: '3. Why we process it',
    body: 'To operate the programme: verifying submissions, calculating and paying points, delivering rewards, preventing fraud, and meeting tax and accounting obligations for cash payouts.',
  },
  {
    title: '4. Fraud prevention',
    body: 'We record signals such as repeated registrations from one IP, shared device fingerprints and duplicate post URLs. These are used solely to detect abuse of the referral programme and are reviewed by a human before any account action is taken.',
  },
  {
    title: '5. Retention',
    body: 'Ledger and audit records are retained for as long as required for financial and legal accountability, even after an account is closed. Account deletion anonymises personal identifiers while preserving the integrity of those financial records.',
  },
  {
    title: '6. Your choices',
    body: 'You can update your profile, adjust notification preferences and opt out of the public leaderboard at any time from Settings. Contact support to request a copy of your data or to close your account.',
  },
  {
    title: '7. Logging',
    body: 'Passwords, authentication tokens, reset links, full bank details and full PAN numbers are never written to application logs.',
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="24 September 2026">
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 style={{ fontSize: 16, marginBottom: 5 }}>{section.title}</h2>
          <p className="small muted" style={{ lineHeight: 1.75 }}>{section.body}</p>
        </section>
      ))}
    </LegalShell>
  );
}
