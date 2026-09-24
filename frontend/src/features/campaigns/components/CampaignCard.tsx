import { Link } from 'react-router-dom';
import { Card, StatusChip, Chip, ProgressBar } from '@/components/ui';
import { formatNumber, formatDate } from '@/utils/format';
import type { CampaignListItem } from '../api';

export function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const budgetPercent = campaign.budgetPoints ? (campaign.budgetSpentPoints / campaign.budgetPoints) * 100 : 0;
  const atLimit = campaign.mySubmissionCount >= campaign.perUserLimit;
  const closed = campaign.budgetExhausted || campaign.status !== 'ACTIVE';

  return (
    <Card interactive style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Link to={`/campaigns/${campaign.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{
          height: 132, background: 'var(--accent-soft)', position: 'relative',
          display: 'grid', placeItems: 'center', overflow: 'hidden',
        }}>
          {campaign.coverImageUrl
            ? <img src={campaign.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            : <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.3" opacity="0.5"><path d="M3 11v3a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8" /></svg>}
          <div style={{ position: 'absolute', top: 10, left: 10 }}><StatusChip status={campaign.status} /></div>
          {campaign.budgetExhausted ? <div style={{ position: 'absolute', top: 10, right: 10 }}><Chip tone="danger">Budget used</Chip></div> : null}
        </div>

        <div className="card__body stack" style={{ gap: 9, flex: 1 }}>
          <div>
            <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>{campaign.category}</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 3 }}>{campaign.name}</div>
          </div>

          <p className="small muted" style={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{campaign.description}</p>

          <div className="row wrap" style={{ gap: 6 }}>
            {campaign.platforms.slice(0, 3).map((p) => <Chip key={p} tone="neutral">{p}</Chip>)}
            {campaign.platforms.length > 3 ? <Chip tone="neutral">+{campaign.platforms.length - 3}</Chip> : null}
          </div>

          {campaign.budgetPoints ? (
            <div>
              <div className="row-between small muted" style={{ marginBottom: 4 }}>
                <span>Budget used</span><span>{Math.round(budgetPercent)}%</span>
              </div>
              <ProgressBar value={budgetPercent} tone={budgetPercent > 90 ? 'danger' : budgetPercent > 70 ? 'warning' : undefined} />
            </div>
          ) : null}

          <div className="row-between" style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 16 }}>{formatNumber(campaign.creditValue)}</div>
              <div className="small muted">points per post</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small" style={{ fontWeight: 600 }}>
                {closed ? 'Closed' : campaign.daysRemaining <= 7 ? `${campaign.daysRemaining}d left` : formatDate(campaign.endDate)}
              </div>
              <div className="small muted">
                {atLimit ? 'Limit reached' : `${campaign.mySubmissionCount}/${campaign.perUserLimit} submitted`}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
