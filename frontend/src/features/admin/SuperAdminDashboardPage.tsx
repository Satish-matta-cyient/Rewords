import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/features/dashboard/api';
import { queryKeys } from '@/api/queryClient';
import {
  StatCard, Card, CardBody, CardHeader, ChartCard, TrendChart, LineSeriesChart,
  AsyncBoundary, StatSkeleton, Skeleton, Select, DataTable, PageHeader, Chip, type Column,
} from '@/components/ui';
import { formatCurrency, formatNumber } from '@/utils/format';
import { icons } from '@/layouts/navigation';
import { daysAgoIso } from '@/utils/range';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

interface RoiRow {
  id: string; name: string; submissions: number; approved: number;
  approvalRate: number; pointsSpent: number; costInr: number; costPerApprovedPost: number;
}

export default function SuperAdminDashboardPage() {
  const [range, setRange] = useState('30');
  const query = useQuery({
    queryKey: queryKeys.dashboard.superAdmin(range),
    queryFn: () => dashboardApi.superAdmin({ from: daysAgoIso(Number(range)) }),
  });

  const roiColumns: Column<RoiRow>[] = [
    { key: 'name', header: 'Campaign', primary: true, render: (r) => <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{r.name}</span> },
    { key: 'submissions', header: 'Submissions', numeric: true, render: (r) => <span className="mono">{formatNumber(r.submissions)}</span> },
    { key: 'approved', header: 'Approved', numeric: true, hideOnMobile: true, render: (r) => <span className="mono">{formatNumber(r.approved)}</span> },
    { key: 'rate', header: 'Approval', numeric: true, render: (r) => <Chip tone={r.approvalRate > 75 ? 'success' : r.approvalRate > 50 ? 'warning' : 'neutral'}>{r.approvalRate}%</Chip> },
    { key: 'cost', header: 'Points spent', numeric: true, hideOnMobile: true, render: (r) => <span className="mono">{formatNumber(r.pointsSpent)}</span> },
    { key: 'cpa', header: 'Cost / approved post', numeric: true, render: (r) => <span className="mono">{formatCurrency(r.costPerApprovedPost)}</span> },
  ];

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={30} width="35%" /><StatSkeleton /><Skeleton height={300} /></div>}>
      {(data) => (
        <div className="stack" style={{ gap: 20 }}>
          <PageHeader
            title="Platform Overview"
            subtitle="Growth, points economics and platform health"
            action={<div style={{ width: 175 }}><Select options={RANGES} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range" /></div>}
          />

          <div className="grid grid-4">
            {data.stats.slice(0, 4).map((stat) => <StatCard key={stat.key} label={stat.label} value={stat.value} icon={icons.users} />)}
          </div>
          <div className="grid grid-4">
            {data.stats.slice(4).map((stat) => (
              <StatCard key={stat.key} label={stat.label} value={stat.value} icon={stat.key.includes('fraud') || stat.key.includes('sla') ? icons.risk : icons.wallet} />
            ))}
          </div>

          <Card style={{ borderColor: 'var(--primary)' }}>
            <CardHeader
              title="Outstanding liability"
              subtitle={`Points are a financial obligation at ${formatCurrency(data.liability.conversionRate)} per point`}
              action={<Link to="/super-admin/liability" className="small">Full breakdown</Link>}
            />
            <CardBody>
              <div className="grid grid-3">
                <div>
                  <div className="small muted">Outstanding points</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatNumber(data.liability.outstandingPoints)}</div>
                  <div className="small" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    ≈ {formatCurrency(data.liability.estimatedInrLiability)} exposure
                  </div>
                </div>
                <div>
                  <div className="small muted">Voucher liability (open redemptions)</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatCurrency(data.liability.voucherLiabilityInr)}</div>
                  <div className="small muted">{formatNumber(data.liability.pendingRedemptionPoints)} points locked</div>
                </div>
                <div>
                  <div className="small muted">Cash payout liability</div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatCurrency(data.liability.cashPayoutLiabilityInr)}</div>
                  <div className="small muted">{formatNumber(data.liability.redeemedPoints)} points already redeemed</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-2">
            <ChartCard title="User growth" subtitle="New and cumulative ambassadors" empty={data.userGrowth.length === 0}>
              <LineSeriesChart
                data={data.userGrowth}
                series={[{ key: 'total', label: 'Total users' }, { key: 'new', label: 'New users', color: 'var(--chart-2)' }]}
              />
            </ChartCard>

            <ChartCard title="Points issued vs redeemed" subtitle="Platform-wide point flow" empty={data.pointsSeries.every((d) => Number(d.issued) === 0)}>
              <TrendChart
                data={data.pointsSeries}
                series={[{ key: 'issued', label: 'Issued' }, { key: 'redeemed', label: 'Redeemed', color: 'var(--chart-4)' }]}
              />
            </ChartCard>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 18 }}>Campaign return on investment</h2>
            <DataTable
              columns={roiColumns}
              rows={data.campaignRoi}
              rowKey={(r) => r.id}
              emptyTitle="No campaign activity in this period"
            />
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}
