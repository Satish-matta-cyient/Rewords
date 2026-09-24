import type { ReactNode } from 'react';
import { titleCase, formatNumber } from '@/utils/format';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const STATUS_TONES: Record<string, Tone> = {
  // Submissions
  DRAFT: 'neutral', PENDING: 'warning', UNDER_REVIEW: 'info', INFO_REQUESTED: 'warning',
  APPROVED: 'success', REJECTED: 'danger', REVERSED: 'danger', EXPIRED: 'neutral',
  // Campaigns
  SCHEDULED: 'info', ACTIVE: 'success', PAUSED: 'warning', COMPLETED: 'neutral', ARCHIVED: 'neutral',
  // Redemptions
  REQUESTED: 'warning', POINTS_LOCKED: 'info', FULFILLED: 'success', CANCELLED: 'neutral',
  // Users
  PENDING_VERIFICATION: 'warning', SUSPENDED: 'danger', DEACTIVATED: 'neutral',
  // Risk / tickets
  OPEN: 'warning', DISMISSED: 'neutral', ACTIONED: 'success',
  IN_PROGRESS: 'info', WAITING_FOR_USER: 'warning', RESOLVED: 'success', CLOSED: 'neutral',
  LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger', URGENT: 'danger',
  VERIFIED: 'success', SUBMITTED: 'info', PROCESSING: 'info', FAILED: 'danger',
};

export function StatusChip({ status, dot = true }: { status: string; dot?: boolean }) {
  const tone = STATUS_TONES[status] ?? 'neutral';
  return (
    <span className={`chip chip--${tone}`}>
      {dot ? <span className="chip__dot" aria-hidden /> : null}
      {titleCase(status)}
    </span>
  );
}

export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function PointsBadge({ points }: { points: number }) {
  return (
    <span className={`points-badge points-badge--${points >= 0 ? 'credit' : 'debit'}`}>
      {points >= 0 ? '+' : '−'}{formatNumber(Math.abs(points))}
    </span>
  );
}

export function TrendPill({ value, suffix = '' }: { value: number; suffix?: string }) {
  const down = value < 0;
  return (
    <span className={`trend-pill${down ? ' trend-pill--down' : ''}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden
        style={{ transform: down ? 'scaleY(-1)' : undefined }}>
        <path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" />
      </svg>
      {value >= 0 ? '+' : ''}{formatNumber(value)}{suffix}
    </span>
  );
}

/** SLA banding shown on the verification queue. */
export function SlaChip({ sla, ageHours }: { sla: string; ageHours: number }) {
  if (sla === 'CLOSED') return <span className="small muted">—</span>;
  const tone: Tone = sla === 'CRITICAL' ? 'danger' : sla === 'WARNING' ? 'warning' : 'neutral';
  return <span className={`chip chip--${tone}`}>{ageHours < 24 ? `${Math.round(ageHours)}h` : `${Math.floor(ageHours / 24)}d`}</span>;
}
