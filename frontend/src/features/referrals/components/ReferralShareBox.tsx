import { useState } from 'react';
import { Button, IconButton } from '@/components/ui';
import { copyToClipboard, nativeShare, SHARE_TARGETS } from '@/utils/share';

const SHARE_TEXT = 'I am an EduRewards campus ambassador — join through my link and start earning rewards too.';

export function ReferralCodeDisplay({ code }: { code: string }) {
  return (
    <div className="row" style={{
      gap: 8, padding: '8px 12px', background: 'var(--card)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    }}>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--primary)' }}>{code}</span>
      <IconButton label="Copy referral code" onClick={() => copyToClipboard(code, 'Referral code copied')} style={{ width: 32, height: 32 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      </IconButton>
    </div>
  );
}

function ShareMenu({ link, onClose }: { link: string; onClose: () => void }) {
  return (
    <div className="menu" role="menu" style={{ minWidth: 190 }}>
      {SHARE_TARGETS.map((target) => (
        <a
          key={target.key}
          className="menu__item"
          role="menuitem"
          href={target.build(link, SHARE_TEXT)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          {target.label}
        </a>
      ))}
    </div>
  );
}

export function ReferralShareBox({ code, link, bonus }: { code: string; link: string; bonus?: number }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleShare = async () => {
    const shared = await nativeShare(link, SHARE_TEXT);
    if (!shared) setMenuOpen((v) => !v);
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row-between wrap" style={{ gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 19 }}>Invite Students. Earn Points.</h2>
          <p className="muted small" style={{ marginTop: 4, maxWidth: 420 }}>
            Share your referral link and earn {bonus ? bonus.toLocaleString() : '1,000'} points when a student joins and activates their account.
          </p>
        </div>
        <div>
          <div className="small muted" style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: 11, marginBottom: 4 }}>Your code</div>
          <ReferralCodeDisplay code={code} />
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        <input
          className="input grow"
          readOnly
          value={link}
          aria-label="Your referral link"
          onFocus={(e) => e.currentTarget.select()}
          style={{ minWidth: 200 }}
        />
        <Button onClick={() => copyToClipboard(link, 'Referral link copied')}>Copy Link</Button>
        <div style={{ position: 'relative' }}>
          <Button variant="secondary" onClick={handleShare} aria-expanded={menuOpen} aria-haspopup="menu">Share</Button>
          {menuOpen ? <ShareMenu link={link} onClose={() => setMenuOpen(false)} /> : null}
        </div>
      </div>
    </div>
  );
}
