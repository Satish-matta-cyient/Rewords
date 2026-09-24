import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, Button, Chip, Textarea,
  Breadcrumb, Input, StatCard, Dialog,
} from '@/components/ui';
import { formatDateTime, formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { icons } from '@/layouts/navigation';

interface Inventory {
  reward: { id: string; title: string; pointsCost: number; deliveryType: string };
  counts: { unused: number; reserved: number; assigned: number; used: number; expired: number };
  codes: { id: string; code: string; status: string; assignedAt: string | null; expiresAt: string | null; batchRef: string | null }[];
}

export default function VoucherDetailPage() {
  const { id = '' } = useParams();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [batchRef, setBatchRef] = useState('');

  const query = useQuery({ queryKey: queryKeys.vouchers.detail(id), queryFn: () => api.get<Inventory>(`/vouchers/${id}`) });

  const importCodes = useMutation({
    mutationFn: () => api.post<{ imported: number; skipped: number; duplicatesInFile: number }>(`/vouchers/${id}/codes`, { csv, batchRef: batchRef || undefined }),
    onSuccess: (result) => {
      toast.success(
        `${result.imported} code(s) imported`,
        result.skipped > 0 ? `${result.skipped} were already in the pool and were skipped.` : undefined,
      );
      void queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      setOpen(false); setCsv(''); setBatchRef('');
    },
    onError: (error) => toast.error('Import failed', error instanceof ApiError ? error.message : undefined),
  });

  const codeCount = csv.split(/[\r\n,;]+/).map((c) => c.trim()).filter(Boolean).length;

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={28} width="40%" /><Skeleton height={300} /></div>}>
      {(inventory) => (
        <div className="stack" style={{ gap: 18 }}>
          <Breadcrumb items={[{ label: 'Voucher Inventory', to: '/super-admin/vouchers' }, { label: inventory.reward.title }]} />

          <div className="row-between wrap">
            <div>
              <h1 style={{ fontSize: 24 }}>{inventory.reward.title}</h1>
              <p className="muted small" style={{ marginTop: 3 }}>{formatNumber(inventory.reward.pointsCost)} points per redemption</p>
            </div>
            <Button onClick={() => setOpen(true)}>Upload codes</Button>
          </div>

          <div className="grid grid-4">
            <StatCard label="Unused" value={inventory.counts.unused} icon={icons.vouchers} hint="Ready to assign" />
            <StatCard label="Assigned" value={inventory.counts.assigned} icon={icons.redemptions} hint="Delivered to ambassadors" />
            <StatCard label="Used" value={inventory.counts.used} icon={icons.rewards} hint="Revealed by the recipient" />
            <StatCard label="Expired" value={inventory.counts.expired} icon={icons.risk} />
          </div>

          <Card className="card--flush">
            <CardHeader title="Recent codes" subtitle="Codes are masked here — only the recipient can ever reveal the full value" />
            <CardBody>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Code</th><th>Status</th><th>Batch</th><th>Assigned</th><th>Expires</th></tr>
                  </thead>
                  <tbody>
                    {inventory.codes.map((code) => (
                      <tr key={code.id}>
                        <td className="mono">{code.code}</td>
                        <td>
                          <Chip tone={code.status === 'UNUSED' ? 'success' : code.status === 'EXPIRED' ? 'danger' : 'neutral'}>
                            {code.status}
                          </Chip>
                        </td>
                        <td className="small muted">{code.batchRef ?? '—'}</td>
                        <td className="small muted">{code.assignedAt ? formatDateTime(code.assignedAt) : '—'}</td>
                        <td className="small muted">{code.expiresAt ? formatDateTime(code.expiresAt) : 'Never'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Upload voucher codes"
            description="Paste codes separated by new lines or commas. Codes already in this pool are skipped rather than duplicated."
            footer={
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={codeCount === 0} loading={importCodes.isPending} onClick={() => importCodes.mutate()}>
                  Import {codeCount > 0 ? `${codeCount} code(s)` : ''}
                </Button>
              </>
            }
          >
            <div className="stack">
              <Input label="Batch reference" placeholder="e.g. AMZN-OCT-2026" hint="Optional — helps you trace a supplier batch later." value={batchRef} onChange={(e) => setBatchRef(e.target.value)} />
              <Textarea
                label="Codes"
                placeholder={'AMZ-1234-5678\nAMZ-2345-6789\nAMZ-3456-7890'}
                style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 13 }}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
              />
              <div className="row-between small muted">
                <span>{codeCount} code(s) detected</span>
                <button type="button" className="small" style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv,.txt';
                    input.onchange = async () => { const f = input.files?.[0]; if (f) setCsv(await f.text()); }; input.click(); }}>
                  Load from a CSV file
                </button>
              </div>
            </div>
          </Dialog>
        </div>
      )}
    </AsyncBoundary>
  );
}
