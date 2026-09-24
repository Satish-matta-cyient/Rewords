import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { submissionApi } from './api';
import { campaignApi, type CampaignListItem } from '@/features/campaigns/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, Button, Input, Textarea, ProgressBar, Chip, Skeleton,
  EmptyState, PageHeader, StatusChip,
} from '@/components/ui';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { formatNumber } from '@/utils/format';
import type { Platform } from '@shared/constants';

const STEPS = ['Campaign', 'Platform', 'Post link', 'Screenshot', 'Review'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row-between">
        <span className="small muted">Step {current + 1} of {STEPS.length} — {STEPS[current]}</span>
        <span className="small muted">{Math.round(((current + 1) / STEPS.length) * 100)}%</span>
      </div>
      <ProgressBar value={current + 1} max={STEPS.length} />
    </div>
  );
}

function validateUrl(value: string): string | null {
  if (!value.trim()) return 'Paste the link to your live post';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return 'The post URL must start with https://';
    return null;
  } catch {
    return 'That does not look like a valid URL';
  }
}

export default function SubmitPostPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(params.get('campaignId') ? 1 : 0);
  const [campaignId, setCampaignId] = useState(params.get('campaignId') ?? '');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [postUrl, setPostUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: queryKeys.campaigns.list({ activeOnly: true, pageSize: 50 }),
    queryFn: () => campaignApi.list({ activeOnly: true, pageSize: 50 }),
  });

  const selected: CampaignListItem | undefined = campaigns.data?.items.find((c) => c.id === campaignId);

  const submit = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set('campaignId', campaignId);
      form.set('platform', platform as string);
      form.set('postUrl', postUrl.trim());
      if (caption) form.set('caption', caption);
      if (notes) form.set('notes', notes);
      if (file) form.set('screenshot', file);
      return submissionApi.create(form);
    },
    onSuccess: () => {
      toast.success('Submission received', 'Our team reviews posts within 24–72 hours.');
      void queryClient.invalidateQueries({ queryKey: ['submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/my-submissions');
    },
    onError: (error) => toast.error('Could not submit', error instanceof ApiError ? error.message : undefined),
  });

  const handleFile = (next: File | null) => {
    setFile(next);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const canAdvance = [
    Boolean(campaignId),
    Boolean(platform),
    Boolean(postUrl) && !validateUrl(postUrl),
    true, // screenshot is encouraged but optional
    true,
  ][step];

  const goNext = () => {
    if (step === 2) {
      const error = validateUrl(postUrl);
      setUrlError(error);
      if (error) return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 720 }}>
      <PageHeader title="Submit a Post" subtitle="Five quick steps, then our team verifies your post" />

      <Card>
        <CardBody className="stack" style={{ gap: 20 }}>
          <StepIndicator current={step} />

          {step === 0 ? (
            campaigns.isPending ? <Skeleton height={180} /> : (
              campaigns.data?.items.length === 0 ? (
                <EmptyState title="No open campaigns" body="There are no campaigns accepting submissions right now. Check back soon." />
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <h2 style={{ fontSize: 17 }}>Which campaign are you posting for?</h2>
                  {campaigns.data?.items.map((campaign) => {
                    const blocked = campaign.budgetExhausted || campaign.mySubmissionCount >= campaign.perUserLimit;
                    return (
                      <button
                        key={campaign.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => setCampaignId(campaign.id)}
                        aria-pressed={campaignId === campaign.id}
                        className="row-between"
                        style={{
                          padding: 14, width: '100%', textAlign: 'left',
                          cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.5 : 1,
                          background: campaignId === campaign.id ? 'var(--accent-soft)' : 'var(--card)',
                          border: `1px solid ${campaignId === campaign.id ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{campaign.name}</div>
                          <div className="small muted">
                            {blocked
                              ? campaign.budgetExhausted ? 'Budget exhausted' : 'You reached the submission limit'
                              : `${campaign.mySubmissionCount}/${campaign.perUserLimit} submitted · ends in ${campaign.daysRemaining}d`}
                          </div>
                        </div>
                        <Chip tone="primary">{formatNumber(campaign.creditValue)} pts</Chip>
                      </button>
                    );
                  })}
                </div>
              )
            )
          ) : null}

          {step === 1 && selected ? (
            <div className="stack" style={{ gap: 10 }}>
              <h2 style={{ fontSize: 17 }}>Where did you post it?</h2>
              <p className="small muted">{selected.name} accepts these platforms.</p>
              <div className="row wrap" style={{ gap: 8 }}>
                {selected.platforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    aria-pressed={platform === p}
                    className={`chip chip--${platform === p ? 'primary' : 'neutral'}`}
                    style={{ cursor: 'pointer', padding: '10px 18px', fontSize: 'var(--text-sm)', border: platform === p ? '1px solid var(--primary)' : undefined }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 17 }}>Paste the link to your post</h2>
              <Input
                label="Post URL"
                type="url"
                inputMode="url"
                placeholder="https://www.instagram.com/p/…"
                value={postUrl}
                error={urlError ?? undefined}
                hint="The post must be public and stay live for at least 30 days."
                onChange={(e) => { setPostUrl(e.target.value); setUrlError(null); }}
                onBlur={() => setUrlError(validateUrl(postUrl))}
                required
              />
              <Textarea label="Caption you used" placeholder="Optional — helps reviewers confirm the requirements" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 17 }}>Add a screenshot</h2>
              <p className="small muted">A screenshot speeds up review considerably, especially for private-by-default platforms.</p>

              <label
                style={{
                  display: 'grid', placeItems: 'center', gap: 8, padding: 28, cursor: 'pointer',
                  border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)',
                  background: 'var(--background)', textAlign: 'center',
                }}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                {preview ? (
                  <img src={preview} alt="Screenshot preview" style={{ maxHeight: 200, borderRadius: 'var(--radius)' }} />
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v13" /></svg>
                    <span className="small" style={{ fontWeight: 500 }}>Tap to upload a screenshot</span>
                    <span className="small muted">PNG, JPG or WebP · up to 5 MB</span>
                  </>
                )}
              </label>
              {file ? (
                <div className="row-between small">
                  <span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <Button size="sm" variant="ghost" onClick={() => handleFile(null)}>Remove</Button>
                </div>
              ) : null}
              <Textarea label="Notes for the reviewer" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="stack" style={{ gap: 12 }}>
              <h2 style={{ fontSize: 17 }}>Review and submit</h2>
              <Card style={{ background: 'var(--background)' }}>
                <CardBody className="stack" style={{ gap: 8 }}>
                  <div className="row-between small"><span className="muted">Campaign</span><span style={{ fontWeight: 600 }}>{selected?.name}</span></div>
                  <div className="row-between small"><span className="muted">Platform</span><span style={{ fontWeight: 600 }}>{platform}</span></div>
                  <div className="row-between small"><span className="muted">Post URL</span><span className="truncate" style={{ maxWidth: 260 }}>{postUrl}</span></div>
                  <div className="row-between small"><span className="muted">Screenshot</span><span>{file ? file.name : 'Not attached'}</span></div>
                  <div className="row-between small" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span className="muted">Points if approved</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatNumber(selected?.creditValue ?? 0)}</span>
                  </div>
                </CardBody>
              </Card>
              <p className="small muted">
                Deleting your post after approval reverses the points for you and everyone in your upline, so keep it live.
              </p>
            </div>
          ) : null}

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={!canAdvance}>Continue</Button>
            ) : (
              <Button onClick={() => submit.mutate()} loading={submit.isPending}>Submit for verification</Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
