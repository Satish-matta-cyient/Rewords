import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { submissionApi } from '@/features/submissions/api';
import { queryClient } from '@/api/queryClient';
import {
  Drawer, Button, Textarea, StatusChip, Chip, Timeline, Skeleton,
  ConfirmDialog, ImageLightbox, Avatar,
} from '@/components/ui';
import { formatDateTime, formatNumber, titleCase, formatRelative } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

type Action = 'approve' | 'reject' | 'info' | null;

export function ReviewDrawer({ submissionId, onClose }: { submissionId: string | null; onClose: () => void }) {
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [lightbox, setLightbox] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const query = useQuery({
    queryKey: ['verifications', 'detail', submissionId],
    queryFn: () => submissionApi.reviewDetail(submissionId as string),
    enabled: Boolean(submissionId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['verifications'] });
    void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    void queryClient.invalidateQueries({ queryKey: ['badges'] });
  };

  const approve = useMutation({
    mutationFn: () => submissionApi.approve(submissionId as string, note || undefined),
    onSuccess: (result) => {
      toast.success(
        'Submission approved',
        `${formatNumber(result.pointsAwarded)} points credited, ${formatNumber(result.networkPointsDistributed)} distributed across the network.`,
      );
      refresh(); setConfirmApprove(false); onClose();
    },
    onError: (error) => {
      toast.error('Approval failed', error instanceof ApiError ? error.message : undefined);
      setConfirmApprove(false);
    },
  });

  const reject = useMutation({
    mutationFn: () => submissionApi.reject(submissionId as string, reason, note || undefined),
    onSuccess: () => { toast.success('Submission rejected'); refresh(); onClose(); },
    onError: (error) => toast.error('Could not reject', error instanceof ApiError ? error.message : undefined),
  });

  const requestInfo = useMutation({
    mutationFn: () => submissionApi.requestInfo(submissionId as string, reason),
    onSuccess: () => { toast.success('Information requested'); refresh(); onClose(); },
    onError: (error) => toast.error('Could not send request', error instanceof ApiError ? error.message : undefined),
  });

  const submission = query.data;
  const decidable = submission ? ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(submission.status) : false;

  return (
    <>
      <Drawer
        open={Boolean(submissionId)}
        onClose={onClose}
        title="Review submission"
        subtitle={submission ? `${submission.campaignName} · ${submission.platform}` : undefined}
        footer={decidable ? (
          <>
            <Button variant="danger" onClick={() => setAction(action === 'reject' ? null : 'reject')}>Reject</Button>
            <Button variant="secondary" onClick={() => setAction(action === 'info' ? null : 'info')}>Request info</Button>
            <Button className="grow" onClick={() => setConfirmApprove(true)}>Approve</Button>
          </>
        ) : undefined}
      >
        {query.isPending ? (
          <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} height={80} />)}</div>
        ) : submission ? (
          <div className="stack" style={{ gap: 18 }}>
            <div className="row-between">
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={submission.user.fullName} src={submission.user.avatarUrl} size={40} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{submission.user.fullName}</div>
                  <div className="small muted">{submission.user.email}</div>
                </div>
              </div>
              <div className="stack" style={{ gap: 6, alignItems: 'flex-end' }}>
                <StatusChip status={submission.status} />
                <Chip tone={submission.riskLevel === 'HIGH' ? 'danger' : submission.riskLevel === 'MEDIUM' ? 'warning' : 'neutral'}>
                  {submission.riskLevel} risk
                </Chip>
              </div>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <div className="row-between small">
                <span className="muted">Post URL</span>
                <a href={submission.postUrl} target="_blank" rel="noopener noreferrer" className="truncate" style={{ maxWidth: 260 }}>Open post ↗</a>
              </div>
              <div className="row-between small"><span className="muted">Submitted</span><span>{formatDateTime(submission.submittedAt)} ({formatRelative(submission.submittedAt)})</span></div>
              <div className="row-between small"><span className="muted">Points at stake</span><span style={{ fontWeight: 600 }}>{formatNumber(submission.creditValue)}</span></div>
              {submission.caption ? (
                <div>
                  <div className="small muted" style={{ marginBottom: 3 }}>Caption</div>
                  <p className="small" style={{ lineHeight: 1.6 }}>{submission.caption}</p>
                </div>
              ) : null}
            </div>

            {submission.screenshotUrl ? (
              <button type="button" onClick={() => setLightbox(true)} aria-label="View screenshot full size"
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'zoom-in' }}>
                <img src={submission.screenshotUrl} alt="Submitted screenshot"
                  style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 'var(--radius)', background: 'var(--background)' }} />
              </button>
            ) : null}

            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Risk signals</div>
              <div className="stack" style={{ gap: 6 }}>
                {submission.riskSignals.map((signal) => (
                  <div key={signal.key} className="row-between small" style={{ padding: '7px 10px', background: 'var(--background)', borderRadius: 'var(--radius-sm)' }}>
                    <span>{signal.label}</span>
                    <Chip tone={signal.severity === 'HIGH' ? 'danger' : signal.severity === 'MEDIUM' ? 'warning' : 'neutral'}>
                      {signal.weight > 0 ? `+${signal.weight}` : 'clear'}
                    </Chip>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Ambassador history</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {submission.userStats.map((stat) => (
                  <Chip key={stat.status} tone="neutral">{titleCase(stat.status)}: {stat._count._all}</Chip>
                ))}
              </div>
            </div>

            {action === 'reject' || action === 'info' ? (
              <div className="stack" style={{ gap: 10, padding: 14, background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                <Textarea
                  label={action === 'reject' ? 'Reason shown to the ambassador' : 'What do you need from them?'}
                  placeholder={action === 'reject' ? 'e.g. The official handle was not tagged in the caption' : 'e.g. Please share a screenshot showing the post is public'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
                {action === 'reject' ? (
                  <Textarea label="Internal note (never shown to the user)" value={note} onChange={(e) => setNote(e.target.value)} />
                ) : null}
                <Button
                  variant={action === 'reject' ? 'danger' : 'primary'}
                  disabled={reason.trim().length < 3}
                  loading={reject.isPending || requestInfo.isPending}
                  onClick={() => (action === 'reject' ? reject.mutate() : requestInfo.mutate())}
                >
                  {action === 'reject' ? 'Confirm rejection' : 'Send request'}
                </Button>
              </div>
            ) : null}

            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Decision history</div>
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
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={() => approve.mutate()}
        loading={approve.isPending}
        title="Approve this submission?"
        description={`This credits ${formatNumber(submission?.creditValue ?? 0)} points to the ambassador and pays referral bonuses up their network. Approval cannot be undone from this screen.`}
        confirmLabel="Approve and award points"
      />

      {lightbox && submission?.screenshotUrl ? (
        <ImageLightbox src={submission.screenshotUrl} alt="Submitted screenshot" onClose={() => setLightbox(false)} />
      ) : null}
    </>
  );
}
