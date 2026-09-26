import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ROLE_RANK, type Role } from '@shared/constants';
import { Skeleton } from '@/components/ui';

export function BootSplash() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <div className="stack" style={{ width: 'min(420px, 100%)' }}>
        <Skeleton height={34} width="45%" />
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    </div>
  );
}

/** Requires an authenticated session; preserves the intended destination. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <BootSplash />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Requires a minimum role. Insufficient privileges land on /403, not /login. */
export function RequireRole({ minimum }: { minimum: Role }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === 'loading') return <BootSplash />;
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) return <Navigate to="/403" replace />;
  return <Outlet />;
}

/** Signed-in users never see the login or signup screens. */
export function RedirectIfAuthenticated() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation() as { state?: { from?: { pathname: string } } };

  if (status === 'loading') return <BootSplash />;
  if (status === 'authenticated' && user) {
    const intended = location.state?.from?.pathname;
    if (intended && intended !== '/login') return <Navigate to={intended} replace />;
    const home = user.role === 'SUPER_ADMIN' ? '/super-admin' : user.role === 'ADMIN' ? '/admin' : '/dashboard';
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}

export function HomeRedirect() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  if (status === 'loading') return <BootSplash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/super-admin" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.onboardingStep < 3) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}
