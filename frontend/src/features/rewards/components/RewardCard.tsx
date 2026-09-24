import { Link } from 'react-router-dom';
import { Card, Chip } from '@/components/ui';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { RewardItem } from '../api';

const BADGE_LABEL: Record<string, string> = { POPULAR: 'Popular', BEST_VALUE: 'Best Value', NEW: 'New' };

export function RewardCard({ reward, onRedeem }: { reward: RewardItem; onRedeem?: (reward: RewardItem) => void }) {
  return (
    <Card interactive style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Link to={`/rewards/${reward.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ height: 140, background: 'var(--accent-soft)', position: 'relative', display: 'grid', placeItems: 'center' }}>
          {reward.imageUrl
            ? <img src={reward.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.3" opacity="0.5"><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>}
          {reward.badge ? (
            <div style={{ position: 'absolute', top: 10, left: 10 }}>
              <Chip tone={reward.badge === 'BEST_VALUE' ? 'warning' : reward.badge === 'NEW' ? 'info' : 'success'}>
                {BADGE_LABEL[reward.badge] ?? reward.badge}
              </Chip>
            </div>
          ) : null}
          {!reward.inStock ? (
            <div style={{ position: 'absolute', inset: 0, background: 'rgb(15 23 42 / 55%)', display: 'grid', placeItems: 'center' }}>
              <Chip tone="danger">Out of stock</Chip>
            </div>
          ) : null}
        </div>
      </Link>

      <div className="card__body stack" style={{ gap: 8, flex: 1 }}>
        <div>
          <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>{reward.categoryName}</div>
          <Link to={`/rewards/${reward.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 3 }}>{reward.title}</div>
          </Link>
        </div>

        <div className="row-between" style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 16 }}>{formatNumber(reward.pointsCost)} Pts</div>
            <div className="small" style={{ color: reward.affordable ? 'var(--success)' : 'var(--muted)' }}>
              {reward.affordable ? '✓ Balance sufficient' : `${formatCurrency(reward.cashValue)} value`}
            </div>
          </div>
          {onRedeem ? (
            <button
              type="button"
              className={`btn btn--${reward.affordable && reward.inStock ? 'subtle' : 'secondary'} btn--sm`}
              disabled={!reward.affordable || !reward.inStock}
              onClick={() => onRedeem(reward)}
            >
              Redeem
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
