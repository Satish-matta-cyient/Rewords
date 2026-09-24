import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { passwordSchema } from '@shared/schemas';
import { Button, Input } from '@/components/ui';
import { useResetPassword } from '../hooks';
import { ApiError } from '@/api/client';

const schema = z.object({
  password: passwordSchema,
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const reset = useResetPassword();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Invalid reset link</h1>
        <p className="muted small">This link is missing its token. Request a new one to continue.</p>
        <Link to="/forgot-password" className="small">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>Choose a new password</h1>
        <p className="muted small" style={{ marginTop: 4 }}>Signing in elsewhere will be required after this change.</p>
      </div>

      {reset.isError ? (
        <div className="chip chip--danger" role="alert" style={{ padding: '10px 14px', borderRadius: 'var(--radius)', display: 'block' }}>
          {reset.error instanceof ApiError ? reset.error.message : 'Could not reset your password.'}
        </div>
      ) : null}

      <form
        className="stack"
        onSubmit={handleSubmit((v) => reset.mutate({ token, password: v.password }, { onSuccess: () => navigate('/login') }))}
        noValidate
      >
        <Input label="New password" type="password" autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" size="lg" block loading={reset.isPending}>Update password</Button>
      </form>
    </div>
  );
}
