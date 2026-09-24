import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { announcementSchema } from '@shared/schemas';
import {
  Card, CardBody, CardHeader, PageHeader, Button, Dialog, Input, Textarea,
  Select, Chip, Skeleton, EmptyState,
} from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import { toast } from '@/store/uiStore';

type FormValues = z.infer<typeof announcementSchema>;

interface Announcement {
  id: string; title: string; body: string; audience: string; severity: string;
  publishedAt: string | null; createdAt: string; author: { fullName: string } | null;
}

export default function AnnouncementsPage() {
  const [open, setOpen] = useState(false);

  const query = useQuery({ queryKey: ['announcements'], queryFn: () => api.get<Announcement[]>('/announcements') });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { audience: 'ALL', severity: 'INFO', publishNow: true },
  });
  const audience = watch('audience');

  const create = useMutation({
    mutationFn: (values: FormValues) => api.post('/announcements', values),
    onSuccess: () => {
      toast.success('Announcement published', 'An in-app notification was sent to everyone in the audience.');
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setOpen(false); reset();
    },
    onError: () => toast.error('Could not publish the announcement'),
  });

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <PageHeader
        title="Announcements"
        subtitle="Broadcast updates to ambassadors as in-app notifications"
        action={<Button onClick={() => setOpen(true)}>New announcement</Button>}
      />

      {query.isPending ? <Skeleton height={260} /> : null}
      {query.data?.length === 0 ? (
        <Card><EmptyState title="No announcements yet" body="Publish one to tell ambassadors about new campaigns or platform changes." /></Card>
      ) : null}

      <div className="stack" style={{ gap: 10 }}>
        {query.data?.map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader
              title={announcement.title}
              subtitle={`${announcement.author?.fullName ?? 'System'} · ${announcement.publishedAt ? formatDateTime(announcement.publishedAt) : 'Draft'}`}
              action={
                <div className="row" style={{ gap: 6 }}>
                  <Chip tone="neutral">{announcement.audience}</Chip>
                  <Chip tone={announcement.severity === 'WARNING' ? 'warning' : announcement.severity === 'SUCCESS' ? 'success' : 'info'}>
                    {announcement.severity}
                  </Chip>
                </div>
              }
            />
            <CardBody><p className="small muted" style={{ lineHeight: 1.65 }}>{announcement.body}</p></CardBody>
          </Card>
        ))}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New announcement"
        description="Publishing sends an in-app notification to everyone in the selected audience."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>Publish</Button>
          </>
        }
      >
        <form className="stack" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
          <Input label="Title" required error={errors.title?.message} {...register('title')} />
          <Textarea label="Message" required style={{ minHeight: 120 }} error={errors.body?.message} {...register('body')} />
          <div className="grid grid-2">
            <Select
              label="Audience"
              options={[
                { value: 'ALL', label: 'All active ambassadors' },
                { value: 'ACTIVE', label: 'Active in the last 30 days' },
                { value: 'TIER', label: 'A specific tier' },
                { value: 'CAMPAIGN', label: 'Participants in a campaign' },
              ]}
              {...register('audience')}
            />
            <Select
              label="Tone"
              options={[
                { value: 'INFO', label: 'Informational' },
                { value: 'SUCCESS', label: 'Positive' },
                { value: 'WARNING', label: 'Important' },
              ]}
              {...register('severity')}
            />
          </div>
          {audience === 'TIER' || audience === 'CAMPAIGN' ? (
            <Input
              label={audience === 'TIER' ? 'Tier key' : 'Campaign ID'}
              placeholder={audience === 'TIER' ? 'GOLD' : 'Paste the campaign ID'}
              {...register('audienceRef')}
            />
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
