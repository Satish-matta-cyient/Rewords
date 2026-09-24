import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminCreateSchema } from '@shared/schemas';
import { userApi } from './api';
import { queryClient, queryKeys } from '@/api/queryClient';
import {
  DataTable, PageHeader, Button, Dialog, Input, Select, StatusChip, Chip, type Column,
} from '@/components/ui';
import { formatRelative } from '@/utils/format';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

type FormValues = z.infer<typeof adminCreateSchema>;
interface StaffRow { id: string; fullName: string; email: string; role: string; status: string; decisions: number; lastLoginAt: string | null }

export default function AdminsPage() {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.users.staff, queryFn: userApi.listStaff });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(adminCreateSchema),
    defaultValues: { role: 'ADMIN' },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => userApi.createStaff(values),
    onSuccess: () => {
      toast.success('Administrator created', 'Share the credentials securely and ask them to change the password on first sign-in.');
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.staff });
      setOpen(false); reset();
    },
    onError: (error) => toast.error('Could not create administrator', error instanceof ApiError ? error.message : undefined),
  });

  const columns: Column<StaffRow>[] = [
    {
      key: 'name', header: 'Administrator', primary: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{row.fullName}</div>
          <div className="small muted">{row.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', primary: true, render: (row) => <Chip tone="primary">{row.role.replace('_', ' ')}</Chip> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    { key: 'decisions', header: 'Review decisions', numeric: true, render: (row) => <span className="mono">{row.decisions}</span> },
    { key: 'active', header: 'Last active', hideOnMobile: true, render: (row) => <span className="small muted">{row.lastLoginAt ? formatRelative(row.lastLoginAt) : 'Never'}</span> },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <PageHeader
        title="Administrators"
        subtitle="Who can verify posts, approve redemptions and change platform settings"
        action={<Button onClick={() => setOpen(true)}>Create administrator</Button>}
      />

      <DataTable
        columns={columns}
        rows={query.data ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        emptyTitle="No administrators yet"
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Create an administrator"
        description="Admin accounts are created active and email-verified. Every action they take is audited."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>Create account</Button>
          </>
        }
      >
        <form className="stack" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
          <Input label="Full name" required error={errors.fullName?.message} {...register('fullName')} />
          <Input label="Email address" type="email" required error={errors.email?.message} {...register('email')} />
          <Input label="Phone number" type="tel" error={errors.phone?.message} {...register('phone')} />
          <Input
            label="Temporary password" type="password" required
            hint="At least 10 characters with upper and lowercase letters plus a number."
            error={errors.password?.message} {...register('password')}
          />
          <Select
            label="Role" required
            options={[{ value: 'ADMIN', label: 'Administrator' }, { value: 'SUPER_ADMIN', label: 'Super Administrator' }]}
            error={errors.role?.message} {...register('role')}
          />
        </form>
      </Dialog>
    </div>
  );
}
