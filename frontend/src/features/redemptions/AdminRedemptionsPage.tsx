import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { redemptionApi, type RedemptionRow } from './api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, PageHeader, Button,
  Drawer, Textarea, ConfirmDialog, Chip, type Column,
} from '@/components/ui';
import { formatDateTime, formatCurrency, formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { REDEMPTION_STATUS } from '@shared/constants';

export default function AdminRedemptionsPage() {
  const [active, setActive] = useState<RedemptionRow | null>(null);
  const [reason, setReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const { filters, setFilter, setPage, searchInput, setSearchInput } = useFilters({ status: 'POINTS_LOCKED' });

  const query = useQuery({ queryKey: queryKeys.redemptions.admin(filters), queryFn: () => redemptionApi.adminList(filters) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['redemptions'] });
    void queryClient.invalidateQueries({ queryKey: ['badges'] });
    setActive(null); setReason(''); setConfirmApprove(false);
  };

  const approve = useMutation({
    mutationFn: () => redemptionApi.approve(active!.id),
    onSuccess: () => { toast.success('Redemption approved', 'A voucher code was assigned automatically where applicable.'); refresh(); },
    onError: (error) => { toast.error('Approval failed', error instanceof ApiError ? error.message : undefined); setConfirmApprove(false); },
  });

  const reject = useMutation({
    mutationFn: () => redemptionApi.reject(active!.id, reason),
    onSuccess: () => { toast.success('Redemption rejected', 'The points have been returned to the ambassador.'); refresh(); },
    onError: (error) => toast.error('Could not reject', error instanceof ApiError ? error.message : undefined),
  });

  const columns: Column<RedemptionRow>[] = [
    {
      key: 'user', header: 'Ambassador', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.user?.fullName}</div>
          <div className="small muted">{row.user?.email}</div>
        </div>
      ),
    },
    { key: 'reward', header: 'Reward', primary: true, render: (row) => <span className="small">{row.reward}</span> },
    { key: 'points', header: 'Points', numeric: true, render: (row) => <span className="mono">{formatNumber(row.pointsSpent)}</span> },
    { key: 'value', header: 'Value', numeric: true, hideOnMobile: true, render: (row) => <span className="small">{formatCurrency(row.cashValue)}</span> },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'age', header: 'Waiting', hideOnMobile: true,
      render: (row) => <span className="small muted">{row.ageHours ? `${Math.round(row.ageHours)}h` : '—'}</span>,
    },
  ];

  const decidable = active ? ['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW'].includes(active.status) : false;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Redemptions" subtitle="Approve requests, assign vouchers and release points" />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={setActive}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="Nothing waiting"
        emptyBody="All redemptions matching these filters have been processed."
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by reference or email…" />
            </div>
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

      <Drawer
        open={active !== null}
        onClose={() => { setActive(null); setReason(''); }}
        title="Redemption request"
        subtitle={active?.reference}
        footer={decidable ? (
          <>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={reject.isPending} onClick={() => reject.mutate()}>
              Reject and refund
            </Button>
            <Button className="grow" onClick={() => setConfirmApprove(true)}>Approve</Button>
          </>
        ) : undefined}
      >
        {active ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row-between small"><span className="muted">Ambassador</span><span style={{ fontWeight: 600 }}>{active.user?.fullName}</span></div>
              <div className="row-between small"><span className="muted">Email</span><span>{active.user?.email}</span></div>
              <div className="row-between small"><span className="muted">Reward</span><span>{active.reward}</span></div>
              <div className="row-between small"><span className="muted">Points locked</span><span style={{ fontWeight: 600 }}>{formatNumber(active.pointsSpent)}</span></div>
              <div className="row-between small"><span className="muted">Cash value</span><span>{formatCurrency(active.cashValue)}</span></div>
              <div className="row-between small"><span className="muted">Delivery</span><Chip tone="neutral">{active.deliveryType.replace('_', ' ')}</Chip></div>
              <div className="row-between small"><span className="muted">Requested</span><span>{formatDateTime(active.createdAt)}</span></div>
            </div>

            {decidable ? (
              <Textarea
                label="Rejection reason"
                hint="Required only if you reject. The ambassador sees this text and their points are refunded."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={() => approve.mutate()}
        loading={approve.isPending}
        title="Approve this redemption?"
        description={
          active?.deliveryType === 'VOUCHER_CODE'
            ? 'The locked points become a permanent debit and the next available voucher code is assigned to this ambassador. A code can never be assigned twice.'
            : 'The locked points become a permanent debit and the request moves to fulfilment.'
        }
        confirmLabel="Approve redemption"
      />
    </div>
  );
}
