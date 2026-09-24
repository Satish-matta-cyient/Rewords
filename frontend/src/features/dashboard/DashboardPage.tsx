import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from './api';
import { queryKeys } from '@/api/queryClient';
import { useAuthStore } from '@/store/authStore';
import {
  StatCard, Card, CardBody, ChartCard, ColumnChart, TrendChart, Select,
  AsyncBoundary, StatSkeleton, Skeleton, ProgressBar, Chip,
} from '@/components/ui';
import { ReferralShareBox } from '@/features/referrals/components/ReferralShareBox';
import { RecentActivity } from './components/RecentActivity';
import { RewardsPreview } from './components/RewardsPreview';
import { greeting, formatNumber } from '@/utils/format';
import { icons } from '@/layouts/navigation';

const STAT_ICONS: Record<string, JSX.Element> = {
  available: icons.wallet, referrals: icons.network, earned: icons.analytics, redeemed: icons.rewards,
};

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function DashboardSkeleton() {
  return (
    <div className="stack" style={{ gap: 20 }}>
      <Skeleton height={30} width="38%" />
      <StatSkeleton />
      <Card><CardBody><Skeleton height={110} /></CardBody></Card>
      <div className="grid grid-main">
        <Card><CardBody><Skeleton height={280} /></CardBody></Card>
        <Card><CardBody><Skeleton height={280} /></CardBody></Card>
      </div>
    </div>
  );
}

function TierProgress({ tier }: { tier: NonNullable<import('@shared/types').UserDashboard['tier']> }) {
  return (
    <Card>
      <CardBody className="stack" style={{ gap: 10 }}>
        <div className="row-between">
          <div>
            <div className="small muted">Current tier</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{tier.name}</div>
          </div>
          {tier.nextKey ? <Chip tone="primary">Next: {tier.nextKey}</Chip> : <Chip tone="success">Top tier</Chip>}
        </div>
        <ProgressBar value={tier.progressPercent} />
        <div className="small muted">{tier.progressPercent}% toward {tier.nextKey ?? 'the top tier'}</div>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [range, setRange] = useState('30');
  const query = useQuery({ queryKey: queryKeys.dashboard.user, queryFn: dashboardApi.user });

  return (
    <AsyncBoundary query={query} skeleton={<DashboardSkeleton />}>
      {(data) => {
        const sliceBy = Number(range);
        const referralSeries = data.referralPerformance.slice(-sliceBy);
        const pointsSeries = data.pointsTrend.slice(-sliceBy);

        return (
          <div className="stack" style={{ gap: 20 }}>
            <header>
              <h1 style={{ fontSize: 28 }}>{greeting()}, {data.greetingName}</h1>
              <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 2 }}>
                Here is your ambassador performance.
              </p>
            </header>

            {user && !user.emailVerified ? (
              <Card style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
                <CardBody className="row-between wrap">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Verify your email to unlock submissions</div>
                    <div className="small" style={{ color: '#92400E' }}>You can browse campaigns, but posts and redemptions need a verified address.</div>
                  </div>
                  <Link to="/verify-email" className="btn btn--secondary btn--sm">Verify now</Link>
                </CardBody>
              </Card>
            ) : null}

            <div className="grid grid-4">
              {data.stats.map((stat) => (
                <StatCard
                  key={stat.key}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                  delta={stat.delta}
                  icon={STAT_ICONS[stat.key]}
                  chip={stat.key === 'available' ? <Chip tone="success">Available</Chip> : undefined}
                />
              ))}
            </div>

            <Card style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-mint)' }}>
              <CardBody>
                <ReferralShareBox code={data.referral.code} link={data.referral.link} bonus={data.referral.signupBonus} />
              </CardBody>
            </Card>

            <div className="grid grid-main">
              <div className="stack">
                <ChartCard
                  title="Referral Performance"
                  subtitle="New members joining your network"
                  empty={referralSeries.every((d) => Number(d.direct) + Number(d.network) === 0)}
                  action={
                    <div style={{ width: 150 }}>
                      <Select options={RANGES} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Chart date range" />
                    </div>
                  }
                >
                  <ColumnChart
                    data={referralSeries}
                    series={[
                      { key: 'direct', label: 'Direct referrals' },
                      { key: 'network', label: 'Deeper levels', color: 'var(--chart-3)' },
                    ]}
                  />
                </ChartCard>

                <ChartCard
                  title="Points Earned vs Redeemed"
                  subtitle={`Last ${range} days`}
                  empty={pointsSeries.every((d) => Number(d.earned) + Number(d.redeemed) === 0)}
                >
                  <TrendChart
                    data={pointsSeries}
                    series={[
                      { key: 'earned', label: 'Earned' },
                      { key: 'redeemed', label: 'Redeemed', color: 'var(--chart-4)' },
                    ]}
                  />
                </ChartCard>

                <RecentActivity items={data.recentActivity} />
              </div>

              <div className="stack">
                {data.tier ? <TierProgress tier={data.tier} /> : null}
                <RewardsPreview rewards={data.recommendedRewards} />
                <Card>
                  <CardBody className="stack" style={{ gap: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Quick actions</div>
                    <Link to="/submit-post" className="btn btn--primary btn--block">Submit a post</Link>
                    <Link to="/campaigns" className="btn btn--secondary btn--block">Browse campaigns</Link>
                    <Link to="/network" className="btn btn--ghost btn--block">View my network</Link>
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}
