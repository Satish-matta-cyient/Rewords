import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { redemptionApi } from './api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatusChip,
  Breadcrumb, Timeline, Button, Chip,
} from '@/components/ui';
import { formatDateTime, formatCurrency, formatNumber } from '@/utils/format';
import { copyToClipboard } from '@/utils/share';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

export default function RedemptionDetailPage() {
  const { id = '' } = useParams();
  const [code, setCode] = useState<string | null>(null);
  const query = useQuery({ queryKey: queryKeys.redemptions.detail(id), queryFn: () => redemptionApi.detail(id) });

  const reveal = useMutation({
    mutationFn: () => redemptionApi.revealVoucher(id),
    onSuccess: (data) => { setCode(data.code); toast.success('Voucher code revealed'); },
    onError: (error) => toast.error('Could not reveal code', error instanceof ApiError ? error.message : undefined),
  });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={26} width="40%" /><Skeleton height={300} /></div>}>
      {(redemption) => (
        <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
          <Breadcrumb items={[{ label: 'My Redemptions', to: '/my-redemptions' }, { label: redemption.reference }]} />

          <div className="row-between wrap">
            <div>
              <h1 style={{ fontSize: 24 }}>{redemption.reward.title}</h1>
              <p className="muted small mono" style={{ marginTop: 4 }}>{redemption.reference}</p>
            </div>
            <StatusChip status={redemption.status} />
          </div>

          {redemption.status === 'REJECTED' ? (
            <Card style={{ borderColor: 'var(--destructive)', background: 'var(--destructive-soft)' }}>
              <CardBody className="stack" style={{ gap: 4 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--destructive)' }}>This redemption was not approved</div>
                <div className="small">{redemption.rejectionReason}</div>
                <div className="small" style={{ marginTop: 4 }}>
                  Your {formatNumber(redemption.pointsSpent)} points have been returned to your wallet.
                </div>
              </CardBody>
            </Card>
          ) : null}

          {redemption.voucherAvailable ? (
            <Card style={{ borderColor: 'var(--primary)', background: 'var(--accent-soft)' }}>
              <CardBody className="stack" style={{ gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Your voucher code is ready</div>
                  <div className="small muted">Reveal it once and store it somewhere safe.</div>
                </div>
                {code ? (
                  <div className="row" style={{ gap: 8 }}>
                    <code style={{
                      flex: 1, padding: '11px 14px', background: 'var(--card)', border: '1px dashed var(--primary)',
                      borderRadius: 'var(--radius)', fontSize: 17, fontWeight: 700, letterSpacing: '0.08em',
                    }}>{code}</code>
                    <Button variant="secondary" onClick={() => copyToClipboard(code, 'Voucher code copied')}>Copy</Button>
                  </div>
                ) : (
                  <Button loading={reveal.isPending} onClick={() => reveal.mutate()}>Reveal voucher code</Button>
                )}
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-main">
            <Card>
              <CardHeader title="Progress" />
              <CardBody>
                <Timeline
                  items={redemption.timeline.map((step) => ({
                    key: step.key,
                    label: step.label,
                    meta: step.at ? formatDateTime(step.at) : 'Pending',
                    done: step.done,
                    negative: step.negative,
                    detail: step.reason,
                  }))}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Summary" />
              <CardBody className="stack" style={{ gap: 9 }}>
                <div className="row-between small"><span className="muted">Points spent</span><span style={{ fontWeight: 600 }}>{formatNumber(redemption.pointsSpent)}</span></div>
                <div className="row-between small"><span className="muted">Cash value</span><span>{formatCurrency(redemption.cashValue)}</span></div>
                <div className="row-between small"><span className="muted">Delivery</span><Chip tone="neutral">{redemption.reward.deliveryType.replace('_', ' ')}</Chip></div>
                <div className="row-between small"><span className="muted">Requested</span><span>{formatDateTime(redemption.createdAt)}</span></div>
                {redemption.items.map((item) => (
                  <div key={item.id} className="row-between small" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span className="muted">{item.label} × {item.quantity}</span>
                    <span>{formatNumber(item.pointsEach)} pts each</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}
