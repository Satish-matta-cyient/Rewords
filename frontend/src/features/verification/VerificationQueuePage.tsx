import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { submissionApi, type SubmissionRow } from '@/features/submissions/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, SlaChip, Avatar,
  PageHeader, Button, Card, CardBody, StatCard, useSelection, ConfirmDialog,
  Chip, type Column,
} from '@/components/ui';
import { ReviewDrawer } from './components/ReviewDrawer';
import { campaignApi } from '@/features/campaigns/api';
import { formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { SUBMISSION_STATUS, PLATFORMS } from '@shared/constants';
import { icons } from '@/layouts/navigation';

export default function VerificationQueuePage() {
  const { id: routeId } = useParams();
  const [activeId, setActiveId] = useState<string | null>(routeId ?? null);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const selection = useSelection();

  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters({ status: 'PENDING' });

  const queue = useQuery({ queryKey: queryKeys.verifications.queue(filters), queryFn: () => submissionApi.queue(filters) });
  const stats = useQuery({ queryKey: queryKeys.verifications.stats, queryFn: submissionApi.queueStats, refetchInterval: 60_000 });
  const campaigns = useQuery({ queryKey: ['campaigns', 'options'], queryFn: () => campaignApi.list({ pageSize: 50 }) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['verifications'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    selection.clear();
  };

  const bulk = useMutation({
    mutationFn: () => (bulkAction === 'approve'
      ? submissionApi.bulkApprove(selection.selected)
      : submissionApi.bulkReject(selection.selected, 'Does not meet the campaign requirements')),
    onSuccess: (results) => {
      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.length - succeeded;
      if (failed === 0) toast.success(`${succeeded} submission(s) processed`);
      else toast.warning(`${succeeded} processed, ${failed} could not be completed`, 'Open the failed items individually to see why.');
      refresh(); setBulkAction(null);
    },
    onError: () => { toast.error('Bulk action failed'); setBulkAction(null); },
  });

  const columns: Column<SubmissionRow>[] = [
    {
      key: 'user', header: 'Ambassador', primary: true,
      render: (row) => (
        <div className="row" style={{ gap: 9 }}>
          <Avatar name={row.user.fullName} src={row.user.avatarUrl} size={30} />
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.user.fullName}</div>
            <div className="small muted truncate">{row.user.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'campaign', header: 'Campaign', render: (row) => <span className="small">{row.campaignName}</span> },
    { key: 'platform', header: 'Platform', hideOnMobile: true, render: (row) => <Chip tone="neutral">{row.platform}</Chip> },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'risk', header: 'Risk', hideOnMobile: true,
      render: (row) => <Chip tone={row.riskLevel === 'HIGH' ? 'danger' : row.riskLevel === 'MEDIUM' ? 'warning' : 'neutral'}>{row.riskLevel}</Chip>,
    },
    { key: 'sla', header: 'Waiting', primary: true, render: (row) => <SlaChip sla={row.sla} ageHours={row.ageHours} /> },
    { key: 'points', header: 'Points', numeric: true, render: (row) => <span className="mono">{formatNumber(row.creditValue)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Verification Queue" subtitle="Review submitted posts and award points" />

      <div className="grid grid-4">
        <StatCard label="Awaiting review" value={stats.data?.pending ?? 0} icon={icons.verify} />
        <StatCard label="Over 24 hours" value={stats.data?.agingWarning ?? 0} icon={icons.risk} hint="Approaching SLA" />
        <StatCard label="Over 72 hours" value={stats.data?.agingCritical ?? 0} icon={icons.risk} hint="SLA breached" />
        <StatCard
          label="Approved (all time)"
          value={stats.data?.byStatus.find((s) => s.status === 'APPROVED')?.count ?? 0}
          icon={icons.analytics}
        />
      </div>

      {selection.selected.length > 0 ? (
        <Card style={{ borderColor: 'var(--primary)', background: 'var(--accent-soft)' }}>
          <CardBody className="row-between wrap">
            <span className="small" style={{ fontWeight: 600 }}>{selection.selected.length} submission(s) selected</span>
            <div className="row" style={{ gap: 8 }}>
              <Button size="sm" variant="secondary" onClick={selection.clear}>Clear</Button>
              <Button size="sm" variant="danger" onClick={() => setBulkAction('reject')}>Reject all</Button>
              <Button size="sm" onClick={() => setBulkAction('approve')}>Approve all</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={queue.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={queue.isPending}
        error={queue.isError ? queue.error : undefined}
        onRetry={queue.refetch}
        onRowClick={(row) => setActiveId(row.id)}
        pagination={queue.data?.pagination}
        onPageChange={setPage}
        selection={selection}
        emptyTitle="The queue is clear"
        emptyBody="Every submission matching these filters has been reviewed."
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by name, email or URL…" />
            </div>
            <div style={{ width: 160 }}>
              <Select aria-label="Status" placeholder="All statuses"
                options={SUBMISSION_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                value={String(filters.status ?? '')} onChange={(e) => setFilter('status', e.target.value)} />
            </div>
            <div style={{ width: 190 }}>
              <Select aria-label="Campaign" placeholder="All campaigns"
                options={(campaigns.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
                value={String(filters.campaignId ?? '')} onChange={(e) => setFilter('campaignId', e.target.value)} />
            </div>
            <div style={{ width: 150 }}>
              <Select aria-label="Platform" placeholder="All platforms"
                options={PLATFORMS.map((p) => ({ value: p, label: p }))}
                value={String(filters.platform ?? '')} onChange={(e) => setFilter('platform', e.target.value)} />
            </div>
            <div style={{ width: 140 }}>
              <Select aria-label="Risk level" placeholder="Any risk"
                options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                value={String(filters.riskLevel ?? '')} onChange={(e) => setFilter('riskLevel', e.target.value)} />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />

      <ReviewDrawer submissionId={activeId} onClose={() => setActiveId(null)} />

      <ConfirmDialog
        open={bulkAction !== null}
        onClose={() => setBulkAction(null)}
        onConfirm={() => bulk.mutate()}
        loading={bulk.isPending}
        destructive={bulkAction === 'reject'}
        title={bulkAction === 'approve' ? `Approve ${selection.selected.length} submissions?` : `Reject ${selection.selected.length} submissions?`}
        description={
          bulkAction === 'approve'
            ? 'Each submission is processed independently — points and referral bonuses are awarded for every one that passes validation. Items that fail (budget caps, duplicates) are reported back.'
            : 'Each ambassador is notified with a generic reason. For a specific explanation, reject them individually instead.'
        }
        confirmLabel={bulkAction === 'approve' ? 'Approve all' : 'Reject all'}
      />
    </div>
  );
}
