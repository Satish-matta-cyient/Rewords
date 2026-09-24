import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/tests/utils';
import { Button, IconButton } from './Button';
import { Input, Checkbox } from './Input';
import { StatusChip, PointsBadge } from './Status';
import { EmptyState } from './States';
import { DataTable, type Column } from './DataTable';

describe('Button', () => {
  it('shows a spinner and blocks clicks while loading', () => {
    const onClick = vi.fn();
    renderWithProviders(<Button loading onClick={onClick}>Approve</Button>);
    const button = screen.getByRole('button', { name: /approve/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('always exposes an accessible name', () => {
    renderWithProviders(<IconButton label="Close panel"><span>×</span></IconButton>);
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('links its error message and marks the field invalid', () => {
    renderWithProviders(<Input label="Email" error="Enter a valid email address" />);
    const input = screen.getByLabelText(/email/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
  });

  it('shows a hint when there is no error', () => {
    renderWithProviders(<Input label="Password" hint="At least 10 characters" />);
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  it('toggles and reports its state', () => {
    const onChange = vi.fn();
    renderWithProviders(<Checkbox label="I agree to the terms" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/i agree/i));
    expect(onChange).toHaveBeenCalled();
  });
});

describe('Status components', () => {
  it('renders human-readable status labels', () => {
    renderWithProviders(<StatusChip status="UNDER_REVIEW" />);
    expect(screen.getByText('Under Review')).toBeInTheDocument();
  });

  it('formats credits and debits distinctly', () => {
    const { rerender } = renderWithProviders(<PointsBadge points={1500} />);
    expect(screen.getByText(/\+1,500/)).toBeInTheDocument();
    rerender(<PointsBadge points={-250} />);
    expect(screen.getByText(/−250/)).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  interface Row { id: string; name: string; points: number }
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Name', render: (r) => r.name },
    { key: 'points', header: 'Points', numeric: true, render: (r) => r.points },
  ];

  it('renders an empty state rather than a blank table', () => {
    renderWithProviders(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="No submissions yet" />,
    );
    expect(screen.getByText('No submissions yet')).toBeInTheDocument();
  });

  it('renders rows and fires the row click handler', () => {
    const onRowClick = vi.fn();
    renderWithProviders(
      <DataTable
        columns={columns}
        rows={[{ id: '1', name: 'Aarav Sharma', points: 1200 }]}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );
    expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Aarav Sharma'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error state with a retry action', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} error={new Error('boom')} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('renders its title, body and action', () => {
    renderWithProviders(
      <EmptyState title="Nothing here" body="Submit a post to get started." action={<Button>Submit</Button>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });
});
