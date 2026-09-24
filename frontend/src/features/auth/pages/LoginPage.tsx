import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginSchema } from '@shared/schemas';
import { z } from 'zod';
import { Button, Input } from '@/components/ui';
import { useLogin } from '../hooks';
import { ApiError } from '@/api/client';

type FormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: (data) => {
        const intended = location.state?.from?.pathname;
        if (intended && intended !== '/login') { navigate(intended, { replace: true }); return; }
        if (data.user.role === 'SUPER_ADMIN') navigate('/super-admin', { replace: true });
        else if (data.user.role === 'ADMIN') navigate('/admin', { replace: true });
        else if (data.user.onboardingStep < 3) navigate('/onboarding', { replace: true });
        else navigate('/dashboard', { replace: true });
      },
    });
  });

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Welcome back</h1>
        <p className="muted small" style={{ marginTop: 4 }}>Sign in to your EduRewards ambassador account.</p>
      </div>

      {login.isError ? (
        <div className="chip chip--danger" role="alert" style={{ padding: '10px 14px', borderRadius: 'var(--radius)', display: 'block' }}>
          {login.error instanceof ApiError ? login.error.message : 'Sign in failed. Please try again.'}
        </div>
      ) : null}

      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@college.edu"
          error={errors.email?.message}
          required
          {...register('email')}
        />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <Link to="/forgot-password" className="small">Forgot your password?</Link>
          </div>
        </div>

        <Button type="submit" size="lg" block loading={login.isPending}>Sign in</Button>
      </form>

      <p className="small muted" style={{ textAlign: 'center' }}>
        New to EduRewards? <Link to="/signup">Create an account</Link>
      </p>

      {import.meta.env.DEV ? (
        <div className="card" style={{ padding: 14 }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Development accounts</div>
          <div className="small muted">admin@edurewards.local · ops@edurewards.local · ambassador@edurewards.local</div>
          <div className="small muted" style={{ marginTop: 4 }}>Password is whatever you set as <code>SEED_PASSWORD</code>.</div>
        </div>
      ) : null}
    </div>
  );
}
