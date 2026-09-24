import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardHeader } from './Card';
import { EmptyState } from './States';
import type { ReactNode } from 'react';
import { formatCompact } from '@/utils/format';

const PALETTE = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

const axisProps = {
  stroke: 'var(--muted-light)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function tooltipStyle() {
  return {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    boxShadow: 'var(--shadow-md)',
    color: 'var(--foreground)',
  };
}

/** Shortens ISO day labels to "12 Sep" so the axis stays legible. */
function shortLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  return value;
}

export function ChartCard({ title, subtitle, action, children, empty }: {
  title: string; subtitle?: string; action?: ReactNode; children: ReactNode; empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className="card__body">
        {empty ? <EmptyState title="No data for this period" body="Once activity starts, the chart will populate here." /> : children}
      </div>
    </Card>
  );
}

export interface SeriesConfig { key: string; label: string; color?: string; }

export function TrendChart({ data, series, height = 260, stacked }: {
  data: Record<string, string | number>[]; series: SeriesConfig[]; height?: number; stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color ?? PALETTE[i % PALETTE.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortLabel} {...axisProps} minTickGap={24} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} {...axisProps} width={52} />
        <Tooltip contentStyle={tooltipStyle()} labelFormatter={shortLabel} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? 'a' : undefined}
            stroke={s.color ?? PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({ data, series, height = 260 }: {
  data: Record<string, string | number>[]; series: SeriesConfig[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortLabel} {...axisProps} minTickGap={16} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} {...axisProps} width={52} />
        <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: 'var(--accent-soft)' }} labelFormatter={shortLabel} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} maxBarSize={38} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeriesChart({ data, series, height = 260 }: {
  data: Record<string, string | number>[]; series: SeriesConfig[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tickFormatter={shortLabel} {...axisProps} minTickGap={24} />
        <YAxis tickFormatter={(v) => formatCompact(Number(v))} {...axisProps} width={52} />
        <Tooltip contentStyle={tooltipStyle()} labelFormatter={shortLabel} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle()} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
