import { useState, type ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { EmptyState, ErrorState, TableSkeleton } from './States';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { PaginationMeta } from '@shared/types';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  sortable?: boolean;
  /** Columns marked primary stay visible in the stacked mobile card view. */
  primary?: boolean;
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  sort?: { by: string; direction: 'asc' | 'desc' };
  onSortChange?: (by: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  selection?: { selected: string[]; onChange: (ids: string[]) => void };
}

export function DataTable<T>({
  columns, rows, rowKey, loading, error, onRetry, onRowClick,
  pagination, onPageChange, sort, onSortChange,
  emptyTitle = 'Nothing here yet', emptyBody, emptyAction, toolbar, selection,
}: DataTableProps<T>) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (error) return <Card>{toolbar}<ErrorState error={error} onRetry={onRetry} /></Card>;
  if (loading) return <Card>{toolbar}<TableSkeleton columns={columns.length} /></Card>;
  if (rows.length === 0) {
    return <Card>{toolbar}<EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} /></Card>;
  }

  const allSelected = selection ? rows.every((r) => selection.selected.includes(rowKey(r))) : false;

  const toggleAll = () => {
    if (!selection) return;
    selection.onChange(allSelected ? [] : rows.map(rowKey));
  };

  const toggleOne = (id: string) => {
    if (!selection) return;
    selection.onChange(
      selection.selected.includes(id) ? selection.selected.filter((s) => s !== id) : [...selection.selected, id],
    );
  };

  // On narrow screens the table becomes a list of cards — no horizontal scroll.
  if (isMobile) {
    const visible = columns.filter((c) => !c.hideOnMobile);
    return (
      <div className="stack">
        {toolbar ? <Card>{toolbar}</Card> : null}
        <div className="card-list">
          {rows.map((row) => (
            <Card
              key={rowKey(row)}
              interactive={Boolean(onRowClick)}
              className="record-card"
              onClick={() => onRowClick?.(row)}
            >
              {visible.map((col) => (
                <div key={col.key} className="record-card__row">
                  <span className="record-card__key">{col.header}</span>
                  <span style={{ textAlign: 'right', fontWeight: col.primary ? 600 : 400 }}>{col.render(row)}</span>
                </div>
              ))}
            </Card>
          ))}
        </div>
        {pagination ? <Pagination meta={pagination} onChange={onPageChange} /> : null}
      </div>
    );
  }

  return (
    <Card className="card--flush">
      {toolbar}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {selection ? (
                <th style={{ width: 44 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.numeric ? 'table__num' : undefined}
                  aria-sort={col.sortable ? (sort?.by === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                  onClick={col.sortable ? () => onSortChange?.(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && sort?.by === col.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  data-clickable={Boolean(onRowClick)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined}
                >
                  {selection ? (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selection.selected.includes(id)}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select row ${id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.key} className={col.numeric ? 'table__num' : undefined}>{col.render(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination ? <Pagination meta={pagination} onChange={onPageChange} /> : null}
    </Card>
  );
}

export function Pagination({ meta, onChange }: { meta: PaginationMeta; onChange?: (page: number) => void }) {
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="pagination">
      <span className="pagination__info">
        Showing <strong>{first}–{last}</strong> of <strong>{meta.total.toLocaleString()}</strong>
      </span>
      <div className="pagination__controls">
        <Button size="sm" variant="secondary" disabled={!meta.hasPrev} onClick={() => onChange?.(meta.page - 1)}>Previous</Button>
        <span className="small muted" style={{ padding: '0 6px' }}>Page {meta.page} of {meta.totalPages}</span>
        <Button size="sm" variant="secondary" disabled={!meta.hasNext} onClick={() => onChange?.(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>;
}

export function useSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  return { selected, onChange: setSelected, clear: () => setSelected([]) };
}
