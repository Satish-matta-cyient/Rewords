import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/features/dashboard/api';
import { queryKeys } from '@/api/queryClient';
import {
  StatCard, Card, CardBody, CardHeader, ChartCard, ColumnChart, DonutChart,
  AsyncBoundary, StatSkeleton, Skeleton, Select, ProgressBar, Chip, DataTable,
  PageHeader, Button, type Column,
} from '@/components/ui';
import { formatNumber, titleCase } from '@/utils/format';
import { icons } from '@/layouts/navigation';
import { daysAgoIso } from '@/utils/range';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const STAT_ICONS: Record<string, JSX.Element> = {
  pendingVerifications: icons.verify, pendingRedemptions: icons.redemptions,
  activeUsers: icons.users, newUsers: icons.network, pointsIssued: icons.wallet,
  pointsRedeemed: icons.rewards, riskFlags: icons.risk, slaBreaches: icons.risk,
};

interface ReviewerRow { reviewerId: string; name: string; decisions: number; approved: number; rejected: number; approvalRate: number }

export default function AdminDashboardPage() {
  const [range, setRange] = useState('30');
  const query = useQuery({
    queryKey: queryKeys.dashboard.admin(range),
    queryFn: () => dashboardApi.admin({ from: daysAgoIso(Number(range)) }),
  });

  const reviewerColumns: Column<ReviewerRow>[] = [
    { key: 'name', header: 'Reviewer', primary: true, render: (r) => <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{r.name}</span> },
    { key: 'decisions', header: 'Decisions', numeric: true, render: (r) => <span className="mono">{formatNumber(r.decisions)}</span> },
    { key: 'approved', header: 'Approved', numeric: true, hideOnMobile: true, render: (r) => <span className="mono">{formatNumber(r.approved)}</span> },
    { key: 'rejected', header: 'Rejected', numeric: true, hideOnMobile: true, render: (r) => <span className="mono">{formatNumber(r.rejected)}</span> },
    { key: 'rate', header: 'Approval rate', numeric: true, render: (r) => <Chip tone={r.approvalRate > 80 ? 'success' : 'neutral'}>{r.approvalRate}%</Chip> },
  ];

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={30} width="35%" /><StatSkeleton /><Skeleton height={300} /></div>}>
      {(data) => (
        <div className="stack" style={{ gap: 20 }}>
          <PageHeader
            title="Operations Dashboard"
            subtitle="Monitor verification throughput, redemptions and risk"
            action={
              <div className="row" style={{ gap: 8 }}>
                <div style={{ width: 160 }}>
                  <Select options={RANGES} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range" />
                </div>
                <Link to="/admin/reports"><Button variant="secondary">Export report</Button></Link>
              </div>
            }
          />

          <div className="grid grid-4">
            {data.stats.map((stat) => (
              <StatCard key={stat.key} label={stat.label} value={stat.value} icon={STAT_ICONS[stat.key]} />
            ))}
          </div>

          {data.aging.critical > 0 ? (
            <Card style={{ borderColor: 'var(--destructive)', background: 'var(--destructive-soft)' }}>
              <CardBody className="row-between wrap">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--destructive)' }}>
                    {data.aging.critical} submission(s) have breached the 72-hour SLA
                  </div>
                  <div className="small">A further {data.aging.warning} are past 24 hours and approaching the limit.</div>
                </div>
                <Link to="/admin/verifications?status=PENDING"><Button variant="danger">Review queue</Button></Link>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-main">
            <ChartCard
              title="Submission activity"
              subtitle={`Submitted, approved and rejected over the last ${range} days`}
              empty={data.submissionSeries.every((d) => Number(d.submitted) === 0)}
            >
              <ColumnChart
                data={data.submissionSeries}
                series={[
                  { key: 'submitted', label: 'Submitted', color: 'var(--chart-3)' },
                  { key: 'approved', label: 'Approved' },
                  { key: 'rejected', label: 'Rejected', color: 'var(--chart-4)' },
                ]}
              />
            </ChartCard>

            <Card>
              <CardHeader title="Queue composition" subtitle="Where submissions sit right now" />
              <CardBody>
                <DonutChart data={data.queueByStatus.map((s) => ({ name: titleCase(s.status), value: s.count }))} />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Campaign budget usage" subtitle="Active campaigns and how much of their budget has been paid out" />
            <CardBody className="stack" style={{ gap: 14 }}>
              {data.campaignPerformance.length === 0 ? (
                <p className="small muted">No active campaigns.</p>
              ) : data.campaignPerformance.map((campaign) => (
                <div key={campaign.id}>
                  <div className="row-between small" style={{ marginBottom: 5 }}>
                    <Link to={`/admin/campaigns/${campaign.id}`} style={{ fontWeight: 600 }}>{campaign.name}</Link>
                    <span className="muted">
                      {formatNumber(campaign.budgetSpentPoints)}
                      {campaign.budgetPoints ? ` / ${formatNumber(campaign.budgetPoints)}` : ''} pts · {campaign.submissions} submissions
                    </span>
                  </div>
                  <ProgressBar
                    value={campaign.budgetUsedPercent ?? 0}
                    tone={(campaign.budgetUsedPercent ?? 0) > 90 ? 'danger' : (campaign.budgetUsedPercent ?? 0) > 70 ? 'warning' : undefined}
                  />
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 18 }}>Reviewer throughput</h2>
            <DataTable
              columns={reviewerColumns}
              rows={data.reviewerSla}
              rowKey={(r) => r.reviewerId}
              emptyTitle="No decisions in this period"
            />
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}
