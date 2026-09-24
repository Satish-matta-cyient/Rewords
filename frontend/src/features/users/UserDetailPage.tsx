import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { userApi } from './api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, StatusChip, Chip, Avatar,
  Breadcrumb, Button, Tabs, Dialog, Input, Textarea, PointsBadge, ConfirmDialog, StatCard,
} from '@/components/ui';
import { formatNumber, formatDate, formatDateTime, titleCase } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { icons } from '@/layouts/navigation';

export default function UserDetailPage() {
  const { id = '' } = useParams();
  const viewerRole = useAuthStore((s) => s.user?.role);
  const [tab, setTab] = useState('overview');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [statusChange, setStatusChange] = useState<'ACTIVE' | 'SUSPENDED' | null>(null);

  const query = useQuery({ queryKey: queryKeys.users.detail(id), queryFn: () => userApi.detail(id) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const adjust = useMutation({
    mutationFn: () => userApi.adjustPoints(id, Number(points), reason),
    onSuccess: () => {
      toast.success('Points adjusted', 'The change is recorded in the ledger and audit log.');
      refresh(); setAdjustOpen(false); setPoints(''); setReason('');
    },
    onError: (error) => toast.error('Adjustment failed', error instanceof ApiError ? error.message : undefined),
  });

  const setStatus = useMutation({
    mutationFn: () => userApi.setStatus(id, statusChange as string, reason || 'Changed by administrator'),
    onSuccess: () => { toast.success('Account status updated'); refresh(); setStatusChange(null); setReason(''); },
    onError: (error) => { toast.error('Could not update status', error instanceof ApiError ? error.message : undefined); setStatusChange(null); },
  });

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={28} width="40%" /><Skeleton height={340} /></div>}>
      {(user) => (
        <div className="stack" style={{ gap: 18 }}>
          <Breadcrumb items={[{ label: 'Users', to: '/admin/users' }, { label: user.fullName }]} />

          <div className="row-between wrap" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 14 }}>
              <Avatar name={user.fullName} size={54} />
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <h1 style={{ fontSize: 24 }}>{user.fullName}</h1>
                  <StatusChip status={user.status} />
                  {user.riskScore > 0 ? <Chip tone={user.riskScore >= 40 ? 'danger' : 'warning'}>Risk {user.riskScore}</Chip> : null}
                </div>
                <p className="muted small" style={{ marginTop: 3 }}>
                  {user.email} · {user.phone ?? 'No phone'} · joined {formatDate(user.createdAt)}
                  {user.emailVerified ? '' : ' · email unverified'}
                </p>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <Button variant="secondary" onClick={() => setAdjustOpen(true)}>Adjust points</Button>
              {user.status === 'ACTIVE' ? (
                <Button variant="danger" onClick={() => setStatusChange('SUSPENDED')}>Suspend</Button>
              ) : (
                <Button onClick={() => setStatusChange('ACTIVE')}>Reactivate</Button>
              )}
            </div>
          </div>

          <div className="grid grid-4">
            <StatCard label="Available points" value={user.wallet?.availablePoints ?? 0} icon={icons.wallet} />
            <StatCard label="Lifetime earned" value={user.wallet?.lifetimeEarned ?? 0} icon={icons.analytics} />
            <StatCard label="Network size" value={user.referral.totalNetwork} icon={icons.network} hint={`${user.referral.directReferrals} direct`} />
            <StatCard label="Submissions" value={user.counts.submissions} icon={icons.submissions} hint={`${user.counts.redemptions} redemptions`} />
          </div>

          {user.openFlags.length > 0 ? (
            <Card style={{ borderColor: 'var(--destructive)', background: 'var(--destructive-soft)' }}>
              <CardHeader title={`${user.openFlags.length} open risk flag(s)`} action={<Link to="/admin/flags" className="small">Review</Link>} />
              <CardBody className="stack" style={{ gap: 6 }}>
                {user.openFlags.map((flag) => (
                  <div key={flag.id} className="row-between small">
                    <span>{flag.summary}</span>
                    <Chip tone={flag.severity === 'HIGH' || flag.severity === 'CRITICAL' ? 'danger' : 'warning'}>{flag.severity}</Chip>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'network', label: 'Network' },
              { key: 'submissions', label: 'Submissions', count: user.counts.submissions },
              { key: 'redemptions', label: 'Redemptions', count: user.counts.redemptions },
              { key: 'ledger', label: 'Ledger' },
              { key: 'payout', label: 'Payout & KYC' },
            ]}
          />

          {tab === 'overview' ? (
            <div className="grid grid-2">
              <Card>
                <CardHeader title="Profile" />
                <CardBody className="stack" style={{ gap: 8 }}>
                  <div className="row-between small"><span className="muted">Role</span><Chip tone="primary">{user.role.replace('_', ' ')}</Chip></div>
                  <div className="row-between small"><span className="muted">Tier</span><span>{user.tier?.name ?? '—'}</span></div>
                  <div className="row-between small"><span className="muted">Referral code</span><span className="mono">{user.referral.code ?? '—'}</span></div>
                  <div className="row-between small"><span className="muted">Institution</span><span>{user.institution?.name ?? '—'}</span></div>
                  <div className="row-between small"><span className="muted">Last active</span><span>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</span></div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Wallet" />
                <CardBody className="stack" style={{ gap: 8 }}>
                  <div className="row-between small"><span className="muted">Available</span><span className="mono" style={{ fontWeight: 600 }}>{formatNumber(user.wallet?.availablePoints ?? 0)}</span></div>
                  <div className="row-between small"><span className="muted">Locked</span><span className="mono">{formatNumber(user.wallet?.lockedPoints ?? 0)}</span></div>
                  <div className="row-between small"><span className="muted">Redeemed</span><span className="mono">{formatNumber(user.wallet?.redeemedPoints ?? 0)}</span></div>
                  <div className="row-between small"><span className="muted">Lifetime earned</span><span className="mono">{formatNumber(user.wallet?.lifetimeEarned ?? 0)}</span></div>
                </CardBody>
              </Card>
            </div>
          ) : null}

          {tab === 'network' ? (
            <Card>
              <CardHeader title="Referral contribution by level" subtitle={`${user.referral.totalNetwork} members generating ${formatNumber(user.referral.pointsFromNetwork)} points`} />
              <CardBody className="stack" style={{ gap: 8 }}>
                {user.referral.levels.map((level) => (
                  <div key={level.level} className="row-between" style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <Chip tone="neutral">Level {level.level}</Chip>
                    <span className="small">{level.members} members</span>
                    <span className="small" style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatNumber(level.points)} pts</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'submissions' ? (
            <Card>
              <CardHeader title="Recent submissions" />
              <CardBody className="stack" style={{ gap: 8 }}>
                {user.recentSubmissions.length === 0 ? <p className="small muted">No submissions.</p> : user.recentSubmissions.map((s) => (
                  <div key={s.id} className="row-between" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{s.campaign}</div>
                      <div className="small muted">{s.platform} · {formatDate(s.submittedAt)}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      {s.awardedPoints > 0 ? <PointsBadge points={s.awardedPoints} /> : null}
                      <StatusChip status={s.status} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'redemptions' ? (
            <Card>
              <CardHeader title="Recent redemptions" />
              <CardBody className="stack" style={{ gap: 8 }}>
                {user.recentRedemptions.length === 0 ? <p className="small muted">No redemptions.</p> : user.recentRedemptions.map((r) => (
                  <div key={r.id} className="row-between" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{r.reward}</div>
                      <div className="small muted mono">{r.reference} · {formatDate(r.createdAt)}</div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono small">{formatNumber(r.pointsSpent)} pts</span>
                      <StatusChip status={r.status} />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'ledger' ? (
            <Card>
              <CardHeader title="Recent ledger entries" subtitle="Append-only — corrections appear as reversals" />
              <CardBody className="stack" style={{ gap: 6 }}>
                {user.recentLedger.map((entry) => (
                  <div key={entry.id} className="row-between" style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)' }}>{entry.description}</div>
                      <div className="small muted">{titleCase(entry.transactionType)} · {formatDateTime(entry.createdAt)}</div>
                    </div>
                    <PointsBadge points={entry.points} />
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {tab === 'payout' ? (
            <Card>
              <CardHeader title="Payout details" subtitle="Sensitive values are masked and encrypted at rest" />
              <CardBody className="stack" style={{ gap: 8 }}>
                {user.payout ? (
                  <>
                    <div className="row-between small"><span className="muted">Method</span><span>{user.payout.method}</span></div>
                    <div className="row-between small"><span className="muted">UPI</span><span className="mono">{user.payout.upiId ?? '—'}</span></div>
                    <div className="row-between small"><span className="muted">Bank account</span><span className="mono">{user.payout.account}</span></div>
                    <div className="row-between small">
                      <span className="muted">PAN</span>
                      <span className="mono">{viewerRole === 'SUPER_ADMIN' ? user.payout.pan : 'Restricted to Super Admin'}</span>
                    </div>
                    <div className="row-between small">
                      <span className="muted">KYC</span>
                      <Chip tone={user.payout.verified ? 'success' : 'warning'}>{user.payout.verified ? 'Verified' : 'Not verified'}</Chip>
                    </div>
                  </>
                ) : <p className="small muted">This ambassador has not added payout details.</p>}
              </CardBody>
            </Card>
          ) : null}

          <Dialog
            open={adjustOpen}
            onClose={() => setAdjustOpen(false)}
            title="Manual point adjustment"
            description="This writes a ledger entry and an immutable audit record. Use a negative value to deduct."
            footer={
              <>
                <Button variant="secondary" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button
                  disabled={!points || Number(points) === 0 || reason.trim().length < 5}
                  loading={adjust.isPending}
                  onClick={() => adjust.mutate()}
                >
                  Apply adjustment
                </Button>
              </>
            }
          >
            <div className="stack">
              <Input
                label="Points" type="number" inputMode="numeric" placeholder="e.g. 500 or -250"
                value={points} onChange={(e) => setPoints(e.target.value)} required
                hint={points ? `${Number(points) > 0 ? 'Credit' : 'Debit'} of ${formatNumber(Math.abs(Number(points)))} points` : undefined}
              />
              <Textarea
                label="Reason" required
                hint="Minimum five characters. This is stored permanently and shown to the ambassador."
                placeholder="e.g. Goodwill credit for the campaign tracking issue on 12 Sep"
                value={reason} onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </Dialog>

          <ConfirmDialog
            open={statusChange !== null}
            onClose={() => setStatusChange(null)}
            onConfirm={() => setStatus.mutate()}
            loading={setStatus.isPending}
            destructive={statusChange === 'SUSPENDED'}
            title={statusChange === 'SUSPENDED' ? 'Suspend this account?' : 'Reactivate this account?'}
            description={
              statusChange === 'SUSPENDED'
                ? 'Sessions are revoked and referral earnings pause immediately. The referral tree is preserved exactly as it is — suspension never restructures a network.'
                : 'The ambassador can sign in again and their referral earnings resume from this point forward.'
            }
            confirmLabel={statusChange === 'SUSPENDED' ? 'Suspend account' : 'Reactivate account'}
          />
        </div>
      )}
    </AsyncBoundary>
  );
}
