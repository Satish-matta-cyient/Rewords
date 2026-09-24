import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/api/client';
import { userApi } from '@/features/users/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  Card, CardBody, CardHeader, Input, Button, Tabs, Switch, PageHeader,
  Skeleton, Chip, Select,
} from '@/components/ui';
import { useChangePassword } from '@/features/auth/hooks';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { profileUpdateSchema, payoutProfileSchema } from '@shared/schemas';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';
import { formatCurrency } from '@/utils/format';

type ProfileValues = z.infer<typeof profileUpdateSchema>;
type PayoutValues = z.infer<typeof payoutProfileSchema>;

function ProfileTab() {
  const me = useQuery({ queryKey: ['users', 'me'], queryFn: userApi.me });
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileValues>({
    resolver: zodResolver(profileUpdateSchema),
    values: me.data ? {
      fullName: me.data.fullName,
      phone: me.data.phone ?? undefined,
      college: (me.data.profile?.college as string) ?? undefined,
      course: (me.data.profile?.course as string) ?? undefined,
      city: (me.data.profile?.city as string) ?? undefined,
      publicOnLeaderboard: (me.data.profile?.publicOnLeaderboard as boolean) ?? true,
    } : undefined,
  });

  const save = useMutation({
    mutationFn: (values: ProfileValues) => userApi.updateMe(values),
    onSuccess: () => {
      toast.success('Profile updated');
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
    onError: (error) => toast.error('Could not save', error instanceof ApiError ? error.message : undefined),
  });

  if (me.isPending) return <Skeleton height={300} />;

  return (
    <Card>
      <CardHeader title="Your profile" subtitle="This information helps us recommend the right campaigns" />
      <CardBody>
        <form className="stack" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
          <div className="grid grid-2">
            <Input label="Full name" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Phone number" type="tel" error={errors.phone?.message} {...register('phone')} />
            <Input label="College" error={errors.college?.message} {...register('college')} />
            <Input label="Course" error={errors.course?.message} {...register('course')} />
            <Input label="City" error={errors.city?.message} {...register('city')} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={!isDirty} loading={save.isPending}>Save changes</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function SecurityTab() {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  return (
    <Card>
      <CardHeader title="Password" subtitle="Changing your password signs you out of every other device" />
      <CardBody className="stack" style={{ maxWidth: 420 }}>
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input
          label="New password" type="password" autoComplete="new-password"
          hint="At least 10 characters with upper and lowercase letters plus a number."
          value={next} onChange={(e) => setNext(e.target.value)}
        />
        <div>
          <Button
            disabled={!current || next.length < 10}
            loading={changePassword.isPending}
            onClick={() => changePassword.mutate({ currentPassword: current, password: next }, {
              onSuccess: () => { setCurrent(''); setNext(''); },
            })}
          >
            Change password
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function PayoutTab() {
  const profile = useQuery({ queryKey: queryKeys.payouts.profile, queryFn: () => api.get<Record<string, unknown>>('/payouts/profile') });
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PayoutValues>({
    resolver: zodResolver(payoutProfileSchema),
    defaultValues: { method: 'UPI' },
  });
  const method = watch('method');

  const save = useMutation({
    mutationFn: (values: PayoutValues) => api.put('/payouts/profile', values),
    onSuccess: () => {
      toast.success('Payout details saved', 'Your KYC must be verified before you can request a payout.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.payouts.profile });
    },
    onError: (error) => toast.error('Could not save', error instanceof ApiError ? error.message : undefined),
  });

  return (
    <div className="stack">
      {profile.data?.configured ? (
        <Card>
          <CardHeader title="Current payout details" subtitle="Stored encrypted — only the last four digits are ever displayed" />
          <CardBody className="stack" style={{ gap: 8 }}>
            <div className="row-between small"><span className="muted">Method</span><span>{String(profile.data.method)}</span></div>
            <div className="row-between small"><span className="muted">UPI</span><span className="mono">{String(profile.data.upiId ?? '—')}</span></div>
            <div className="row-between small"><span className="muted">Bank account</span><span className="mono">{String(profile.data.account)}</span></div>
            <div className="row-between small"><span className="muted">PAN</span><span className="mono">{String(profile.data.pan)}</span></div>
            <div className="row-between small">
              <span className="muted">KYC status</span>
              <Chip tone={profile.data.verified ? 'success' : 'warning'}>{profile.data.verified ? 'Verified' : String(profile.data.kycStatus ?? 'Not submitted')}</Chip>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Update payout details" subtitle="Required before you can convert points to cash" />
        <CardBody>
          <form className="stack" onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
            <Select
              label="Payout method"
              options={[{ value: 'UPI', label: 'UPI' }, { value: 'BANK', label: 'Bank transfer' }]}
              {...register('method')}
            />
            {method === 'UPI' ? (
              <Input label="UPI ID" placeholder="yourname@bank" error={errors.upiId?.message} {...register('upiId')} />
            ) : (
              <div className="grid grid-2">
                <Input label="Account number" inputMode="numeric" error={errors.accountNumber?.message} {...register('accountNumber')} />
                <Input label="IFSC code" placeholder="HDFC0001234" error={errors.ifsc?.message} {...register('ifsc')} />
                <Input label="Bank name" error={errors.bankName?.message} {...register('bankName')} />
                <Input label="Account holder name" error={errors.accountName?.message} {...register('accountName')} />
              </div>
            )}
            <Input label="PAN number" placeholder="ABCDE1234F" hint="Required for tax compliance on cash payouts." error={errors.panNumber?.message} {...register('panNumber')} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" loading={save.isPending}>Save payout details</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function PreferencesTab() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const prefs = useQuery({ queryKey: ['notifications', 'preferences'], queryFn: () => api.get<Record<string, boolean>>('/notifications/preferences') });

  const update = useMutation({
    mutationFn: (body: Record<string, boolean>) => api.patch('/notifications/preferences', body),
    onSuccess: () => { toast.success('Preferences saved'); void queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] }); },
  });

  return (
    <div className="stack">
      <Card>
        <CardHeader title="Appearance" />
        <CardBody>
          <Select
            label="Theme"
            options={[{ value: 'system', label: 'Match my system' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" subtitle="Choose how we reach you about points, approvals and rewards" />
        <CardBody className="stack" style={{ gap: 16 }}>
          <Switch checked={prefs.data?.inApp ?? true} label="In-app notifications" description="Always recommended — this is how approvals and points reach you." onChange={(v) => update.mutate({ inApp: v })} />
          <Switch checked={prefs.data?.email ?? true} label="Email" description="Approvals, redemptions and important account changes." onChange={(v) => update.mutate({ email: v })} />
          <Switch checked={prefs.data?.whatsapp ?? false} label="WhatsApp" description="Coming soon." onChange={(v) => update.mutate({ whatsapp: v })} />
          <Switch checked={prefs.data?.sms ?? false} label="SMS" description="Coming soon." onChange={(v) => update.mutate({ sms: v })} />
        </CardBody>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('profile');
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 860 }}>
      <PageHeader title="Settings" subtitle="Your profile, security and payout preferences" />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'security', label: 'Security' },
          ...(role === 'USER' ? [{ key: 'payout', label: 'Payouts & KYC' }] : []),
          { key: 'preferences', label: 'Preferences' },
        ]}
      />
      {tab === 'profile' ? <ProfileTab /> : null}
      {tab === 'security' ? <SecurityTab /> : null}
      {tab === 'payout' ? <PayoutTab /> : null}
      {tab === 'preferences' ? <PreferencesTab /> : null}
    </div>
  );
}
