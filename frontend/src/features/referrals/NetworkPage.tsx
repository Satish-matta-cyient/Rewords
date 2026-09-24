import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { referralApi } from './api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatCard, Chip,
  EmptyState, Button, PageHeader,
} from '@/components/ui';
import { ReferralShareBox } from './components/ReferralShareBox';
import { ReferralTree } from './components/ReferralTree';
import { formatNumber } from '@/utils/format';
import { icons } from '@/layouts/navigation';

function LevelBreakdown({ levels, onFilter, active }: {
  levels: { level: number; percent: number; members: number; points: number }[];
  onFilter: (level: number | null) => void;
  active: number | null;
}) {
  return (
    <Card>
      <CardHeader
        title="Contribution by level"
        subtitle="How much each tier of your network has earned you"
        action={active !== null ? <Button size="sm" variant="ghost" onClick={() => onFilter(null)}>Clear filter</Button> : undefined}
      />
      <div className="card__body stack" style={{ gap: 8 }}>
        {levels.map((level) => (
          <button
            key={level.level}
            type="button"
            onClick={() => onFilter(active === level.level ? null : level.level)}
            aria-pressed={active === level.level}
            className="row-between"
            style={{
              padding: '11px 13px', width: '100%', textAlign: 'left', cursor: 'pointer',
              background: active === level.level ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${active === level.level ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
            }}
          >
            <div className="row" style={{ gap: 10 }}>
              <Chip tone={active === level.level ? 'primary' : 'neutral'}>Level {level.level}</Chip>
              <span className="small muted">{level.percent}% of each approved post</span>
            </div>
            <div className="row" style={{ gap: 18 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{formatNumber(level.members)}</div>
                <div className="small muted">members</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 74 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--primary)' }}>{formatNumber(level.points)}</div>
                <div className="small muted">points</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function NetworkPage() {
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  const stats = useQuery({ queryKey: queryKeys.referrals.me, queryFn: referralApi.stats });
  const tree = useQuery({ queryKey: queryKeys.referrals.tree, queryFn: () => referralApi.tree() });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <PageHeader title="My Network" subtitle="Your referral tree, level by level" />

      <AsyncBoundary query={stats} skeleton={<div className="grid grid-4">{[0, 1, 2, 3].map((i) => <Card key={i}><CardBody><Skeleton height={70} /></CardBody></Card>)}</div>}>
        {(data) => (
          <>
            <div className="grid grid-4">
              <StatCard label="Direct Referrals" value={data.directReferrals} icon={icons.network} hint="Level 1 members" />
              <StatCard label="Total Network" value={data.totalNetwork} icon={icons.users} hint={`Across ${data.maxDepth} levels`} />
              <StatCard label="Points From Network" value={data.pointsFromNetwork} icon={icons.wallet} hint="Referral and level bonuses" />
              <StatCard label="Link Clicks" value={data.clicks} icon={icons.analytics} hint={`${data.signups} converted to signups`} />
            </div>

            {data.code && data.link ? (
              <Card style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-mint)' }}>
                <CardBody><ReferralShareBox code={data.code} link={data.link} /></CardBody>
              </Card>
            ) : null}

            <div className="grid grid-main">
              <Card>
                <CardHeader
                  title="Referral tree"
                  subtitle={levelFilter ? `Highlighting level ${levelFilter}` : 'Expand a member to see who they brought in'}
                />
                <div className="card__body">
                  <AsyncBoundary query={tree} skeleton={<div className="stack">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={54} />)}</div>}>
                    {(root) => (
                      root.children.length === 0 ? (
                        <EmptyState
                          title="Your network is empty"
                          body="Share your referral link with classmates. When they join, they appear here and start earning you points."
                        />
                      ) : (
                        <ReferralTree root={root} levelFilter={levelFilter} />
                      )
                    )}
                  </AsyncBoundary>
                </div>
              </Card>

              <LevelBreakdown levels={data.levels} onFilter={setLevelFilter} active={levelFilter} />
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
