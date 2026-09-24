import { Link, useSearchParams } from 'react-router-dom';
import { Button, Skeleton } from '@/components/ui';
import { useVerifyEmail } from '../hooks';
import { authApi } from '../api';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/store/uiStore';
import { ApiError } from '@/api/client';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const verify = useVerifyEmail(token);
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: (data) => toast.success('Verification email sent', data.token ? `Dev token: ${data.token.slice(0, 12)}…` : undefined),
  });

  if (!token) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Verify your email</h1>
        <p className="muted small">We sent a verification link to your inbox. Open it to activate your account and start submitting posts.</p>
        <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Resend verification email</Button>
        <Link to="/dashboard" className="small">Continue to dashboard</Link>
      </div>
    );
  }

  if (verify.isPending) {
    return <div className="stack"><Skeleton height={28} width="60%" /><Skeleton height={60} /></div>;
  }

  if (verify.isError) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: 24 }}>Verification failed</h1>
        <p className="muted small">{verify.error instanceof ApiError ? verify.error.message : 'This link is invalid or has expired.'}</p>
        <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Send a new link</Button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1 style={{ fontSize: 24 }}>Email verified</h1>
      <p className="muted small">Your account is active. You can now submit posts and redeem rewards.</p>
      <Link to="/onboarding"><Button size="lg" block>Continue setup</Button></Link>
    </div>
  );
}
