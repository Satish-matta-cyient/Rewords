import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { campaignApi, type CampaignListItem } from './api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, PageHeader, Button,
  ProgressBar, Chip, type Column,
} from '@/components/ui';
import { formatNumber, formatDate } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { CAMPAIGN_STATUS } from '@shared/constants';

export default function AdminCampaignsPage() {
  const navigate = useNavigate();
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters();
  const query = useQuery({ queryKey: queryKeys.campaigns.list(filters), queryFn: () => campaignApi.list(filters) });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => campaignApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success('Campaign status updated');
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: () => toast.error('Could not change the status'),
  });

  const columns: Column<CampaignListItem>[] = [
    {
      key: 'name', header: 'Campaign', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.name}</div>
          <div className="small muted">{row.category} · {row.platforms.length} platform(s)</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    { key: 'credit', header: 'Credit', numeric: true, render: (row) => <span className="mono">{formatNumber(row.creditValue)}</span> },
    { key: 'submissions', header: 'Submissions', numeric: true, hideOnMobile: true, render: (row) => <span className="mono">{row.submissionCount}</span> },
    {
      key: 'budget', header: 'Budget', hideOnMobile: true,
      render: (row) => (
        row.budgetPoints ? (
          <div style={{ minWidth: 120 }}>
            <ProgressBar
              value={(row.budgetSpentPoints / row.budgetPoints) * 100}
              tone={row.budgetExhausted ? 'danger' : (row.budgetSpentPoints / row.budgetPoints) > 0.7 ? 'warning' : undefined}
            />
            <div className="small muted" style={{ marginTop: 3 }}>
              {formatNumber(row.budgetSpentPoints)} / {formatNumber(row.budgetPoints)}
            </div>
          </div>
        ) : <Chip tone="neutral">Uncapped</Chip>
      ),
    },
    { key: 'ends', header: 'Ends', hideOnMobile: true, render: (row) => <span className="small muted">{formatDate(row.endDate)}</span> },
    {
      key: 'actions', header: '', hideOnMobile: true,
      render: (row) => (
        <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {row.status === 'ACTIVE' ? (
            <Button size="sm" variant="secondary" onClick={() => changeStatus.mutate({ id: row.id, status: 'PAUSED' })}>Pause</Button>
          ) : row.status === 'PAUSED' || row.status === 'DRAFT' ? (
            <Button size="sm" onClick={() => changeStatus.mutate({ id: row.id, status: 'ACTIVE' })}>Activate</Button>
          ) : null}
          <Link to={`/admin/campaigns/${row.id}`}><Button size="sm" variant="ghost">Edit</Button></Link>
        </div>
      ),
    },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Campaigns"
        subtitle="Create campaigns, set budgets and control who can submit"
        action={<Link to="/admin/campaigns/new"><Button>New campaign</Button></Link>}
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/admin/campaigns/${row.id}`)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No campaigns yet"
        emptyBody="Create your first campaign to give ambassadors something to promote."
        emptyAction={<Link to="/admin/campaigns/new"><Button>New campaign</Button></Link>}
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search campaigns…" />
            </div>
            <div style={{ width: 175 }}>
              <Select aria-label="Status" placeholder="All statuses"
                options={CAMPAIGN_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                value={String(filters.status ?? '')} onChange={(e) => setFilter('status', e.target.value)} />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />
    </div>
  );
}
