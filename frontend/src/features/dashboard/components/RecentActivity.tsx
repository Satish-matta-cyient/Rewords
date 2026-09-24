import { Card, CardHeader, PointsBadge, EmptyState } from '@/components/ui';
import { formatRelative, titleCase } from '@/utils/format';
import { Link } from 'react-router-dom';

export interface ActivityItemData {
  id: string; title: string; detail: string; points?: number; createdAt: string; type: string;
}

function ActivityItem({ item }: { item: ActivityItemData }) {
  return (
    <div className="row" style={{ padding: '11px 0', borderBottom: '1px solid var(--border)', gap: 12 }}>
      <span style={{
        width: 32, height: 32, borderRadius: 'var(--radius)', flexShrink: 0,
        background: (item.points ?? 0) >= 0 ? 'var(--success-soft)' : 'var(--destructive-soft)',
        color: (item.points ?? 0) >= 0 ? 'var(--success)' : 'var(--destructive)',
        display: 'grid', placeItems: 'center',
      }} aria-hidden>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          {(item.points ?? 0) >= 0 ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
        </svg>
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{item.title}</div>
        <div className="small muted">{titleCase(item.type)} · {formatRelative(item.createdAt)}</div>
      </div>
      {item.points !== undefined ? <PointsBadge points={item.points} /> : null}
    </div>
  );
}

export function RecentActivity({ items }: { items: ActivityItemData[] }) {
  return (
    <Card>
      <CardHeader title="Recent Activity" action={<Link to="/wallet" className="small">View ledger</Link>} />
      <div className="card__body" style={{ paddingTop: 4 }}>
        {items.length === 0 ? (
          <EmptyState title="No activity yet" body="Submit your first campaign post or invite a classmate to get started." />
        ) : (
          <div>{items.map((item) => <ActivityItem key={item.id} item={item} />)}</div>
        )}
      </div>
    </Card>
  );
}
