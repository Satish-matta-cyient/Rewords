import { LegalShell } from './LegalPages';

const SECTIONS = [
  {
    title: '1. About the programme',
    body: 'EduRewards is an ambassador referral programme. Ambassadors promote approved campaigns on their own social media accounts, submit the resulting posts for verification, and receive points when those posts are approved.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be able to form a binding contract in your jurisdiction and must hold the social media accounts you post from. One account per person. Creating multiple accounts to inflate referral earnings is grounds for suspension and forfeiture of points.',
  },
  {
    title: '3. Points',
    body: 'Points have no cash value except through the redemption mechanisms offered inside the platform, at the conversion rate published at the time of redemption. Points are recorded in an append-only ledger; corrections are made through reversal or adjustment entries and are always visible to you in your wallet.',
  },
  {
    title: '4. Verification and reversal',
    body: 'Every submission is reviewed before points are awarded. Approved posts must remain publicly visible for the period stated on the campaign. Posts that are removed may have their points reversed, including any referral bonuses that the post generated for other ambassadors.',
  },
  {
    title: '5. Referrals',
    body: 'Referral relationships are permanent once established and cannot be transferred or reassigned. Self-referral and circular referral arrangements are blocked automatically and treated as fraud. If an account is suspended its referral tree is preserved, but earnings are paused.',
  },
  {
    title: '6. Redemptions and payouts',
    body: 'Redemption requests lock the relevant points immediately. If a request is declined the points are returned in full. Cash payouts require verified KYC details and may be subject to statutory deductions.',
  },
  {
    title: '7. Fraud and account actions',
    body: 'We operate automated fraud detection covering duplicate identities, shared devices, duplicated post URLs and abnormal referral velocity. Where fraud is confirmed we may reverse points, suspend the account and withhold pending redemptions.',
  },
  {
    title: '8. Changes',
    body: 'We may change campaign economics, conversion rates and limits. Changes apply to future transactions only — historical ledger entries are never rewritten.',
  },
];

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="24 September 2026">
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 style={{ fontSize: 16, marginBottom: 5 }}>{section.title}</h2>
          <p className="small muted" style={{ lineHeight: 1.75 }}>{section.body}</p>
        </section>
      ))}
    </LegalShell>
  );
}
