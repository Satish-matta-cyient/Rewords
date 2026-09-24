import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import {
  DataTable, PageHeader, Chip, StatCard, type Column,
} from '@/components/ui';
import { formatNumber } from '@/utils/format';
import { icons } from '@/layouts/navigation';

interface VoucherOverviewRow {
  id: string; title: string; pointsCost: number; active: boolean;
  available: number; assigned: number; used: number; lowStock: boolean; threshold: number;
}

export default function VouchersPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: queryKeys.vouchers.overview, queryFn: () => api.get<VoucherOverviewRow[]>('/vouchers') });

  const rows = query.data ?? [];
  const totalAvailable = rows.reduce((sum, r) => sum + r.available, 0);
  const lowStockCount = rows.filter((r) => r.lowStock).length;

  const columns: Column<VoucherOverviewRow>[] = [
    {
      key: 'reward', header: 'Reward', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.title}</div>
          <div className="small muted">{formatNumber(row.pointsCost)} points</div>
        </div>
      ),
    },
    {
      key: 'available', header: 'Available', numeric: true, primary: true,
      render: (row) => (
        <Chip tone={row.available === 0 ? 'danger' : row.lowStock ? 'warning' : 'success'}>
          {formatNumber(row.available)}
        </Chip>
      ),
    },
    { key: 'assigned', header: 'Assigned', numeric: true, hideOnMobile: true, render: (row) => <span className="mono">{formatNumber(row.assigned)}</span> },
    { key: 'used', header: 'Used', numeric: true, hideOnMobile: true, render: (row) => <span className="mono">{formatNumber(row.used)}</span> },
    { key: 'status', header: 'Status', render: (row) => <Chip tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Chip> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Voucher Inventory" subtitle="Code pools, stock levels and low-stock alerts" />

      <div className="grid grid-3">
        <StatCard label="Codes available" value={totalAvailable} icon={icons.vouchers} />
        <StatCard label="Rewards with codes" value={rows.length} icon={icons.rewards} />
        <StatCard label="Low stock alerts" value={lowStockCount} icon={icons.risk} hint="At or below their threshold" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/super-admin/vouchers/${row.id}`)}
        emptyTitle="No voucher-based rewards"
        emptyBody="Create a reward with voucher-code delivery, then upload a batch of codes."
      />
    </div>
  );
}
