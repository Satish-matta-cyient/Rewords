import { useQuery } from '@tanstack/react-query';
import { referralApi } from '@/features/referrals/api';
import { walletApi } from '@/features/wallet/api';
import { dashboardApi } from '@/features/dashboard/api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, ChartCard, TrendChart, ColumnChart, DonutChart,
  AsyncBoundary, Skeleton, StatCard, PageHeader, Chip,
} from '@/components/ui';
import { formatNumber, formatCurrency } from '@/utils/format';
import { icons } from '@/layouts/navigation';

export default function AnalyticsPage() {
  const analytics = useQuery({ queryKey: queryKeys.referrals.analytics, queryFn: referralApi.analytics });
  const trend = useQuery({ queryKey: queryKeys.wallet.trend, queryFn: () => walletApi.trend(90) });
  const dashboard = useQuery({ queryKey: queryKeys.dashboard.user, queryFn: dashboardApi.user });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Analytics" subtitle="Where your points come from and how your network performs" />

      <AsyncBoundary query={analytics} skeleton={<div className="stack"><Skeleton height={90} /><Skeleton height={280} /></div>}>
        {(data) => (
          <>
            <div className="grid grid-4">
              <StatCard label="Network size" value={data.totalNetwork} icon={icons.network} hint={`${data.directReferrals} direct`} />
              <StatCard label="Points from network" value={data.pointsFromNetwork} icon={icons.wallet} />
              <StatCard label="Link clicks" value={data.clicks} icon={icons.analytics} hint={`${data.signups} converted`} />
              <StatCard
                label="Conversion rate"
                value={data.clicks > 0 ? Math.round((data.signups / data.clicks) * 100) : 0}
                icon={icons.leaderboard}
                hint="Clicks that became signups"
              />
            </div>

            <div className="grid grid-main">
              <div className="stack">
                {trend.data ? (
                  <ChartCard
                    title="Points earned vs redeemed"
                    subtitle="Last 90 days"
                    empty={trend.data.every((d) => Number(d.earned) + Number(d.redeemed) === 0)}
                  >
                    <TrendChart
                      data={trend.data}
                      series={[{ key: 'earned', label: 'Earned' }, { key: 'redeemed', label: 'Redeemed', color: 'var(--chart-4)' }]}
                      height={280}
                    />
                  </ChartCard>
                ) : null}

                {dashboard.data ? (
                  <ChartCard
                    title="Referral growth"
                    subtitle="New members joining your network"
                    empty={dashboard.data.referralPerformance.every((d) => Number(d.direct) + Number(d.network) === 0)}
                  >
                    <ColumnChart
                      data={dashboard.data.referralPerformance}
                      series={[
                        { key: 'direct', label: 'Direct referrals' },
                        { key: 'network', label: 'Deeper levels', color: 'var(--chart-3)' },
                      ]}
                    />
                  </ChartCard>
                ) : null}
              </div>

              <div className="stack">
                <Card>
                  <CardHeader title="Points by level" subtitle="Where your network earnings come from" />
                  <CardBody>
                    {data.levels.every((l) => l.points === 0) ? (
                      <p className="small muted">No level bonuses earned yet.</p>
                    ) : (
                      <DonutChart
                        data={data.levels.filter((l) => l.points > 0).map((l) => ({ name: `Level ${l.level}`, value: l.points }))}
                        height={220}
                      />
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Top performers" subtitle="Members generating the most points for you" />
                  <CardBody className="stack" style={{ gap: 8 }}>
                    {data.topPerformers.length === 0 ? (
                      <p className="small muted">No downline earnings yet.</p>
                    ) : data.topPerformers.map((performer, index) => (
                      <div key={performer.userId} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="row" style={{ gap: 9 }}>
                          <span className="muted small" style={{ width: 16 }}>{index + 1}</span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{performer.name}</span>
                        </div>
                        <span className="mono small" style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatNumber(performer.points)}</span>
                      </div>
                    ))}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Your referral ladder" />
                  <CardBody className="stack" style={{ gap: 7 }}>
                    {data.levels.map((level) => (
                      <div key={level.level} className="row-between small">
                        <Chip tone="neutral">Level {level.level}</Chip>
                        <span className="muted">{level.percent}% · {level.members} members</span>
                        <span style={{ fontWeight: 600 }}>{formatNumber(level.points)} pts</span>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              </div>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
