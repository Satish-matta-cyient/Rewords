import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { rewardApi } from './api';
import { redemptionApi } from '@/features/redemptions/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, Button, Chip,
  Breadcrumb, ConfirmDialog,
} from '@/components/ui';
import { formatCurrency, formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

export default function RewardDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const query = useQuery({ queryKey: queryKeys.rewards.detail(id), queryFn: () => rewardApi.detail(id) });

  const redeem = useMutation({
    mutationFn: () => redemptionApi.create(id, 1),
    onSuccess: (result) => {
      toast.success('Redemption requested', 'Your points are locked while we review it.');
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['redemptions'] });
      navigate(`/my-redemptions/${result.id}`);
    },
    onError: (error) => { toast.error('Could not redeem', error instanceof ApiError ? error.message : undefined); setConfirm(false); },
  });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={26} width="40%" /><Skeleton height={320} /></div>}>
      {(reward) => (
        <div className="stack" style={{ gap: 18, maxWidth: 940 }}>
          <Breadcrumb items={[{ label: 'Rewards', to: '/rewards' }, { label: reward.title }]} />

          <div className="grid grid-main">
            <div className="stack">
              <Card style={{ overflow: 'hidden' }}>
                <div style={{ height: 260, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}>
                  {reward.imageUrl
                    ? <img src={reward.imageUrl} alt={reward.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.2" opacity="0.5"><path d="M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2" /></svg>}
                </div>
                <CardBody className="stack">
                  <div className="row" style={{ gap: 8 }}>
                    <Chip tone="neutral">{reward.categoryName}</Chip>
                    {reward.badge ? <Chip tone="warning">{reward.badge.replace('_', ' ')}</Chip> : null}
                  </div>
                  <h1 style={{ fontSize: 24 }}>{reward.title}</h1>
                  <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--foreground-secondary)' }}>{reward.description}</p>
                </CardBody>
              </Card>

              {reward.terms ? (
                <Card>
                  <CardHeader title="Terms and conditions" />
                  <CardBody><p className="small muted" style={{ lineHeight: 1.7 }}>{reward.terms}</p></CardBody>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardBody className="stack" style={{ gap: 16 }}>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.15 }}>
                    {formatNumber(reward.pointsCost)}
                  </div>
                  <div className="small muted">points · {formatCurrency(reward.cashValue)} value</div>
                </div>

                <div className="stack" style={{ gap: 8 }}>
                  <div className="row-between small">
                    <span className="muted">Availability</span>
                    <span style={{ fontWeight: 600, color: reward.inStock ? 'var(--success)' : 'var(--destructive)' }}>
                      {reward.inStock ? `${reward.stock} in stock` : 'Out of stock'}
                    </span>
                  </div>
                  <div className="row-between small">
                    <span className="muted">Delivery</span>
                    <span>{reward.deliveryType === 'VOUCHER_CODE' ? 'Voucher code' : reward.deliveryType === 'CASH_PAYOUT' ? 'Bank transfer' : 'Manual fulfilment'}</span>
                  </div>
                  {reward.balanceAfter !== null ? (
                    <div className="row-between small">
                      <span className="muted">Balance after</span>
                      <span style={{ fontWeight: 600 }}>{formatNumber(Math.max(0, reward.balanceAfter))} pts</span>
                    </div>
                  ) : null}
                </div>

                <Button size="lg" block disabled={!reward.affordable || !reward.inStock} onClick={() => setConfirm(true)}>
                  {!reward.inStock ? 'Out of stock' : reward.affordable ? 'Redeem this reward' : 'Not enough points'}
                </Button>

                {!reward.affordable && reward.balanceAfter !== null ? (
                  <p className="small muted" style={{ textAlign: 'center' }}>
                    You need {formatNumber(Math.abs(reward.balanceAfter))} more points.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          </div>

          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() => redeem.mutate()}
            loading={redeem.isPending}
            title={`Redeem ${reward.title}?`}
            description={`${formatNumber(reward.pointsCost)} points will be locked now and deducted once an administrator approves this redemption.`}
            confirmLabel="Confirm redemption"
          />
        </div>
      )}
    </AsyncBoundary>
  );
}
