import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { walletApi, type LedgerRow } from './api';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, PointsBadge, Chip, Button,
  PageHeader, StatCard, ChartCard, TrendChart, Card, CardBody, type Column,
} from '@/components/ui';
import { formatDateTime, formatCurrency, formatNumber, titleCase } from '@/utils/format';
import { TRANSACTION_TYPES } from '@shared/constants';
import { icons } from '@/layouts/navigation';

export default function WalletPage() {
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters();

  const summary = useQuery({ queryKey: queryKeys.wallet.summary, queryFn: walletApi.summary });
  const ledger = useQuery({ queryKey: queryKeys.wallet.ledger(filters), queryFn: () => walletApi.ledger(filters) });
  const trend = useQuery({ queryKey: queryKeys.wallet.trend, queryFn: () => walletApi.trend(30) });

  const columns: Column<LedgerRow>[] = [
    { key: 'date', header: 'Date', render: (row) => <span className="small muted">{formatDateTime(row.date)}</span> },
    {
      key: 'description', header: 'Description', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontSize: 'var(--text-sm)' }}>{row.description}</div>
          {row.level ? <div className="small muted">Level {row.level} bonus</div> : null}
        </div>
      ),
    },
    { key: 'type', header: 'Type', hideOnMobile: true, render: (row) => <Chip tone="neutral">{titleCase(row.type)}</Chip> },
    { key: 'points', header: 'Points', numeric: true, primary: true, render: (row) => <PointsBadge points={row.points} /> },
    { key: 'balance', header: 'Balance', numeric: true, hideOnMobile: true, render: (row) => <span className="mono small">{formatNumber(row.balanceAfter)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Wallet"
        subtitle="Your balances and every point movement, in order"
        action={<Link to="/rewards"><Button>Redeem points</Button></Link>}
      />

      {summary.data ? (
        <>
          <div className="grid grid-4">
            <StatCard
              label="Available" value={summary.data.availablePoints} icon={icons.wallet}
              hint={`${formatCurrency(summary.data.estimatedValueInr)} estimated value`}
            />
            <StatCard
              label="Pending" value={summary.data.pendingPoints} icon={icons.submissions}
              hint={`${summary.data.pendingSubmissions} submission(s) under review`}
            />
            <StatCard label="Locked" value={summary.data.lockedPoints} icon={icons.redemptions} hint="Held for open redemptions" />
            <StatCard label="Lifetime earned" value={summary.data.lifetimeEarned} icon={icons.analytics} hint={`${formatNumber(summary.data.redeemedPoints)} redeemed`} />
          </div>

          <Card style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-mint)' }}>
            <CardBody className="row-between wrap">
              <div>
                <div className="small muted">Conversion rate</div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  1 point = {formatCurrency(summary.data.conversionRate)} · minimum redemption {formatNumber(summary.data.minRedemptionPoints)} points
                </div>
              </div>
              <Link to="/rewards"><Button variant="secondary">Browse rewards</Button></Link>
            </CardBody>
          </Card>
        </>
      ) : null}

      {trend.data ? (
        <ChartCard
          title="Points earned vs redeemed"
          subtitle="Last 30 days"
          empty={trend.data.every((d) => Number(d.earned) + Number(d.redeemed) === 0)}
        >
          <TrendChart
            data={trend.data}
            series={[{ key: 'earned', label: 'Earned' }, { key: 'redeemed', label: 'Redeemed', color: 'var(--chart-4)' }]}
          />
        </ChartCard>
      ) : null}

      <DataTable
        columns={columns}
        rows={ledger.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={ledger.isPending}
        error={ledger.isError ? ledger.error : undefined}
        onRetry={ledger.refetch}
        pagination={ledger.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No transactions yet"
        emptyBody="Your ledger fills up as posts are approved and your network grows."
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search the ledger…" />
            </div>
            <div style={{ width: 190 }}>
              <Select
                aria-label="Transaction type"
                placeholder="All transaction types"
                options={TRANSACTION_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                value={String(filters.transactionType ?? '')}
                onChange={(e) => setFilter('transactionType', e.target.value)}
              />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />
    </div>
  );
}
