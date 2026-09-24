import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { rewardApi, type RewardItem } from './api';
import { redemptionApi } from '@/features/redemptions/api';
import { walletApi } from '@/features/wallet/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  Card, CardBody, SearchInput, Select, Button, CardGridSkeleton, EmptyState,
  ErrorState, Pagination, FilterBar, PageHeader, ConfirmDialog, Chip,
} from '@/components/ui';
import { RewardCard } from './components/RewardCard';
import { formatCurrency, formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

function FeaturedReward({ reward, balance, onRedeem }: { reward: RewardItem; balance: number; onRedeem: (r: RewardItem) => void }) {
  const affordable = balance >= reward.pointsCost;
  return (
    <Card style={{ overflow: 'hidden' }}>
      <CardBody className="row-between wrap" style={{ gap: 24, padding: 28 }}>
        <div style={{ maxWidth: 520 }}>
          <Chip tone="warning">★ Featured Offer</Chip>
          <h2 style={{ fontSize: 34, marginTop: 12, letterSpacing: '-0.03em' }}>{reward.title}</h2>
          <p className="muted small" style={{ marginTop: 8, lineHeight: 1.6 }}>{reward.description}</p>
          <div className="row" style={{ gap: 26, marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>
                {formatNumber(reward.pointsCost)} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>Points</span>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 26 }}>
              <div className="small muted">Balance after redemption</div>
              <div style={{ fontWeight: 600 }}>{formatNumber(Math.max(0, balance - reward.pointsCost))} Pts</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <Button size="lg" disabled={!affordable || !reward.inStock} onClick={() => onRedeem(reward)}>
            {reward.inStock ? (affordable ? 'Redeem Now' : 'Not enough points') : 'Out of stock'}
          </Button>
          <div className="small muted" style={{ marginTop: 8 }}>Instant delivery to your account</div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function RewardsPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<RewardItem | null>(null);
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters({ pageSize: 12 });

  const rewards = useQuery({ queryKey: queryKeys.rewards.list(filters), queryFn: () => rewardApi.list(filters) });
  const categories = useQuery({ queryKey: queryKeys.rewards.categories, queryFn: rewardApi.categories });
  const wallet = useQuery({ queryKey: queryKeys.wallet.summary, queryFn: walletApi.summary });

  const redeem = useMutation({
    mutationFn: (reward: RewardItem) => redemptionApi.create(reward.id, 1),
    onSuccess: (result) => {
      toast.success('Redemption requested', 'Your points are locked while we review it.');
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
      void queryClient.invalidateQueries({ queryKey: ['redemptions'] });
      setPending(null);
      navigate(`/my-redemptions/${result.id}`);
    },
    onError: (error) => {
      toast.error('Could not redeem', error instanceof ApiError ? error.message : undefined);
      setPending(null);
    },
  });

  const featured = rewards.data?.items.find((r) => r.featured);
  const rest = rewards.data?.items.filter((r) => !r.featured) ?? [];
  const balance = wallet.data?.availablePoints ?? 0;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Rewards Shop"
        subtitle={wallet.data ? `${formatNumber(balance)} points available · worth about ${formatCurrency(wallet.data.estimatedValueInr)}` : undefined}
      />

      {featured ? <FeaturedReward reward={featured} balance={balance} onRedeem={setPending} /> : null}

      <Card className="card--flush">
        <FilterBar>
          <div className="filter-bar__search">
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search rewards…" />
          </div>
          <div style={{ width: 180 }}>
            <Select
              aria-label="Filter by category" placeholder="All categories"
              options={(categories.data ?? []).map((c) => ({ value: c.key, label: c.name }))}
              value={String(filters.categoryKey ?? '')}
              onChange={(e) => setFilter('categoryKey', e.target.value)}
            />
          </div>
          <div style={{ width: 170 }}>
            <Select
              aria-label="Filter by points" placeholder="Any points range"
              options={[
                { value: '2500', label: 'Under 2,500' },
                { value: '5000', label: 'Under 5,000' },
                { value: '10000', label: 'Under 10,000' },
              ]}
              value={String(filters.maxPoints ?? '')}
              onChange={(e) => setFilter('maxPoints', e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant={filters.affordableOnly ? 'primary' : 'secondary'}
            onClick={() => setFilter('maxPoints', filters.maxPoints ? undefined : balance)}
          >
            I can afford
          </Button>
          {activeCount > 0 ? <Button size="sm" variant="ghost" onClick={reset}>Clear</Button> : null}
        </FilterBar>
      </Card>

      <h2 style={{ fontSize: 18 }}>Explore Rewards</h2>

      {rewards.isPending ? <CardGridSkeleton /> : null}
      {rewards.isError ? <Card><ErrorState error={rewards.error} onRetry={rewards.refetch} /></Card> : null}

      {rewards.data ? (
        rest.length === 0 ? (
          <Card>
            <EmptyState
              title="No rewards match your filters"
              body="Try widening the points range or clearing the category filter."
              action={<Button variant="secondary" onClick={reset}>Clear filters</Button>}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-3">
              {rest.map((reward) => <RewardCard key={reward.id} reward={reward} onRedeem={setPending} />)}
            </div>
            <Card className="card--flush"><Pagination meta={rewards.data.pagination} onChange={setPage} /></Card>
          </>
        )
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && redeem.mutate(pending)}
        loading={redeem.isPending}
        title={`Redeem ${pending?.title ?? ''}?`}
        description={
          pending
            ? `${formatNumber(pending.pointsCost)} points will be locked immediately and deducted once an administrator approves the redemption. Your balance afterwards will be ${formatNumber(Math.max(0, balance - pending.pointsCost))} points.`
            : ''
        }
        confirmLabel="Confirm redemption"
      />
    </div>
  );
}
