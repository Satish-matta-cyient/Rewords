import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { redemptionApi, type RedemptionRow } from './api';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, Select, StatusChip, PageHeader, Button, type Column,
} from '@/components/ui';
import { formatDate, formatCurrency, formatNumber } from '@/utils/format';
import { REDEMPTION_STATUS } from '@shared/constants';

export default function MyRedemptionsPage() {
  const navigate = useNavigate();
  const { filters, setFilter, setPage } = useFilters();
  const query = useQuery({ queryKey: queryKeys.redemptions.mine(filters), queryFn: () => redemptionApi.mine(filters) });

  const columns: Column<RedemptionRow>[] = [
    {
      key: 'reward', header: 'Reward', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.reward}</div>
          <div className="small muted mono">{row.reference}</div>
        </div>
      ),
    },
    { key: 'points', header: 'Points', numeric: true, primary: true, render: (row) => <span className="mono">{formatNumber(row.pointsSpent)}</span> },
    { key: 'value', header: 'Value', numeric: true, hideOnMobile: true, render: (row) => <span className="small">{formatCurrency(row.cashValue)}</span> },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    { key: 'date', header: 'Requested', hideOnMobile: true, render: (row) => <span className="small muted">{formatDate(row.createdAt)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="My Redemptions"
        subtitle="Track your requests and collect voucher codes"
        action={<Link to="/rewards"><Button>Browse rewards</Button></Link>}
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/my-redemptions/${row.id}`)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No redemptions yet"
        emptyBody="Once you have enough points, redeem them for vouchers or a cash payout."
        emptyAction={<Link to="/rewards"><Button>Browse rewards</Button></Link>}
        toolbar={
          <FilterBar>
            <div style={{ width: 190 }}>
              <Select
                aria-label="Filter by status" placeholder="All statuses"
                options={REDEMPTION_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                value={String(filters.status ?? '')}
                onChange={(e) => setFilter('status', e.target.value)}
              />
            </div>
          </FilterBar>
        }
      />
    </div>
  );
}
