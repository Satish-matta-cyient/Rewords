import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/features/dashboard/api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatCard, PageHeader, DonutChart,
} from '@/components/ui';
import { formatCurrency, formatNumber } from '@/utils/format';
import { icons } from '@/layouts/navigation';

export default function LiabilityPage() {
  const query = useQuery({ queryKey: queryKeys.dashboard.superAdmin('liability'), queryFn: () => dashboardApi.superAdmin({}) });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={30} width="30%" /><Skeleton height={260} /></div>}>
      {(data) => {
        const l = data.liability;
        return (
          <div className="stack" style={{ gap: 20 }}>
            <PageHeader
              title="Liability"
              subtitle="Every unredeemed point is a financial obligation — this is the current exposure"
            />

            <div className="grid grid-3">
              <StatCard label="Outstanding points" value={l.outstandingPoints} icon={icons.wallet} hint="Available plus locked balances" />
              <StatCard label="Estimated INR liability" value={l.estimatedInrLiability} format="currency" icon={icons.liability} hint={`At ${formatCurrency(l.conversionRate)} per point`} />
              <StatCard label="Points already redeemed" value={l.redeemedPoints} icon={icons.rewards} hint="Settled obligations" />
            </div>

            <div className="grid grid-3">
              <StatCard label="Pending redemption points" value={l.pendingRedemptionPoints} icon={icons.redemptions} hint="Locked awaiting approval" />
              <StatCard label="Voucher liability" value={l.voucherLiabilityInr} format="currency" icon={icons.vouchers} hint="Open voucher redemptions" />
              <StatCard label="Cash payout liability" value={l.cashPayoutLiabilityInr} format="currency" icon={icons.liability} hint="Approved but not yet transferred" />
            </div>

            <div className="grid grid-2">
              <Card>
                <CardHeader title="Liability composition" subtitle="Where the exposure sits" />
                <CardBody>
                  <DonutChart
                    data={[
                      { name: 'Unredeemed points', value: Math.max(0, l.estimatedInrLiability - l.voucherLiabilityInr - l.cashPayoutLiabilityInr) },
                      { name: 'Voucher redemptions', value: l.voucherLiabilityInr },
                      { name: 'Cash payouts', value: l.cashPayoutLiabilityInr },
                    ]}
                    height={260}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="How this is calculated" />
                <CardBody className="stack" style={{ gap: 12 }}>
                  <p className="small muted" style={{ lineHeight: 1.7 }}>
                    Outstanding points are the sum of every ambassador&apos;s available and locked balance, taken directly from the
                    materialised wallets. Because wallets are only ever written alongside an append-only ledger entry, this figure
                    reconciles exactly with the ledger.
                  </p>
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="row-between small">
                      <span className="muted">Conversion rate</span>
                      <span style={{ fontWeight: 600 }}>1 point = {formatCurrency(l.conversionRate)}</span>
                    </div>
                    <div className="row-between small">
                      <span className="muted">Outstanding points</span>
                      <span className="mono">{formatNumber(l.outstandingPoints)}</span>
                    </div>
                    <div className="row-between small" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600 }}>Estimated liability</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(l.estimatedInrLiability)}</span>
                    </div>
                  </div>
                  <p className="small muted">
                    Changing the conversion rate affects new valuations only. Historical ledger entries are never rewritten.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}
