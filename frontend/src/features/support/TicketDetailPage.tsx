import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatusChip, Chip, Avatar,
  Breadcrumb, Button, Textarea, Select, Checkbox,
} from '@/components/ui';
import { formatDateTime, titleCase } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { TICKET_STATUS, TICKET_PRIORITY } from '@shared/constants';

interface TicketDetail {
  id: string; reference: string; subject: string; category: string; status: string; priority: string;
  createdAt: string; assigneeId: string | null;
  user: { id: string; fullName: string; email: string };
  assignee: { id: string; fullName: string } | null;
  messages: { id: string; body: string; internal: boolean; createdAt: string; author: { id: string; fullName: string; primaryRole: string } }[];
}

export default function TicketDetailPage() {
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.user?.role);
  const isStaff = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);

  const query = useQuery({ queryKey: queryKeys.support.detail(id), queryFn: () => api.get<TicketDetail>(`/support/${id}`) });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['support'] });

  const send = useMutation({
    mutationFn: () => api.post(`/support/${id}/reply`, { body: reply, internal }),
    onSuccess: () => { setReply(''); setInternal(false); refresh(); },
    onError: () => toast.error('Could not send your reply'),
  });

  const update = useMutation({
    mutationFn: (patch: Record<string, string>) => api.patch(`/support/${id}`, patch),
    onSuccess: () => { toast.success('Ticket updated'); refresh(); },
  });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={26} width="40%" /><Skeleton height={340} /></div>}>
      {(ticket) => (
        <div className="stack" style={{ gap: 18, maxWidth: 900 }}>
          <Breadcrumb items={[{ label: 'Support', to: isStaff ? '/admin/support' : '/support' }, { label: ticket.reference }]} />

          <div className="row-between wrap">
            <div>
              <h1 style={{ fontSize: 23 }}>{ticket.subject}</h1>
              <p className="muted small" style={{ marginTop: 4 }}>
                <span className="mono">{ticket.reference}</span> · {titleCase(ticket.category)} · raised {formatDateTime(ticket.createdAt)}
                {isStaff ? ` · ${ticket.user.fullName} (${ticket.user.email})` : ''}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <StatusChip status={ticket.status} />
              <Chip tone={ticket.priority === 'URGENT' || ticket.priority === 'HIGH' ? 'danger' : 'neutral'}>{titleCase(ticket.priority)}</Chip>
            </div>
          </div>

          {isStaff ? (
            <Card>
              <CardBody className="row wrap" style={{ gap: 12 }}>
                <div style={{ width: 190 }}>
                  <Select
                    label="Status"
                    options={TICKET_STATUS.map((s) => ({ value: s, label: titleCase(s) }))}
                    value={ticket.status}
                    onChange={(e) => update.mutate({ status: e.target.value })}
                  />
                </div>
                <div style={{ width: 170 }}>
                  <Select
                    label="Priority"
                    options={TICKET_PRIORITY.map((p) => ({ value: p, label: titleCase(p) }))}
                    value={ticket.priority}
                    onChange={(e) => update.mutate({ priority: e.target.value })}
                  />
                </div>
                <div className="grow" style={{ alignSelf: 'flex-end' }}>
                  <span className="small muted">Assigned to {ticket.assignee?.fullName ?? 'nobody yet'}</span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Conversation" />
            <CardBody className="stack" style={{ gap: 14 }}>
              {ticket.messages.map((message) => {
                const staffAuthor = message.author.primaryRole !== 'USER';
                return (
                  <div
                    key={message.id}
                    className="row"
                    style={{
                      gap: 11, alignItems: 'flex-start', padding: 13,
                      background: message.internal ? 'var(--warning-soft)' : staffAuthor ? 'var(--accent-soft)' : 'var(--background)',
                      borderRadius: 'var(--radius)',
                      border: message.internal ? '1px dashed var(--warning)' : '1px solid transparent',
                    }}
                  >
                    <Avatar name={message.author.fullName} size={32} />
                    <div className="grow">
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{message.author.fullName}</span>
                        {staffAuthor ? <Chip tone="primary">Support</Chip> : null}
                        {message.internal ? <Chip tone="warning">Internal note</Chip> : null}
                        <span className="small muted">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="small" style={{ marginTop: 5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{message.body}</p>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="stack">
              <Textarea
                label="Your reply"
                placeholder="Type your message…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="row-between wrap">
                {isStaff ? (
                  <Checkbox
                    label="Internal note — never shown to the ambassador"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                ) : <span />}
                <Button disabled={reply.trim().length === 0} loading={send.isPending} onClick={() => send.mutate()}>
                  {internal ? 'Add internal note' : 'Send reply'}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </AsyncBoundary>
  );
}
