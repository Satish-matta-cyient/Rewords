import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { forgotPasswordSchema } from '@shared/schemas';
import { Button, Input } from '@/components/ui';
import { useForgotPassword } from '../hooks';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  if (forgot.isSuccess) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Check your inbox</h1>
        <p className="muted small">
          If an account exists for that address, we have sent a password reset link. It expires in 30 minutes.
        </p>
        {/* Outside production the token is returned so the flow is testable without a mail server. */}
        {forgot.data?.token ? (
          <div className="card" style={{ padding: 14 }}>
            <div className="small" style={{ fontWeight: 600 }}>Development reset link</div>
            <Link className="small" to={`/reset-password?token=${forgot.data.token}`}>Open reset page</Link>
          </div>
        ) : null}
        <Link to="/login" className="small">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>Reset your password</h1>
        <p className="muted small" style={{ marginTop: 4 }}>Enter your email and we will send you a reset link.</p>
      </div>
      <form className="stack" onSubmit={handleSubmit((v) => forgot.mutate(v.email))} noValidate>
        <Input label="Email address" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <Button type="submit" size="lg" block loading={forgot.isPending}>Send reset link</Button>
      </form>
      <Link to="/login" className="small" style={{ textAlign: 'center' }}>Back to sign in</Link>
    </div>
  );
}
