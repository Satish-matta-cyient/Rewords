import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { initials } from '@/utils/format';

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" /> : initials(name)}
    </span>
  );
}

export function ProgressBar({ value, max = 100, tone }: { value: number; max?: number; tone?: 'warning' | 'danger' }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress__fill${tone ? ` progress__fill--${tone}` : ''}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.label} className="row" style={{ gap: 6 }}>
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="breadcrumb__current">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Tabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          type="button"
          className="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="muted"> ({tab.count})</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Timeline({ items }: {
  items: { key: string; label: string; meta?: ReactNode; done?: boolean; negative?: boolean; detail?: ReactNode }[];
}) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <div key={item.key} className="timeline__item">
          <span className={`timeline__dot${item.negative ? ' timeline__dot--negative' : item.done ? ' timeline__dot--done' : ''}`} aria-hidden>
            {item.done || item.negative ? (item.negative ? '✕' : '✓') : ''}
          </span>
          <div className="grow">
            <div className="timeline__label">{item.label}</div>
            {item.meta ? <div className="timeline__meta">{item.meta}</div> : null}
            {item.detail ? <div className="small muted" style={{ marginTop: 4 }}>{item.detail}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, breadcrumb }: {
  title: string; subtitle?: string; action?: ReactNode; breadcrumb?: { label: string; to?: string }[];
}) {
  return (
    <header className="stack" style={{ gap: 8 }}>
      {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="row-between wrap">
        <div>
          <h1 style={{ fontSize: 28 }}>{title}</h1>
          {subtitle ? <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 2 }}>{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tooltip-wrap" data-tooltip>
      {children}
      <span className="tooltip" role="tooltip">{label}</span>
    </span>
  );
}

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}
      style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <img src={src} alt={alt} style={{ maxWidth: '92vw', maxHeight: '88vh', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }} />
    </div>
  );
}
