import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { submissionApi } from './api';
import { queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatusChip, Breadcrumb,
  Timeline, Button, ImageLightbox, PointsBadge,
} from '@/components/ui';
import { formatDateTime, titleCase, formatNumber } from '@/utils/format';

export default function SubmissionDetailPage() {
  const { id = '' } = useParams();
  const [lightbox, setLightbox] = useState(false);
  const query = useQuery({ queryKey: queryKeys.submissions.detail(id), queryFn: () => submissionApi.detail(id) });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={26} width="40%" /><Skeleton height={300} /></div>}>
      {(submission) => (
        <div className="stack" style={{ gap: 18, maxWidth: 900 }}>
          <Breadcrumb items={[{ label: 'My Submissions', to: '/my-submissions' }, { label: submission.campaignName }]} />

          <div className="row-between wrap">
            <div>
              <h1 style={{ fontSize: 24 }}>{submission.campaignName}</h1>
              <p className="muted small" style={{ marginTop: 4 }}>
                {submission.platform} · submitted {formatDateTime(submission.submittedAt)}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <StatusChip status={submission.status} />
              {submission.awardedPoints > 0 ? <PointsBadge points={submission.awardedPoints} /> : null}
            </div>
          </div>

          {submission.status === 'INFO_REQUESTED' ? (
            <Card style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
              <CardBody className="stack" style={{ gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>More information needed</div>
                <div className="small" style={{ color: '#92400E' }}>
                  {submission.history.find((h) => h.toStatus === 'INFO_REQUESTED')?.reason ?? 'Please contact support with more details.'}
                </div>
                <div><Link to="/support" className="btn btn--secondary btn--sm">Reply via support</Link></div>
              </CardBody>
            </Card>
          ) : null}

          {submission.status === 'REJECTED' ? (
            <Card style={{ borderColor: 'var(--destructive)', background: 'var(--destructive-soft)' }}>
              <CardBody className="stack" style={{ gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--destructive)' }}>Why this was rejected</div>
                <div className="small">{submission.history.find((h) => h.toStatus === 'REJECTED')?.reason}</div>
                <div><Link to="/submit-post" className="btn btn--secondary btn--sm">Submit a corrected post</Link></div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-main">
            <div className="stack">
              <Card>
                <CardHeader title="Submission details" />
                <CardBody className="stack" style={{ gap: 10 }}>
                  <div className="row-between small">
                    <span className="muted">Post URL</span>
                    <a href={submission.postUrl} target="_blank" rel="noopener noreferrer" className="truncate" style={{ maxWidth: 320 }}>
                      {submission.postUrl}
                    </a>
                  </div>
                  <div className="row-between small"><span className="muted">Platform</span><span>{submission.platform}</span></div>
                  <div className="row-between small">
                    <span className="muted">Points if approved</span>
                    <span style={{ fontWeight: 600 }}>{formatNumber(submission.creditValue)}</span>
                  </div>
                  {submission.caption ? (
                    <div>
                      <div className="small muted" style={{ marginBottom: 4 }}>Caption</div>
                      <p className="small" style={{ lineHeight: 1.6 }}>{submission.caption}</p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>

              {submission.screenshotUrl ? (
                <Card>
                  <CardHeader title="Screenshot" />
                  <CardBody>
                    <button
                      type="button"
                      onClick={() => setLightbox(true)}
                      aria-label="View screenshot full size"
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'zoom-in', width: '100%' }}
                    >
                      <img
                        src={submission.screenshotUrl}
                        alt="Submitted post screenshot"
                        style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 'var(--radius)', background: 'var(--background)' }}
                      />
                    </button>
                  </CardBody>
                </Card>
              ) : null}
            </div>

            <Card>
              <CardHeader title="Review history" />
              <CardBody>
                <Timeline
                  items={submission.history.slice().reverse().map((entry) => ({
                    key: entry.id,
                    label: titleCase(entry.toStatus),
                    meta: `${entry.reviewer} · ${formatDateTime(entry.createdAt)}`,
                    detail: entry.reason,
                    done: true,
                    negative: ['REJECTED', 'REVERSED'].includes(entry.toStatus),
                  }))}
                />
              </CardBody>
            </Card>
          </div>

          {lightbox && submission.screenshotUrl ? (
            <ImageLightbox src={submission.screenshotUrl} alt="Submitted post screenshot" onClose={() => setLightbox(false)} />
          ) : null}
        </div>
      )}
    </AsyncBoundary>
  );
}
