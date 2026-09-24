import type { ReactNode } from 'react';
import { Card } from './Card';
import { TrendPill } from './Status';
import { formatCurrency, formatNumber } from '@/utils/format';

export interface StatCardProps {
  label: string;
  value: number;
  hint?: string;
  delta?: number;
  icon?: ReactNode;
  format?: 'number' | 'currency';
  chip?: ReactNode;
}

export function StatCard({ label, value, hint, delta, icon, format = 'number', chip }: StatCardProps) {
  return (
    <Card>
      <div className="stat-card">
        <div className="stat-card__head">
          <span className="stat-card__icon" aria-hidden>{icon ?? <DefaultIcon />}</span>
          {chip}
        </div>
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{format === 'currency' ? formatCurrency(value) : formatNumber(value)}</div>
        <div className="row" style={{ gap: 6 }}>
          {delta !== undefined && delta !== 0 ? <TrendPill value={delta} /> : null}
          {hint ? <span className="stat-card__hint">{hint}</span> : null}
        </div>
      </div>
    </Card>
  );
}

function DefaultIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" />
    </svg>
  );
}

export function StatGrid({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid grid-4">
      {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
    </div>
  );
}
