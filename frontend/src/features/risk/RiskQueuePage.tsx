import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  DataTable, FilterBar, Select, Chip, StatusChip, PageHeader, Button,
  Drawer, Textarea, ConfirmDialog, type Column,
} from '@/components/ui';
import { formatDateTime, titleCase } from '@/utils/format';
import { toast } from '@/store/uiStore';
import type { Paginated } from '@shared/types';
import { RISK_SEVERITY, RISK_STATUS, RISK_TYPES } from '@shared/constants';

interface RiskFlag {
  id: string; type: string; severity: string; status: string; score: number;
  summary: string; createdAt: string;
  user: { id: string; fullName: string; email: string; status: string };
}

interface RiskDetail extends RiskFlag {
  evidence: Record<string, unknown> | null;
  events: { id: string; type: string; weight: number; detail: string | null; createdAt: string }[];
}

export default function RiskQueuePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'DISMISSED' | 'ACTIONED' | null>(null);
  const { filters, setFilter, setPage, reset, activeCount } = useFilters({ status: 'OPEN' });

  const query = useQuery({
    queryKey: queryKeys.risk.list(filters),
    queryFn: () => api.get<Paginated<RiskFlag>>('/risk', { query: filters as never }),
  });

  const detail = useQuery({
    queryKey: queryKeys.risk.detail(activeId ?? ''),
    queryFn: () => api.get<RiskDetail>(`/risk/${activeId}`),
    enabled: Boolean(activeId),
  });

  const resolve = useMutation({
    mutationFn: () => api.post(`/risk/${activeId}/resolve`, { decision, note }),
    onSuccess: () => {
      toast.success(decision === 'DISMISSED' ? 'Flag dismissed' : 'Flag actioned');
      void queryClient.invalidateQueries({ queryKey: ['risk'] });
      void queryClient.invalidateQueries({ queryKey: ['badges'] });
      setActiveId(null); setNote(''); setDecision(null);
    },
    onError: () => { toast.error('Could not resolve the flag'); setDecision(null); },
  });

  const columns: Column<RiskFlag>[] = [
    {
      key: 'user', header: 'Account', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.user.fullName}</div>
          <div className="small muted">{row.user.email}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Signal', primary: true, render: (row) => <Chip tone="neutral">{titleCase(row.type)}</Chip> },
    { key: 'summary', header: 'Detail', hideOnMobile: true, render: (row) => <span className="small">{row.summary}</span> },
    {
      key: 'severity', header: 'Severity', primary: true,
      render: (row) => <Chip tone={row.severity === 'CRITICAL' || row.severity === 'HIGH' ? 'danger' : row.severity === 'MEDIUM' ? 'warning' : 'neutral'}>{row.severity}</Chip>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'created', header: 'Raised', hideOnMobile: true, render: (row) => <span className="small muted">{formatDateTime(row.createdAt)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Fraud & Risk" subtitle="Automated signals awaiting a human decision" />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        onRowClick={(row) => setActiveId(row.id)}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        emptyTitle="No flags to review"
        emptyBody="The risk engine has not raised anything matching these filters."
        toolbar={
          <FilterBar>
            <div style={{ width: 170 }}>
              <Select aria-label="Status" placeholder="All statuses"
                options={RISK_STATUS.map((s) => ({ value: s, label: titleCase(s) }))}
                value={String(filters.status ?? '')} onChange={(e) => setFilter('status', e.target.value)} />
            </div>
            <div style={{ width: 155 }}>
              <Select aria-label="Severity" placeholder="Any severity"
                options={RISK_SEVERITY.map((s) => ({ value: s, label: titleCase(s) }))}
                value={String(filters.severity ?? '')} onChange={(e) => setFilter('severity', e.target.value)} />
            </div>
            <div style={{ width: 195 }}>
              <Select aria-label="Signal type" placeholder="All signals"
                options={RISK_TYPES.map((t) => ({ value: t, label: titleCase(t) }))}
                value={String(filters.type ?? '')} onChange={(e) => setFilter('type', e.target.value)} />
            </div>
            {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
          </FilterBar>
        }
      />

      <Drawer
        open={activeId !== null}
        onClose={() => { setActiveId(null); setNote(''); }}
        title="Risk flag"
        subtitle={detail.data ? titleCase(detail.data.type) : undefined}
        footer={detail.data && ['OPEN', 'UNDER_REVIEW'].includes(detail.data.status) ? (
          <>
            <Button variant="secondary" disabled={note.trim().length < 3} onClick={() => setDecision('DISMISSED')}>Dismiss</Button>
            <Button variant="danger" className="grow" disabled={note.trim().length < 3} onClick={() => setDecision('ACTIONED')}>Action this flag</Button>
          </>
        ) : undefined}
      >
        {detail.data ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row-between small">
                <span className="muted">Account</span>
                <Link to={`/admin/users/${detail.data.user.id}`}>{detail.data.user.fullName}</Link>
              </div>
              <div className="row-between small"><span className="muted">Email</span><span>{detail.data.user.email}</span></div>
              <div className="row-between small"><span className="muted">Risk score contribution</span><span style={{ fontWeight: 600 }}>{detail.data.score}</span></div>
              <div className="row-between small"><span className="muted">Raised</span><span>{formatDateTime(detail.data.createdAt)}</span></div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 5 }}>What was detected</div>
              <p className="small muted">{detail.data.summary}</p>
            </div>

            {detail.data.evidence ? (
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 5 }}>Evidence</div>
                <pre style={{
                  fontSize: 12, background: 'var(--background)', padding: 12,
                  borderRadius: 'var(--radius)', overflow: 'auto', margin: 0,
                }}>{JSON.stringify(detail.data.evidence, null, 2)}</pre>
              </div>
            ) : null}

            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Detection history</div>
              <div className="stack" style={{ gap: 6 }}>
                {detail.data.events.map((event) => (
                  <div key={event.id} className="row-between small" style={{ padding: '8px 10px', background: 'var(--background)', borderRadius: 'var(--radius-sm)' }}>
                    <span>{event.detail ?? titleCase(event.type)}</span>
                    <span className="muted">{formatDateTime(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Textarea
              label="Resolution note"
              required
              hint="Recorded in the audit log. If you action the flag the ambassador is notified with this text."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        onConfirm={() => resolve.mutate()}
        loading={resolve.isPending}
        destructive={decision === 'ACTIONED'}
        title={decision === 'DISMISSED' ? 'Dismiss this flag?' : 'Action this flag?'}
        description={
          decision === 'DISMISSED'
            ? "The flag is closed as a false positive and its contribution is removed from the account's risk score."
            : 'The flag is recorded as actioned and the ambassador is notified. Suspend the account separately from their profile if that is warranted.'
        }
        confirmLabel={decision === 'DISMISSED' ? 'Dismiss flag' : 'Confirm action'}
      />
    </div>
  );
}
