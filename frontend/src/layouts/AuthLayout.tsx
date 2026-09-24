import { Outlet, Link } from 'react-router-dom';
import './layout.css';

const HIGHLIGHTS = [
  {
    title: 'Multi-level referral rewards',
    body: 'Earn on your direct referrals and up to four levels of your network, paid automatically when posts are approved.',
    icon: <path d="M12 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM12 9v3M6.5 15 12 12l5.5 3" />,
  },
  {
    title: 'A ledger you can audit',
    body: 'Every point movement is an append-only ledger entry, so your balance is always explainable.',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    title: 'Real rewards, instantly',
    body: 'Redeem for vouchers delivered the moment approval lands, or request a direct cash payout.',
    icon: <path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" />,
  },
];

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-panel">
        <div>
          <Link to="/" className="row" style={{ gap: 10, textDecoration: 'none' }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgb(255 255 255 / 15%)', display: 'grid', placeItems: 'center' }} aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M6 17c0-5.5 4-10 11-10-1.5 6.5-5.5 9.5-11 10z" /></svg>
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>EduRewards</span>
          </Link>

          <h1 style={{ color: '#fff', fontSize: 34, marginTop: 52, maxWidth: 420, lineHeight: 1.22 }}>
            Invite students. Earn points. Redeem real rewards.
          </h1>
          <p style={{ color: 'rgb(255 255 255 / 76%)', marginTop: 14, maxWidth: 420, fontSize: 15 }}>
            The ambassador platform for campus referral programmes — transparent points, verified posts and instant voucher delivery.
          </p>

          <div className="auth-panel__points">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="auth-panel__point">
                <span className="auth-panel__icon" aria-hidden>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                </span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                  <div style={{ color: 'rgb(255 255 255 / 66%)', fontSize: 13, marginTop: 2, maxWidth: 380 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: 'rgb(255 255 255 / 50%)', fontSize: 12 }}>
          <Link to="/terms" style={{ color: 'rgb(255 255 255 / 72%)' }}>Terms</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'rgb(255 255 255 / 72%)' }}>Privacy</Link>
        </div>
      </aside>

      <main className="auth-form-wrap">
        <div className="auth-form">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
