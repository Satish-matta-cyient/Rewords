import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import { ticketCreateSchema } from '@shared/schemas';
import {
  DataTable, PageHeader, Button, Dialog, Input, Textarea, Select, StatusChip,
  Chip, Card, CardBody, CardHeader, type Column,
} from '@/components/ui';
import { formatRelative, titleCase } from '@/utils/format';
import { toast } from '@/store/uiStore';
import type { Paginated } from '@shared/types';
import { TICKET_CATEGORY, TICKET_PRIORITY } from '@shared/constants';

type FormValues = z.infer<typeof ticketCreateSchema>;

interface TicketRow {
  id: string; reference: string; subject: string; category: string;
  status: string; priority: string; messages: number; createdAt: string; updatedAt: string;
}

const FAQ = [
  { q: 'When are points credited?', a: 'Points land in your wallet the moment an administrator approves your submission — usually within 24 to 72 hours. Your upline is paid in the same transaction.' },
  { q: 'Why was my post rejected?', a: 'Open the submission from My Submissions; the exact reason is shown there. The most common cause is not tagging the official handle or posting from a private account.' },
  { q: 'How long do voucher codes take?', a: 'For voucher rewards the code is assigned automatically the instant your redemption is approved, and appears on the redemption page.' },
  { q: 'Can I change my referrer?', a: 'No. A referral link is permanent once your account is created — this protects everyone in the network from having their earnings restructured.' },
  { q: 'What happens if I delete an approved post?', a: 'Approved posts are re-checked periodically. If a post is confirmed removed across several checks, the points are reversed for you and for your upline.' },
];

export default function SupportPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const query = useQuery({
    queryKey: queryKeys.support.mine({}),
    queryFn: () => api.get<Paginated<TicketRow>>('/support'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(ticketCreateSchema),
    defaultValues: { priority: 'MEDIUM', category: 'ACCOUNT' },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => api.post<{ id: string }>('/support', values),
    onSuccess: (result) => {
      toast.success('Ticket raised', 'Our team will respond shortly.');
      void queryClient.invalidateQueries({ queryKey: ['support'] });
      setOpen(false); reset();
      navigate(`/support/${result.id}`);
    },
    onError: () => toast.error('Could not raise the ticket'),
  });

  const columns: Column<TicketRow>[] = [
    {
      key: 'subject', header: 'Subject', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.subject}</div>
          <div className="small muted mono">{row.reference}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (row) => <Chip tone="neutral">{titleCase(row.category)}</Chip> },
    { key: 'status', header: 'Status', primary: true, render: (row) => <StatusChip status={row.status} /> },
    { key: 'updated', header: 'Last activity', render: (row) => <span className="small muted">{formatRelative(row.updatedAt)}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Support"
        subtitle="Find a quick answer, or raise a ticket and we will take it from there"
        action={<Button onClick={() => setOpen(true)}>Raise a ticket</Button>}
      />

      <div className="grid grid-main">
        <div className="stack">
          <h2 style={{ fontSize: 18 }}>My tickets</h2>
          <DataTable
            columns={columns}
            rows={query.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={query.isPending}
            error={query.isError ? query.error : undefined}
            onRetry={query.refetch}
            onRowClick={(row) => navigate(`/support/${row.id}`)}
            emptyTitle="No tickets yet"
            emptyBody="If something is not working as expected, raise a ticket and we will investigate."
            emptyAction={<Button onClick={() => setOpen(true)}>Raise a ticket</Button>}
          />
        </div>

        <Card>
          <CardHeader title="Frequently asked" />
          <CardBody className="stack" style={{ gap: 4 }}>
            {FAQ.map((item, index) => (
              <div key={item.q} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  aria-expanded={expandedFaq === index}
                  className="row-between"
                  style={{ width: '100%', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{item.q}</span>
                  <span className="muted" aria-hidden>{expandedFaq === index ? '−' : '+'}</span>
                </button>
                {expandedFaq === index ? <p className="small muted" style={{ lineHeight: 1.65, paddingBottom: 6 }}>{item.a}</p> : null}
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Raise a support ticket"
        description="Give us as much detail as you can — reference numbers and screenshots help us resolve things faster."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>Submit ticket</Button>
          </>
        }
      >
        <form className="stack" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
          <Select
            label="Category" required
            options={TICKET_CATEGORY.map((c) => ({ value: c, label: titleCase(c) }))}
            error={errors.category?.message} {...register('category')}
          />
          <Input label="Subject" required placeholder="Briefly, what is happening?" error={errors.subject?.message} {...register('subject')} />
          <Textarea
            label="Description" required
            placeholder="Include reference numbers, dates and what you expected to happen."
            style={{ minHeight: 130 }}
            error={errors.description?.message} {...register('description')}
          />
          <Select
            label="Priority"
            options={TICKET_PRIORITY.map((p) => ({ value: p, label: titleCase(p) }))}
            {...register('priority')}
          />
        </form>
      </Dialog>
    </div>
  );
}
