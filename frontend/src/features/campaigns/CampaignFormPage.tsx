import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { campaignApi } from './api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, Input, Textarea, Select, Button, Chip,
  PageHeader, Breadcrumb, Skeleton,
} from '@/components/ui';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { PLATFORMS, CAMPAIGN_STATUS, type Platform } from '@shared/constants';

interface Draft {
  name: string; description: string; category: string; creditValue: number;
  startDate: string; endDate: string; status: string;
  budgetPoints: number | null; perUserLimit: number;
  platforms: Platform[]; hashtags: string; captionTemplate: string;
  brandGuidelines: string; coverImageUrl: string;
  rules: { label: string; detail: string; mandatory: boolean }[];
}

function isoDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export default function CampaignFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const economics = useQuery({
    queryKey: queryKeys.settings.economics,
    queryFn: () => api.get<{ campaignDefaultCredit: number }>('/settings/economics'),
  });

  const existing = useQuery({
    queryKey: queryKeys.campaigns.detail(id ?? ''),
    queryFn: () => campaignApi.detail(id as string),
    enabled: isEdit,
  });

  const [draft, setDraft] = useState<Draft>({
    name: '', description: '', category: 'GENERAL', creditValue: 500,
    startDate: isoDate(), endDate: isoDate(30), status: 'DRAFT',
    budgetPoints: null, perUserLimit: 1, platforms: ['INSTAGRAM'],
    hashtags: '#EduRewards', captionTemplate: '', brandGuidelines: '', coverImageUrl: '',
    rules: [{ label: 'Tag the official handle', detail: 'Mention @edurewards in the caption or first comment.', mandatory: true }],
  });

  // Seed the default credit from platform economics rather than hardcoding it.
  useEffect(() => {
    if (!isEdit && economics.data) setDraft((d) => ({ ...d, creditValue: economics.data.campaignDefaultCredit }));
  }, [economics.data, isEdit]);

  useEffect(() => {
    if (!existing.data) return;
    const c = existing.data;
    setDraft({
      name: c.name, description: c.description, category: c.category, creditValue: c.creditValue,
      startDate: c.startDate.slice(0, 10), endDate: c.endDate.slice(0, 10), status: c.status,
      budgetPoints: c.budgetPoints, perUserLimit: c.perUserLimit, platforms: c.platforms,
      hashtags: c.hashtags.join(' '), captionTemplate: c.captionTemplate ?? '',
      brandGuidelines: c.brandGuidelines ?? '', coverImageUrl: c.coverImageUrl ?? '',
      rules: c.rules.map((r) => ({ label: r.label, detail: r.detail, mandatory: r.mandatory })),
    });
  }, [existing.data]);

  const payload = () => ({
    ...draft,
    startDate: new Date(draft.startDate).toISOString(),
    endDate: new Date(draft.endDate).toISOString(),
    hashtags: draft.hashtags.split(/\s+/).map((h) => h.trim()).filter(Boolean),
    budgetPoints: draft.budgetPoints || null,
    coverImageUrl: draft.coverImageUrl || undefined,
    captionTemplate: draft.captionTemplate || undefined,
    brandGuidelines: draft.brandGuidelines || undefined,
  });

  const save = useMutation({
    mutationFn: () => (isEdit ? campaignApi.update(id as string, payload()) : campaignApi.create(payload())),
    onSuccess: () => {
      toast.success(isEdit ? 'Campaign updated' : 'Campaign created');
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/admin/campaigns');
    },
    onError: (error) => toast.error('Could not save', error instanceof ApiError ? error.message : undefined),
  });

  const togglePlatform = (platform: Platform) => {
    setDraft((d) => ({
      ...d,
      platforms: d.platforms.includes(platform) ? d.platforms.filter((p) => p !== platform) : [...d.platforms, platform],
    }));
  };

  const setRule = (index: number, patch: Partial<Draft['rules'][number]>) => {
    setDraft((d) => ({ ...d, rules: d.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  };

  if (isEdit && existing.isPending) return <div className="stack"><Skeleton height={28} width="35%" /><Skeleton height={400} /></div>;

  const valid = draft.name.length >= 3 && draft.description.length >= 10 && draft.platforms.length > 0
    && new Date(draft.endDate) > new Date(draft.startDate);

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 860 }}>
      <Breadcrumb items={[{ label: 'Campaigns', to: '/admin/campaigns' }, { label: isEdit ? draft.name || 'Edit' : 'New campaign' }]} />

      <PageHeader
        title={isEdit ? 'Edit campaign' : 'New campaign'}
        subtitle="Budgets and per-user limits are enforced server-side at submission and again at approval"
        action={
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={() => navigate('/admin/campaigns')}>Cancel</Button>
            <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
              {isEdit ? 'Save changes' : 'Create campaign'}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader title="Basics" />
        <CardBody className="stack">
          <Input label="Campaign name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Textarea
            label="Description" required style={{ minHeight: 110 }}
            hint="Ambassadors see this on the campaign page — explain what to post and why it matters."
            value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div className="grid grid-2">
            <Input label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <Select
              label="Status"
              options={CAMPAIGN_STATUS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            />
            <Input label="Start date" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
            <Input
              label="End date" type="date" value={draft.endDate}
              error={new Date(draft.endDate) <= new Date(draft.startDate) ? 'Must be after the start date' : undefined}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </div>
          <Input label="Cover image URL" placeholder="https://…" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Economics and limits" />
        <CardBody className="grid grid-2">
          <Input
            label="Credit value (points per approved post)" type="number" min={1} required
            value={draft.creditValue} onChange={(e) => setDraft({ ...draft, creditValue: Number(e.target.value) })}
          />
          <Input
            label="Points budget" type="number" min={0}
            hint="Leave empty for no cap. Approvals are blocked once the budget is reached."
            value={draft.budgetPoints ?? ''} onChange={(e) => setDraft({ ...draft, budgetPoints: e.target.value ? Number(e.target.value) : null })}
          />
          <Input
            label="Submissions per ambassador" type="number" min={1} max={100}
            value={draft.perUserLimit} onChange={(e) => setDraft({ ...draft, perUserLimit: Number(e.target.value) })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Platforms" subtitle="Submissions from any other platform are rejected automatically" />
        <CardBody>
          <div className="row wrap" style={{ gap: 8 }}>
            {PLATFORMS.map((platform) => {
              const active = draft.platforms.includes(platform);
              return (
                <button
                  key={platform} type="button" onClick={() => togglePlatform(platform)} aria-pressed={active}
                  className={`chip chip--${active ? 'primary' : 'neutral'}`}
                  style={{ cursor: 'pointer', padding: '9px 16px', fontSize: 'var(--text-sm)', border: active ? '1px solid var(--primary)' : undefined }}
                >
                  {platform}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Submission rules"
          action={
            <Button size="sm" variant="secondary"
              onClick={() => setDraft({ ...draft, rules: [...draft.rules, { label: '', detail: '', mandatory: true }] })}>
              Add rule
            </Button>
          }
        />
        <CardBody className="stack" style={{ gap: 12 }}>
          {draft.rules.map((rule, index) => (
            <div key={index} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div className="grow grid grid-2">
                <Input label="Rule" value={rule.label} onChange={(e) => setRule(index, { label: e.target.value })} />
                <Input label="Detail" value={rule.detail} onChange={(e) => setRule(index, { detail: e.target.value })} />
              </div>
              <Button
                size="sm" variant="ghost" style={{ marginTop: 22 }}
                onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Creative guidance" />
        <CardBody className="stack">
          <Textarea label="Suggested caption" value={draft.captionTemplate} onChange={(e) => setDraft({ ...draft, captionTemplate: e.target.value })} />
          <Input
            label="Hashtags" placeholder="#EduRewards #CampusAmbassador"
            hint="Space separated."
            value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })}
          />
          <Textarea label="Brand guidelines" value={draft.brandGuidelines} onChange={(e) => setDraft({ ...draft, brandGuidelines: e.target.value })} />
        </CardBody>
      </Card>
    </div>
  );
}
