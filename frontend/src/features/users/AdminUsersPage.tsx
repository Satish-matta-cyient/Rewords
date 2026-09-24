import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { userApi, type UserRow } from './api';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, Avatar, Chip,
  PageHeader, Button, type Column,
} from '@/components/ui';
import { formatNumber, formatRelative } from '@/utils/format';
import { USER_STATUS, ROLES } from '@shared/constants';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters();
  const query = useQuery({ queryKey: queryKeys.users.list(filters), queryFn: () => userApi.list(filters) });

  const columns: Column<UserRow>[] = [
    {
      key: 'user', header: 'User', primary: true,
      render: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <Avatar name={row.fullName} size={30} />
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.fullName}</div>
            <div className="small muted truncate">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    { key: 'role', header: 'Role', hideOnMobile: true, render: (row) => <Chip tone={row.role === 'USER' ? 'neutral' : 'primary'}>{row.role.replace('_', ' ')}</Chip> },
    { key: 'points', header: 'Available', numeric: true, primary: true, render: (row) => <span className="mono">{formatNumber(row.availablePoints)}</span> },
    { key: 'referrals', header: 'Referrals', numeric: true, hideOnMobile: true, render: (row) => <span className="mono">{row.directReferrals}</span> },
    {
      key: 'risk', header: 'Risk', hideOnMobile: true,
      render: (row) => (row.riskScore > 0 ? <Chip tone={row.riskScore >= 40 ? 'danger' : 'warning'}>{row.riskScore}</Chip> : <span className="muted small">—</span>),
    },
    { key: 'active', header: 'Last active', hideOnMobile: true, render: (row) => <span className="small muted">{row.lastLoginAt ? formatRelative(row.lastLoginAt) : 'Never'}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Users" subtitle="Accounts, balances, network size and risk posture" />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No users match these filters"
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by name, email or phone…" />
            </div>
            <div style={{ width: 175 }}>
              <Select aria-label="Status" placeholder="All statuses"
                options={USER_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                value={String(filters.status ?? '')} onChange={(e) => setFilter('status', e.target.value)} />
            </div>
            <div style={{ width: 155 }}>
              <Select aria-label="Role" placeholder="All roles"
                options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                value={String(filters.role ?? '')} onChange={(e) => setFilter('role', e.target.value)} />
            </div>
            <Button
              size="sm"
              variant={filters.riskOnly ? 'primary' : 'secondary'}
              onClick={() => setFilter('riskOnly', filters.riskOnly ? undefined : 'true')}
            >
              Flagged only
            </Button>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />
    </div>
  );
}
