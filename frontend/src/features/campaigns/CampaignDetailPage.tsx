import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { campaignApi } from './api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, Button, Chip,
  StatusChip, ProgressBar, PageHeader, Breadcrumb,
} from '@/components/ui';
import { formatNumber, formatDate } from '@/utils/format';
import { copyToClipboard } from '@/utils/share';

export default function CampaignDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: queryKeys.campaigns.detail(id), queryFn: () => campaignApi.detail(id) });
  const trackDownload = useMutation({ mutationFn: (creativeId: string) => campaignApi.trackDownload(id, creativeId) });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={28} width="45%" /><Skeleton height={340} /></div>}>
      {(campaign) => {
        const budgetPercent = campaign.budgetPoints ? (campaign.budgetSpentPoints / campaign.budgetPoints) * 100 : 0;
        const blocked = !campaign.canSubmit || campaign.budgetExhausted || campaign.status !== 'ACTIVE';
        const blockedReason = campaign.status !== 'ACTIVE'
          ? 'This campaign is not currently accepting submissions.'
          : campaign.budgetExhausted
            ? 'This campaign has used its full points budget.'
            : !campaign.canSubmit
              ? `You have reached the limit of ${campaign.perUserLimit} submission(s) for this campaign.`
              : null;

        return (
          <div className="stack" style={{ gap: 18 }}>
            <Breadcrumb items={[{ label: 'Campaigns', to: '/campaigns' }, { label: campaign.name }]} />

            <div className="row-between wrap">
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <StatusChip status={campaign.status} />
                  <Chip tone="neutral">{campaign.category}</Chip>
                </div>
                <h1 style={{ fontSize: 26 }}>{campaign.name}</h1>
                <p className="muted small" style={{ marginTop: 4 }}>
                  {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)} · {campaign.submissionCount} submissions
                </p>
              </div>
              <Button
                size="lg"
                disabled={blocked}
                onClick={() => navigate(`/submit-post?campaignId=${campaign.id}`)}
              >
                {blocked ? 'Submissions closed' : 'Submit a post'}
              </Button>
            </div>

            {blockedReason ? (
              <Card style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
                <CardBody><span className="small" style={{ color: '#92400E', fontWeight: 500 }}>{blockedReason}</span></CardBody>
              </Card>
            ) : null}

            <div className="grid grid-main">
              <div className="stack">
                <Card>
                  <CardHeader title="About this campaign" />
                  <CardBody><p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>{campaign.description}</p></CardBody>
                </Card>

                {campaign.rules.length > 0 ? (
                  <Card>
                    <CardHeader title="Submission requirements" subtitle="Posts that miss these are rejected" />
                    <CardBody className="stack" style={{ gap: 12 }}>
                      {campaign.rules.map((rule) => (
                        <div key={rule.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                            background: 'var(--accent-soft)', color: 'var(--primary)',
                            display: 'grid', placeItems: 'center',
                          }} aria-hidden>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 13 4 4L19 7" /></svg>
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {rule.label}{rule.mandatory ? <span className="field__required"> *</span> : null}
                            </div>
                            <div className="small muted">{rule.detail}</div>
                          </div>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                ) : null}

                {campaign.creatives.length > 0 ? (
                  <Card>
                    <CardHeader title="Creative library" subtitle="Download and post these assets unmodified" />
                    <CardBody>
                      <div className="grid grid-3">
                        {campaign.creatives.map((creative) => (
                          <a
                            key={creative.id}
                            href={creative.fileUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackDownload.mutate(creative.id)}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            <Card interactive style={{ overflow: 'hidden' }}>
                              <div style={{ height: 110, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center' }}>
                                <img src={creative.fileUrl} alt={creative.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                              </div>
                              <div style={{ padding: 10 }}>
                                <div className="small truncate" style={{ fontWeight: 500 }}>{creative.title}</div>
                                <div className="small muted">{creative.downloads} downloads</div>
                              </div>
                            </Card>
                          </a>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ) : null}

                {campaign.brandGuidelines ? (
                  <Card>
                    <CardHeader title="Brand guidelines" />
                    <CardBody><p className="small muted" style={{ lineHeight: 1.7 }}>{campaign.brandGuidelines}</p></CardBody>
                  </Card>
                ) : null}
              </div>

              <div className="stack">
                <Card>
                  <CardBody className="stack">
                    <div>
                      <div className="small muted">You earn per approved post</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>
                        {formatNumber(campaign.creditValue)}
                      </div>
                      <div className="small muted">points, plus your full referral ladder</div>
                    </div>

                    {campaign.budgetPoints ? (
                      <div>
                        <div className="row-between small muted" style={{ marginBottom: 5 }}>
                          <span>Campaign budget</span>
                          <span>{formatNumber(campaign.budgetSpentPoints)} / {formatNumber(campaign.budgetPoints)}</span>
                        </div>
                        <ProgressBar value={budgetPercent} tone={budgetPercent > 90 ? 'danger' : budgetPercent > 70 ? 'warning' : undefined} />
                      </div>
                    ) : null}

                    <div className="row-between small">
                      <span className="muted">Your submissions</span>
                      <span style={{ fontWeight: 600 }}>{campaign.mySubmissionCount} of {campaign.perUserLimit}</span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Eligible platforms" />
                  <CardBody>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {campaign.platforms.map((p) => <Chip key={p} tone="primary">{p}</Chip>)}
                    </div>
                  </CardBody>
                </Card>

                {campaign.captionTemplate ? (
                  <Card>
                    <CardHeader
                      title="Suggested caption"
                      action={<Button size="sm" variant="ghost" onClick={() => copyToClipboard(campaign.captionTemplate as string, 'Caption copied')}>Copy</Button>}
                    />
                    <CardBody>
                      <p className="small" style={{ lineHeight: 1.7 }}>{campaign.captionTemplate}</p>
                      {campaign.hashtags.length > 0 ? (
                        <div className="row wrap" style={{ gap: 5, marginTop: 10 }}>
                          {campaign.hashtags.map((tag) => <Chip key={tag} tone="neutral">{tag}</Chip>)}
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                ) : null}
              </div>
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}
