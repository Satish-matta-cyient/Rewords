import type { ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { ApiError } from '@/api/client';

export function EmptyState({ title, body, action, icon }: {
  title: string; body?: string; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden>
        {icon ?? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M8 4v16" />
          </svg>
        )}
      </div>
      <div className="empty-state__title">{title}</div>
      {body ? <p className="empty-state__body">{body}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isApi = error instanceof ApiError;
  const message = isApi ? error.message : 'We could not load this information.';
  return (
    <div className="error-state">
      <div className="empty-state__icon" style={{ margin: '0 auto 10px', background: 'var(--destructive-soft)', color: 'var(--destructive)' }} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
        </svg>
      </div>
      <div className="empty-state__title">Something went wrong</div>
      <p className="empty-state__body" style={{ margin: '4px auto 0' }}>{message}</p>
      {onRetry ? <div style={{ marginTop: 14 }}><Button variant="secondary" onClick={onRetry}>Try again</Button></div> : null}
      {isApi && error.requestId ? <div className="error-state__code">Reference: {error.requestId}</div> : null}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius }: { width?: number | string; height?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden />;
}

/** Skeletons mirror the real layout so there is no jump when data lands. */
export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}><div className="stat-card"><Skeleton width={38} height={38} radius={10} /><div style={{ height: 14 }} /><Skeleton width="55%" height={13} /><div style={{ height: 8 }} /><Skeleton width="42%" height={30} /></div></Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ padding: 16 }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="row" style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} style={{ flex: c === 0 ? 2 : 1 }}><Skeleton height={13} width={c === 0 ? '70%' : '50%'} /></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}><Skeleton height={150} radius={0} /><div className="card__body"><Skeleton width="72%" height={16} /><div style={{ height: 10 }} /><Skeleton width="50%" height={13} /></div></Card>
      ))}
    </div>
  );
}

/**
 * Single entry point for the four data states, so no page can accidentally
 * render a blank screen.
 */
export function AsyncBoundary<T>({ query, skeleton, empty, isEmpty, children }: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => void };
  skeleton: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (!query.data) return <ErrorState error={null} onRetry={query.refetch} />;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
