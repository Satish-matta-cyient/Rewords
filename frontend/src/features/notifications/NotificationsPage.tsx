import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import { useFilters } from '@/hooks/useFilters';
import {
  Card, CardBody, PageHeader, Button, Chip, Skeleton, EmptyState, Pagination,
} from '@/components/ui';
import { formatRelative, titleCase } from '@/utils/format';
import type { Paginated, NotificationItem } from '@shared/types';

const TYPE_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'neutral'> = {
  SUBMISSION_APPROVED: 'success', POINTS_CREDITED: 'success', VOUCHER_DELIVERED: 'success',
  REDEMPTION_APPROVED: 'success', PAYOUT_PROCESSED: 'success',
  SUBMISSION_REJECTED: 'danger', REDEMPTION_REJECTED: 'danger', RISK_ALERT: 'danger',
  INFO_REQUESTED: 'warning', REFERRAL_JOINED: 'primary', REDEMPTION_CREATED: 'info', ANNOUNCEMENT: 'info',
};

export default function NotificationsPage() {
  const { filters, setFilter, setPage } = useFilters();

  const query = useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => api.get<Paginated<NotificationItem> & { unread: number }>('/notifications', { query: filters as never }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => api.patch('/notifications/read-all'), onSuccess: refresh });

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 780 }}>
      <PageHeader
        title="Notifications"
        subtitle={query.data?.unread ? `${query.data.unread} unread` : 'You are all caught up'}
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button
              size="sm"
              variant={filters.unreadOnly ? 'primary' : 'secondary'}
              onClick={() => setFilter('unreadOnly', filters.unreadOnly ? undefined : 'true')}
            >
              Unread only
            </Button>
            <Button size="sm" variant="secondary" disabled={!query.data?.unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          </div>
        }
      />

      {query.isPending ? <Skeleton height={300} /> : null}

      {query.data?.items.length === 0 ? (
        <Card><EmptyState title="Nothing here" body="Approvals, points and reward updates will appear in this list." /></Card>
      ) : null}

      <div className="stack" style={{ gap: 8 }}>
        {query.data?.items.map((notification) => {
          const body = (
            <Card
              interactive={Boolean(notification.link)}
              style={{ borderLeft: `3px solid ${notification.readAt ? 'transparent' : 'var(--primary)'}` }}
            >
              <CardBody className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontWeight: notification.readAt ? 500 : 700, fontSize: 'var(--text-sm)' }}>{notification.title}</span>
                    <Chip tone={TYPE_TONE[notification.type] ?? 'neutral'}>{titleCase(notification.type)}</Chip>
                  </div>
                  <p className="small muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{notification.body}</p>
                  <div className="small muted" style={{ marginTop: 5 }}>{formatRelative(notification.createdAt)}</div>
                </div>
                {!notification.readAt ? (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); markRead.mutate(notification.id); }}>
                    Mark read
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          );

          return notification.link ? (
            <Link key={notification.id} to={notification.link} style={{ textDecoration: 'none', color: 'inherit' }}
              onClick={() => { if (!notification.readAt) markRead.mutate(notification.id); }}>
              {body}
            </Link>
          ) : <div key={notification.id}>{body}</div>;
        })}
      </div>

      {query.data ? <Card className="card--flush"><Pagination meta={query.data.pagination} onChange={setPage} /></Card> : null}
    </div>
  );
}
