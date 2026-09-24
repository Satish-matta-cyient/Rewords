import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, StatusChip, Chip, PageHeader, Button, type Column,
} from '@/components/ui';
import { formatRelative, titleCase } from '@/utils/format';
import type { Paginated } from '@shared/types';
import { TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORY } from '@shared/constants';

interface InboxRow {
  id: string; reference: string; subject: string; category: string;
  status: string; priority: string; messages: number;
  user: { fullName: string; email: string }; assignee: string | null;
  createdAt: string; updatedAt: string;
}

export default function SupportInboxPage() {
  const navigate = useNavigate();
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters({ status: 'OPEN' });

  const query = useQuery({
    queryKey: queryKeys.support.inbox(filters),
    queryFn: () => api.get<Paginated<InboxRow>>('/support/inbox', { query: filters as never }),
  });

  const columns: Column<InboxRow>[] = [
    {
      key: 'subject', header: 'Ticket', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.subject}</div>
          <div className="small muted">{row.user.fullName} · <span className="mono">{row.reference}</span></div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (row) => <Chip tone="neutral">{titleCase(row.category)}</Chip> },
    {
      key: 'priority', header: 'Priority', primary: true,
      render: (row) => <Chip tone={row.priority === 'URGENT' || row.priority === 'HIGH' ? 'danger' : 'neutral'}>{titleCase(row.priority)}</Chip>,
    },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    { key: 'assignee', header: 'Assigned', hideOnMobile: true, render: (row) => <span className="small muted">{row.assignee ?? 'Unassigned'}</span> },
    { key: 'updated', header: 'Last activity', hideOnMobile: true, render: (row) => <span className="small muted">{formatRelative(row.updatedAt)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Support Inbox" subtitle="Tickets raised by ambassadors" />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => navigate(`/admin/support/${row.id}`)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="Inbox zero"
        emptyBody="No tickets match these filters."
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search subject or reference…" />
            </div>
            <div style={{ width: 175 }}>
              <Select aria-label="Status" placeholder="All statuses"
                options={TICKET_STATUS.map((s) => ({ value: s, label: titleCase(s) }))}
                value={String(filters.status ?? '')} onChange={(e) => setFilter('status', e.target.value)} />
            </div>
            <div style={{ width: 150 }}>
              <Select aria-label="Priority" placeholder="Any priority"
                options={TICKET_PRIORITY.map((p) => ({ value: p, label: titleCase(p) }))}
                value={String(filters.priority ?? '')} onChange={(e) => setFilter('priority', e.target.value)} />
            </div>
            <div style={{ width: 165 }}>
              <Select aria-label="Category" placeholder="All categories"
                options={TICKET_CATEGORY.map((c) => ({ value: c, label: titleCase(c) }))}
                value={String(filters.category ?? '')} onChange={(e) => setFilter('category', e.target.value)} />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />
    </div>
  );
}
