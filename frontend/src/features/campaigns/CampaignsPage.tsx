import { useQuery } from '@tanstack/react-query';
import { campaignApi } from './api';
import { queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  PageHeader, SearchInput, Select, Card, CardGridSkeleton, EmptyState,
  ErrorState, Pagination, FilterBar, Button,
} from '@/components/ui';
import { CampaignCard } from './components/CampaignCard';
import { PLATFORMS } from '@shared/constants';
import { Link } from 'react-router-dom';

export default function CampaignsPage() {
  const { filters, setFilter, setPage, reset, searchInput, setSearchInput, activeCount } = useFilters({ pageSize: 12 });
  const query = useQuery({
    queryKey: queryKeys.campaigns.list(filters),
    queryFn: () => campaignApi.list(filters),
  });

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader title="Campaigns" subtitle="Promote a campaign, submit your post and earn points" />

      <Card className="card--flush">
        <FilterBar>
          <div className="filter-bar__search">
            <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Search campaigns…" />
          </div>
          <div style={{ width: 170 }}>
            <Select
              aria-label="Filter by platform"
              placeholder="All platforms"
              options={PLATFORMS.map((p) => ({ value: p, label: p }))}
              value={String(filters.platform ?? '')}
              onChange={(e) => setFilter('platform', e.target.value)}
            />
          </div>
          {activeCount > 0 ? <Button variant="ghost" size="sm" onClick={reset}>Clear filters</Button> : null}
        </FilterBar>
      </Card>

      {query.isPending ? <CardGridSkeleton /> : null}
      {query.isError ? <Card><ErrorState error={query.error} onRetry={query.refetch} /></Card> : null}

      {query.data ? (
        query.data.items.length === 0 ? (
          <Card>
            <EmptyState
              title="No campaigns match your filters"
              body="Try clearing the filters, or check back soon — new campaigns launch regularly."
              action={<Button variant="secondary" onClick={reset}>Clear filters</Button>}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-3">
              {query.data.items.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
            </div>
            <Card className="card--flush"><Pagination meta={query.data.pagination} onChange={setPage} /></Card>
          </>
        )
      ) : null}
    </div>
  );
}
