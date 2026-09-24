import { Link } from 'react-router-dom';
import { Card, CardHeader, Chip } from '@/components/ui';
import { formatCurrency, formatCompact } from '@/utils/format';

export interface RewardPreviewItem {
  id: string; title: string; pointsCost: number; cashValue: number;
  imageUrl: string | null; category: string; affordable: boolean;
}

const CATEGORY_TONE: Record<string, string> = {
  SHOPPING: 'var(--warning-soft)', FOOD: 'var(--destructive-soft)',
  ENTERTAINMENT: 'var(--info-soft)', TRAVEL: 'var(--accent-mint)',
  EDUCATION: 'var(--accent-soft)', CASH: 'var(--success-soft)',
};

export function RewardsPreview({ rewards }: { rewards: RewardPreviewItem[] }) {
  return (
    <Card>
      <CardHeader title="Redeem Your Points" action={<Link to="/rewards" className="small">View all</Link>} />
      <div className="card__body stack" style={{ gap: 10, paddingTop: 6 }}>
        {rewards.map((reward) => (
          <Link
            key={reward.id}
            to={`/rewards/${reward.id}`}
            className="row"
            style={{
              gap: 12, padding: 12, borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{
              width: 38, height: 38, borderRadius: 'var(--radius)', flexShrink: 0,
              background: CATEGORY_TONE[reward.category] ?? 'var(--accent-soft)',
              display: 'grid', placeItems: 'center', overflow: 'hidden',
            }} aria-hidden>
              {reward.imageUrl
                ? <img src={reward.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8"><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>}
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{reward.title}</div>
              <div className="small muted">{formatCurrency(reward.cashValue)} value</div>
            </div>
            <Chip tone={reward.affordable ? 'primary' : 'neutral'}>{formatCompact(reward.pointsCost)} pts</Chip>
          </Link>
        ))}
      </div>
    </Card>
  );
}
