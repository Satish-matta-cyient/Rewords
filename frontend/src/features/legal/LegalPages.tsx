import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Button, Card, CardBody } from '@/components/ui';

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }} className="stack">
        <Link to="/" className="row" style={{ gap: 9, textDecoration: 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', display: 'grid', placeItems: 'center' }} aria-hidden>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M6 17c0-5.5 4-10 11-10-1.5 6.5-5.5 9.5-11 10z" /></svg>
          </span>
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 17 }}>EduRewards</span>
        </Link>

        <Card>
          <CardBody className="stack" style={{ gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 26 }}>{title}</h1>
              <p className="small muted" style={{ marginTop: 4 }}>Last updated {updated}</p>
            </div>
            {children}
          </CardBody>
        </Card>

        <Link to="/login" className="small" style={{ textAlign: 'center' }}>Back to sign in</Link>
      </div>
    </div>
  );
}

export function StatusPage({ code, title, body, action }: { code: string; title: string; body: string; action: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--background)' }}>
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <CardBody className="stack" style={{ gap: 12, textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 46, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.04em' }}>{code}</div>
          <h1 style={{ fontSize: 21 }}>{title}</h1>
          <p className="muted small" style={{ lineHeight: 1.65 }}>{body}</p>
          <div style={{ marginTop: 6 }}>{action}</div>
        </CardBody>
      </Card>
    </div>
  );
}
