import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, PageHeader, Button, Select, Skeleton,
  EmptyState, Chip,
} from '@/components/ui';
import { downloadBlob } from '@/utils/download';
import { toast } from '@/store/uiStore';
import { daysAgoIso, todayIso } from '@/utils/range';
import { formatDate } from '@/utils/format';

interface ReportDefinition { key: string; label: string; columns: string[] }
interface ReportResult { key: string; label: string; columns: string[]; rows: Record<string, unknown>[]; window: { from: string; to: string } }

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

export default function ReportsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState('30');

  const catalogue = useQuery({ queryKey: queryKeys.reports.catalogue, queryFn: () => api.get<ReportDefinition[]>('/reports') });

  const preview = useQuery({
    queryKey: queryKeys.reports.run(selected ?? '', range),
    queryFn: () => api.get<ReportResult>(`/reports/${selected}`, { query: { from: daysAgoIso(Number(range)), to: todayIso() } }),
    enabled: Boolean(selected),
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const blob = await api.download(`/reports/${selected}/export`, { from: daysAgoIso(Number(range)), to: todayIso() });
      downloadBlob(blob, `${selected}-${new Date().toISOString().slice(0, 10)}.csv`);
    },
    onSuccess: () => toast.success('Export downloaded'),
    onError: () => toast.error('Export failed'),
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Reports"
        subtitle="Operational and financial exports, generated from live data"
        action={
          <div className="row" style={{ gap: 8 }}>
            <div style={{ width: 175 }}>
              <Select options={RANGES} value={range} onChange={(e) => setRange(e.target.value)} aria-label="Reporting period" />
            </div>
            <Button disabled={!selected} loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>Export CSV</Button>
          </div>
        }
      />

      <div className="grid grid-main">
        <div className="stack">
          {selected && preview.isPending ? <Card><CardBody><Skeleton height={300} /></CardBody></Card> : null}

          {!selected ? (
            <Card>
              <EmptyState
                title="Choose a report"
                body="Pick a report from the list to preview the data, then export it as CSV."
              />
            </Card>
          ) : null}

          {preview.data ? (
            <Card className="card--flush">
              <CardHeader
                title={preview.data.label}
                subtitle={`${preview.data.rows.length} row(s) · ${formatDate(preview.data.window.from)} to ${formatDate(preview.data.window.to)}`}
              />
              {preview.data.rows.length === 0 ? (
                <EmptyState title="No data in this period" body="Try widening the reporting window." />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>{preview.data.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.data.rows.slice(0, 50).map((row, index) => (
                        <tr key={index}>
                          {preview.data.columns.map((column) => (
                            <td key={column} className="small">
                              <span className="truncate" style={{ display: 'block', maxWidth: 220 }}>
                                {String(row[column] ?? '—')}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.data.rows.length > 50 ? (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                  <span className="small muted">
                    Showing the first 50 of {preview.data.rows.length} rows. Export the CSV for the complete dataset.
                  </span>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader title="Available reports" />
          <CardBody className="stack" style={{ gap: 6 }}>
            {catalogue.isPending ? <Skeleton height={220} /> : null}
            {catalogue.data?.map((report) => (
              <button
                key={report.key}
                type="button"
                onClick={() => setSelected(report.key)}
                aria-pressed={selected === report.key}
                className="row-between"
                style={{
                  padding: '10px 12px', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: selected === report.key ? 'var(--accent-soft)' : 'transparent',
                  border: `1px solid ${selected === report.key ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: selected === report.key ? 600 : 500 }}>{report.label}</span>
                <Chip tone="neutral">{report.columns.length} cols</Chip>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
