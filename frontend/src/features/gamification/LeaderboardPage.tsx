import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, PageHeader, Tabs, Avatar, Chip, Skeleton,
  EmptyState, ProgressBar,
} from '@/components/ui';
import { formatNumber } from '@/utils/format';

interface LeaderboardEntry { rank: number; userId: string; name: string; avatarUrl: string | null; tier: string | null; value: number; isYou: boolean }
interface LeaderboardResponse { period: string; scope: string; entries: LeaderboardEntry[]; you: LeaderboardEntry | null }
interface GamificationProfile {
  tier: { key: string; name: string } | null;
  nextTier: { key: string; name: string; minPoints: number } | null;
  progressPercent: number; pointsToNextTier: number;
  badges: { id: string; key: string; name: string; description: string; earnedAt: string }[];
  allBadges: { id: string; key: string; name: string; description: string }[];
  streak: { currentDays: number; longestDays: number };
  stats: { lifetimeEarned: number; directReferrals: number };
}

const SCOPES = [
  { key: 'POINTS', label: 'Points earned', unit: 'pts' },
  { key: 'NETWORK', label: 'Network growth', unit: 'referrals' },
  { key: 'APPROVED_POSTS', label: 'Approved posts', unit: 'posts' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [scope, setScope] = useState('POINTS');
  const unit = SCOPES.find((s) => s.key === scope)?.unit ?? '';

  const board = useQuery({
    queryKey: queryKeys.gamification.leaderboard(scope),
    queryFn: () => api.get<LeaderboardResponse>('/gamification/leaderboard', { query: { scope } }),
  });
  const profile = useQuery({
    queryKey: queryKeys.gamification.profile,
    queryFn: () => api.get<GamificationProfile>('/gamification/profile'),
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Leaderboard" subtitle="How you compare this month. Opt out any time from Settings." />

      <div className="grid grid-main">
        <div className="stack">
          <Tabs active={scope} onChange={setScope} tabs={SCOPES.map((s) => ({ key: s.key, label: s.label }))} />

          <Card>
            <CardBody className="stack" style={{ gap: 4 }}>
              {board.isPending ? <Skeleton height={300} /> : null}
              {board.data?.entries.length === 0 ? (
                <EmptyState title="No rankings yet" body="Rankings appear once there is activity for this month." />
              ) : null}
              {board.data?.entries.map((entry) => (
                <div
                  key={entry.userId}
                  className="row"
                  style={{
                    gap: 12, padding: '11px 13px', borderRadius: 'var(--radius)',
                    background: entry.isYou ? 'var(--accent-soft)' : 'transparent',
                    border: entry.isYou ? '1px solid var(--primary)' : '1px solid transparent',
                  }}
                >
                  <span style={{ width: 30, textAlign: 'center', fontWeight: 700, fontSize: entry.rank <= 3 ? 19 : 14, color: 'var(--muted)' }}>
                    {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
                  </span>
                  <Avatar name={entry.name} src={entry.avatarUrl} size={34} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 7 }}>
                      <span className="truncate" style={{ fontWeight: entry.isYou ? 700 : 500, fontSize: 'var(--text-sm)' }}>{entry.name}</span>
                      {entry.isYou ? <Chip tone="primary">You</Chip> : null}
                      {entry.tier ? <Chip tone="neutral">{entry.tier}</Chip> : null}
                    </div>
                  </div>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {formatNumber(entry.value)} <span className="small muted" style={{ fontWeight: 400 }}>{unit}</span>
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="stack">
          {profile.data ? (
            <>
              <Card>
                <CardHeader title="Your tier" />
                <CardBody className="stack" style={{ gap: 10 }}>
                  <div className="row-between">
                    <span style={{ fontWeight: 700, fontSize: 19 }}>{profile.data.tier?.name ?? 'Bronze'}</span>
                    {profile.data.nextTier ? <Chip tone="primary">Next: {profile.data.nextTier.name}</Chip> : <Chip tone="success">Top tier</Chip>}
                  </div>
                  <ProgressBar value={profile.data.progressPercent} />
                  {profile.data.nextTier ? (
                    <div className="small muted">
                      {formatNumber(profile.data.pointsToNextTier)} more lifetime points to reach {profile.data.nextTier.name}.
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Streak" />
                <CardBody className="row-between">
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 700 }}>{profile.data.streak.currentDays}</div>
                    <div className="small muted">day streak</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{profile.data.streak.longestDays}</div>
                    <div className="small muted">personal best</div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Badges" subtitle={`${profile.data.badges.length} of ${profile.data.allBadges.length} earned`} />
                <CardBody className="stack" style={{ gap: 9 }}>
                  {profile.data.allBadges.map((badge) => {
                    const earned = profile.data.badges.some((b) => b.key === badge.key);
                    return (
                      <div key={badge.id} className="row" style={{ gap: 11, opacity: earned ? 1 : 0.45 }}>
                        <span style={{
                          width: 34, height: 34, borderRadius: 'var(--radius)', flexShrink: 0,
                          background: earned ? 'var(--accent-mint)' : 'var(--background)',
                          color: earned ? 'var(--primary)' : 'var(--muted)',
                          display: 'grid', placeItems: 'center',
                        }} aria-hidden>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <circle cx="12" cy="9" r="6" /><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7" />
                          </svg>
                        </span>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{badge.name}</div>
                          <div className="small muted">{badge.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            </>
          ) : <Skeleton height={340} />}
        </div>
      </div>
    </div>
  );
}
