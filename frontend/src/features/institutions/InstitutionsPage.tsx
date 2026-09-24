import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  DataTable, PageHeader, Button, Dialog, Input, Select, Chip, type Column,
} from '@/components/ui';
import { formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';

interface Institution {
  id: string; name: string; slug: string; type: string;
  city: string | null; state: string | null; active: boolean;
  users: number; campaigns: number; members: number;
}

export default function InstitutionsPage() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', type: 'COLLEGE', city: '', state: '' });

  const query = useQuery({ queryKey: queryKeys.institutions.list, queryFn: () => api.get<Institution[]>('/institutions') });

  const create = useMutation({
    mutationFn: () => api.post('/institutions', draft),
    onSuccess: () => {
      toast.success('Institution created');
      void queryClient.invalidateQueries({ queryKey: queryKeys.institutions.list });
      setOpen(false); setDraft({ name: '', type: 'COLLEGE', city: '', state: '' });
    },
    onError: () => toast.error('Could not create the institution'),
  });

  const columns: Column<Institution>[] = [
    {
      key: 'name', header: 'Institution', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.name}</div>
          <div className="small muted">{[row.city, row.state].filter(Boolean).join(', ') || '—'}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (row) => <Chip tone="neutral">{row.type}</Chip> },
    { key: 'users', header: 'Ambassadors', numeric: true, primary: true, render: (row) => <span className="mono">{formatNumber(row.users)}</span> },
    { key: 'campaigns', header: 'Campaigns', numeric: true, hideOnMobile: true, render: (row) => <span className="mono">{row.campaigns}</span> },
    { key: 'status', header: 'Status', render: (row) => <Chip tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Active' : 'Inactive'}</Chip> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Institutions"
        subtitle="Colleges and organisations whose ambassadors and campaigns can be scoped separately"
        action={<Button onClick={() => setOpen(true)}>Add institution</Button>}
      />

      <DataTable
        columns={columns}
        rows={query.data ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        emptyTitle="No institutions yet"
        emptyBody="Add a college or organisation to scope ambassadors, campaigns and reporting to it."
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add an institution"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={draft.name.length < 2} loading={create.isPending} onClick={() => create.mutate()}>Create</Button>
          </>
        }
      >
        <div className="stack">
          <Input label="Name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Select
            label="Type"
            options={[{ value: 'COLLEGE', label: 'College' }, { value: 'SCHOOL', label: 'School' }, { value: 'ORGANIZATION', label: 'Organisation' }]}
            value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          />
          <div className="grid grid-2">
            <Input label="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            <Input label="State" value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
