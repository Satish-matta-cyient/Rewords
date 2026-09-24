import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, AsyncBoundary, Skeleton, Input, Button,
  PageHeader, ConfirmDialog, Chip,
} from '@/components/ui';
import { formatCurrency, formatNumber } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

interface Economics {
  referralLevelPercentages: number[];
  referralMaxDepth: number;
  referralSignupBonus: number;
  campaignDefaultCredit: number;
  pointsToInr: number;
  pointsExpiryDays: number;
  minRedemptionPoints: number;
  dailySubmissionLimit: number;
  monthlyEarnCap: number;
}

export default function EconomicsPage() {
  const [draft, setDraft] = useState<Economics | null>(null);
  const [confirm, setConfirm] = useState(false);

  const query = useQuery({ queryKey: queryKeys.settings.economics, queryFn: () => api.get<Economics>('/settings/economics') });
  useEffect(() => { if (query.data && !draft) setDraft(query.data); }, [query.data, draft]);

  const save = useMutation({
    mutationFn: (values: Economics) => api.patch<Economics>('/settings/economics', values),
    onSuccess: () => {
      toast.success('Economics updated', 'New values apply to future transactions only. History is untouched.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setConfirm(false);
    },
    onError: (error) => { toast.error('Could not save', error instanceof ApiError ? error.message : undefined); setConfirm(false); },
  });

  const setField = <K extends keyof Economics>(key: K, value: Economics[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setLevel = (index: number, value: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.referralLevelPercentages];
      next[index] = value;
      return { ...prev, referralLevelPercentages: next };
    });
  };

  const dirty = draft && query.data && JSON.stringify(draft) !== JSON.stringify(query.data);
  const totalPayout = draft ? draft.referralLevelPercentages.slice(0, draft.referralMaxDepth).reduce((a, b) => a + b, 0) : 0;

  return (
    <AsyncBoundary query={query} skeleton={<div className="stack"><Skeleton height={30} width="35%" /><Skeleton height={340} /></div>}>
      {() => draft ? (
        <div className="stack" style={{ gap: 18, maxWidth: 860 }}>
          <PageHeader
            title="Points Economics"
            subtitle="These values drive every point calculation on the platform"
            action={
              <div className="row" style={{ gap: 8 }}>
                {dirty ? <Button variant="secondary" onClick={() => setDraft(query.data ?? null)}>Discard</Button> : null}
                <Button disabled={!dirty} onClick={() => setConfirm(true)}>Save changes</Button>
              </div>
            }
          />

          <Card style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-mint)' }}>
            <CardBody className="row-between wrap">
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Total referral payout per approved post</div>
                <div className="small muted">
                  A {formatNumber(draft.campaignDefaultCredit)}-point post costs{' '}
                  {formatNumber(Math.round(draft.campaignDefaultCredit * (1 + totalPayout / 100)))} points in total.
                </div>
              </div>
              <Chip tone={totalPayout > 60 ? 'danger' : totalPayout > 40 ? 'warning' : 'success'}>
                {totalPayout}% on top of the base credit
              </Chip>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Referral ladder" subtitle="Percentage of the base credit paid to each upline level" />
            <CardBody className="stack">
              <Input
                label="Maximum referral depth"
                type="number" min={1} max={10}
                hint="How many levels above an ambassador can earn from their activity."
                value={draft.referralMaxDepth}
                onChange={(e) => setField('referralMaxDepth', Number(e.target.value))}
              />
              <div className="grid grid-4">
                {draft.referralLevelPercentages.map((percent, index) => (
                  <Input
                    key={index}
                    label={`Level ${index + 1} %`}
                    type="number" min={0} max={100} step={0.5}
                    disabled={index >= draft.referralMaxDepth}
                    value={percent}
                    onChange={(e) => setLevel(index, Number(e.target.value))}
                  />
                ))}
              </div>
              <Input
                label="Referral signup bonus"
                type="number" min={0}
                hint="Awarded to the direct referrer when a new ambassador joins with their code."
                value={draft.referralSignupBonus}
                onChange={(e) => setField('referralSignupBonus', Number(e.target.value))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Point value and redemption" />
            <CardBody className="grid grid-2">
              <Input
                label="Points to INR conversion" type="number" min={0.0001} step={0.01}
                hint={`1 point = ${formatCurrency(draft.pointsToInr)}`}
                value={draft.pointsToInr}
                onChange={(e) => setField('pointsToInr', Number(e.target.value))}
              />
              <Input
                label="Minimum redemption (points)" type="number" min={1}
                hint={`Worth ${formatCurrency(draft.minRedemptionPoints * draft.pointsToInr)}`}
                value={draft.minRedemptionPoints}
                onChange={(e) => setField('minRedemptionPoints', Number(e.target.value))}
              />
              <Input
                label="Points expiry (days)" type="number" min={0}
                hint="Set to 0 to disable expiry entirely."
                value={draft.pointsExpiryDays}
                onChange={(e) => setField('pointsExpiryDays', Number(e.target.value))}
              />
              <Input
                label="Default campaign credit" type="number" min={1}
                hint="Pre-filled when an admin creates a new campaign."
                value={draft.campaignDefaultCredit}
                onChange={(e) => setField('campaignDefaultCredit', Number(e.target.value))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Limits and abuse controls" />
            <CardBody className="grid grid-2">
              <Input
                label="Daily submission limit per user" type="number" min={1} max={100}
                value={draft.dailySubmissionLimit}
                onChange={(e) => setField('dailySubmissionLimit', Number(e.target.value))}
              />
              <Input
                label="Monthly earning cap per user" type="number" min={0}
                hint="Set to 0 to remove the cap."
                value={draft.monthlyEarnCap}
                onChange={(e) => setField('monthlyEarnCap', Number(e.target.value))}
              />
            </CardBody>
          </Card>

          <ConfirmDialog
            open={confirm}
            onClose={() => setConfirm(false)}
            onConfirm={() => save.mutate(draft)}
            loading={save.isPending}
            title="Apply these economics?"
            description="New values take effect immediately for future transactions. Historical ledger entries are never rewritten, so past balances and liability figures stay exactly as they were. The change is recorded in the audit log."
            confirmLabel="Save economics"
          />
        </div>
      ) : null}
    </AsyncBoundary>
  );
}
