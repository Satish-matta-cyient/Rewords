import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { registerSchema } from '@shared/schemas';
import { Button, Input, Checkbox } from '@/components/ui';
import { useRegister, useReferralPreview, useLogin } from '../hooks';
import { ApiError } from '@/api/client';
import { toast } from '@/store/uiStore';

type FormValues = z.infer<typeof registerSchema>;

export default function SignupPage() {
  const [params] = useSearchParams();
  const refFromUrl = params.get('ref')?.toUpperCase() ?? '';
  const navigate = useNavigate();
  const signup = useRegister();
  const login = useLogin();
  const preview = useReferralPreview(refFromUrl || null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { referralCode: refFromUrl, termsVersion: 'v1' },
  });

  // A code captured from the URL is locked so it cannot be silently swapped.
  useEffect(() => { if (refFromUrl) setValue('referralCode', refFromUrl); }, [refFromUrl, setValue]);

  const onSubmit = handleSubmit((values) => {
    signup.mutate(values, {
      onSuccess: () => {
        toast.success('Account created', 'Check your email to verify your address.');
        login.mutate({ email: values.email, password: values.password }, {
          onSuccess: () => navigate('/onboarding', { replace: true }),
          onError: () => navigate('/login', { replace: true }),
        });
      },
    });
  });

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Create your account</h1>
        <p className="muted small" style={{ marginTop: 4 }}>Start earning points for every student you bring on board.</p>
      </div>

      {preview.data?.valid ? (
        <div className="card" style={{ padding: '12px 14px', background: 'var(--accent-soft)', borderColor: 'var(--primary)' }}>
          <div className="small" style={{ fontWeight: 600, color: 'var(--primary)' }}>
            Invited by {preview.data.referrerName}
          </div>
          <div className="small muted">Referral code {preview.data.code} has been applied to your signup.</div>
        </div>
      ) : null}

      {signup.isError ? (
        <div className="chip chip--danger" role="alert" style={{ padding: '10px 14px', borderRadius: 'var(--radius)', display: 'block' }}>
          {signup.error instanceof ApiError ? signup.error.message : 'We could not create your account.'}
        </div>
      ) : null}

      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input label="Full name" autoComplete="name" placeholder="Aarav Sharma" required error={errors.fullName?.message} {...register('fullName')} />
        <Input label="Email address" type="email" autoComplete="email" placeholder="you@college.edu" required error={errors.email?.message} {...register('email')} />
        <Input label="Phone number" type="tel" autoComplete="tel" placeholder="+919876543210" required error={errors.phone?.message} {...register('phone')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          hint="Use upper and lowercase letters plus a number."
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Referral code"
          placeholder="Optional"
          readOnly={Boolean(refFromUrl)}
          hint={refFromUrl ? 'Captured from your invitation link' : 'Have a code from a friend? Enter it here.'}
          error={errors.referralCode?.message}
          {...register('referralCode')}
        />

        <Checkbox
          label={<>I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.</>}
          error={errors.acceptedTerms?.message}
          {...register('acceptedTerms')}
        />

        <Button type="submit" size="lg" block loading={signup.isPending || login.isPending}>Create account</Button>
      </form>

      <p className="small muted" style={{ textAlign: 'center' }}>
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
