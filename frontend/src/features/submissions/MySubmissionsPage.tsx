import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { submissionApi, type SubmissionRow } from './api';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, PointsBadge,
  PageHeader, Button, type Column,
} from '@/components/ui';
import { formatRelative } from '@/utils/format';
import { SUBMISSION_STATUS, PLATFORMS } from '@shared/constants';

export default function MySubmissionsPage() {
  const navigate = useNavigate();
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters();
  const query = useQuery({
    queryKey: queryKeys.submissions.mine(filters),
    queryFn: () => submissionApi.mine(filters),
  });

  const columns: Column<SubmissionRow>[] = [
    {
      key: 'campaign', header: 'Campaign', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.campaignName}</div>
          <div className="small muted truncate" style={{ maxWidth: 280 }}>{row.postUrl}</div>
        </div>
      ),
    },
    { key: 'platform', header: 'Platform', render: (row) => <span className="small">{row.platform}</span> },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'points', header: 'Points', numeric: true, primary: true,
      render: (row) => (row.awardedPoints > 0 ? <PointsBadge points={row.awardedPoints} /> : <span className="muted small">—</span>),
    },
    { key: 'submitted', header: 'Submitted', hideOnMobile: true, render: (row) => <span className="small muted">{formatRelative(row.submittedAt)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="My Submissions"
        subtitle="Every post you have submitted and where it stands"
        action={<Link to="/submit-post"><Button>Submit a post</Button></Link>}
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/my-submissions/${row.id}`)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No submissions yet"
        emptyBody="Pick a campaign, post on social media and submit the link to start earning points."
        emptyAction={<Link to="/campaigns"><Button>Browse campaigns</Button></Link>}
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search by URL…" />
            </div>
            <div style={{ width: 170 }}>
              <Select
                aria-label="Filter by status"
                placeholder="All statuses"
                options={SUBMISSION_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                value={String(filters.status ?? '')}
                onChange={(e) => setFilter('status', e.target.value)}
              />
            </div>
            <div style={{ width: 160 }}>
              <Select
                aria-label="Filter by platform"
                placeholder="All platforms"
                options={PLATFORMS.map((p) => ({ value: p, label: p }))}
                value={String(filters.platform ?? '')}
                onChange={(e) => setFilter('platform', e.target.value)}
              />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />
    </div>
  );
}
