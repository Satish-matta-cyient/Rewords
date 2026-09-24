import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, Switch, PageHeader, Chip,
} from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import { toast } from '@/store/uiStore';

interface Setting { id: string; key: string; value: string; valueType: string; group: string; label: string; updatedAt: string }
interface Flag { id: string; key: string; enabled: boolean; description: string | null }

export default function GeneralSettingsPage() {
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => api.get<Setting[]>('/settings') });
  const flags = useQuery({ queryKey: ['settings', 'flags'], queryFn: () => api.get<Flag[]>('/settings/flags') });

  const toggleFlag = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.patch('/settings/flags', { key, enabled }),
    onSuccess: () => {
      toast.success('Feature flag updated');
      void queryClient.invalidateQueries({ queryKey: ['settings', 'flags'] });
    },
    onError: () => toast.error('Could not update the flag'),
  });

  const grouped = (settings.data ?? []).reduce<Record<string, Setting[]>>((acc, setting) => {
    (acc[setting.group] ??= []).push(setting);
    return acc;
  }, {});

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <PageHeader title="Platform Settings" subtitle="Feature flags and the live configuration values" />

      <Card>
        <CardHeader title="Feature flags" subtitle="Turn capabilities on or off without a deployment" />
        <CardBody className="stack" style={{ gap: 16 }}>
          <AsyncBoundary query={flags} skeleton={<Skeleton height={120} />}>
            {(list) => (
              <>
                {list.map((flag) => (
                  <Switch
                    key={flag.id}
                    checked={flag.enabled}
                    label={flag.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    description={flag.description ?? undefined}
                    onChange={(enabled) => toggleFlag.mutate({ key: flag.key, enabled })}
                  />
                ))}
              </>
            )}
          </AsyncBoundary>
        </CardBody>
      </Card>

      <AsyncBoundary query={settings} skeleton={<Skeleton height={220} />}>
        {() => (
          <>
            {Object.entries(grouped).map(([group, items]) => (
              <Card key={group}>
                <CardHeader
                  title={group.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  subtitle={group === 'ECONOMICS' ? 'Edit these on the Economics page — shown here for reference' : undefined}
                />
                <CardBody className="stack" style={{ gap: 8 }}>
                  {items.map((setting) => (
                    <div key={setting.id} className="row-between" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{setting.label}</div>
                        <div className="small muted mono">{setting.key}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Chip tone="neutral">{setting.value}</Chip>
                        <div className="small muted" style={{ marginTop: 3 }}>{formatDateTime(setting.updatedAt)}</div>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
