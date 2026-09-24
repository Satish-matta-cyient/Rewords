import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, SearchInput, Select, Chip, PageHeader, Button, Card, CardBody, type Column,
} from '@/components/ui';
import { formatDateTime, titleCase } from '@/utils/format';
import type { Paginated } from '@shared/types';
import { ROLES } from '@shared/constants';

interface AuditRow {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  actorRole: string | null;
  action: string; entityType: string; entityId: string | null; ip: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Renders a readable before/after diff rather than two raw JSON blobs. */
function JsonDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (keys.length === 0) return <p className="small muted">No field-level changes were recorded for this action.</p>;

  return (
    <div className="stack" style={{ gap: 4 }}>
      {keys.map((key) => {
        const from = before?.[key];
        const to = after?.[key];
        const changed = JSON.stringify(from) !== JSON.stringify(to);
        return (
          <div key={key} className="row" style={{ gap: 10, fontSize: 12, padding: '5px 8px', background: changed ? 'var(--accent-soft)' : 'transparent', borderRadius: 'var(--radius-sm)' }}>
            <span className="muted" style={{ minWidth: 150, fontWeight: 500 }}>{key}</span>
            <span style={{ color: 'var(--destructive)', textDecoration: changed && from !== undefined ? 'line-through' : undefined }}>
              {from === undefined ? '—' : JSON.stringify(from)}
            </span>
            {changed ? <span aria-hidden>→</span> : null}
            {changed ? <span style={{ color: 'var(--success)', fontWeight: 500 }}>{to === undefined ? '—' : JSON.stringify(to)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function AuditPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters();

  const query = useQuery({
    queryKey: queryKeys.audit.list(filters),
    queryFn: () => api.get<Paginated<AuditRow>>('/audit', { query: filters as never }),
  });
  const actions = useQuery({ queryKey: ['audit', 'actions'], queryFn: () => api.get<string[]>('/audit/actions') });

  const columns: Column<AuditRow>[] = [
    { key: 'time', header: 'When', primary: true, render: (row) => <span className="small muted">{formatDateTime(row.createdAt)}</span> },
    {
      key: 'actor', header: 'Actor', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{row.actor?.name ?? 'System'}</div>
          <div className="small muted">{row.actorRole ? row.actorRole.replace('_', ' ') : '—'}</div>
        </div>
      ),
    },
    { key: 'action', header: 'Action', primary: true, render: (row) => <Chip tone="neutral">{row.action}</Chip> },
    { key: 'entity', header: 'Entity', hideOnMobile: true, render: (row) => <span className="small">{row.entityType}</span> },
    { key: 'ip', header: 'IP', hideOnMobile: true, render: (row) => <span className="small mono muted">{row.ip ?? '—'}</span> },
    {
      key: 'expand', header: '', hideOnMobile: true,
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpanded(expanded === row.id ? null : row.id); }}>
          {expanded === row.id ? 'Hide' : 'Details'}
        </Button>
      ),
    },
  ];

  const expandedRow = query.data?.items.find((r) => r.id === expanded);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Audit Log" subtitle="Immutable record of every sensitive action. Entries can never be edited or deleted." />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => setExpanded(expanded === row.id ? null : row.id)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No audit entries match these filters"
        toolbar={
          <FilterBar>
            <div className="filter-bar__search">
              <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search actions…" />
            </div>
            <div style={{ width: 215 }}>
              <Select aria-label="Action" placeholder="All actions"
                options={(actions.data ?? []).map((a) => ({ value: a, label: a }))}
                value={String(filters.action ?? '')} onChange={(e) => setFilter('action', e.target.value)} />
            </div>
            <div style={{ width: 165 }}>
              <Select aria-label="Actor role" placeholder="All roles"
                options={ROLES.map((r) => ({ value: r, label: r.replace('_', ' ') }))}
                value={String(filters.actorRole ?? '')} onChange={(e) => setFilter('actorRole', e.target.value)} />
            </div>
            <div style={{ width: 175 }}>
              <Select aria-label="Entity type" placeholder="All entities"
                options={['User', 'Campaign', 'PostSubmission', 'Redemption', 'Reward', 'AppSetting', 'RiskFlag', 'PayoutRequest'].map((e) => ({ value: e, label: e }))}
                value={String(filters.entityType ?? '')} onChange={(e) => setFilter('entityType', e.target.value)} />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />

      {expandedRow ? (
        <Card>
          <CardBody className="stack" style={{ gap: 14 }}>
            <div className="row-between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{expandedRow.action}</div>
                <div className="small muted mono">{expandedRow.entityType} {expandedRow.entityId ?? ''}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(null)}>Close</Button>
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 6, fontWeight: 600 }}>Changes</div>
              <JsonDiff before={expandedRow.before} after={expandedRow.after} />
            </div>
            {expandedRow.metadata ? (
              <div>
                <div className="small muted" style={{ marginBottom: 6, fontWeight: 600 }}>Metadata</div>
                <pre style={{ fontSize: 12, background: 'var(--background)', padding: 12, borderRadius: 'var(--radius)', overflow: 'auto', margin: 0 }}>
                  {JSON.stringify(expandedRow.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
