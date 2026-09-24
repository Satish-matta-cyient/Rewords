import type { ReactNode } from 'react';
import { useSessionBootstrap } from '@/features/auth/hooks';

/**
 * Runs the session restore exactly once, above the router, so guards never see
 * an indeterminate auth state after a hard refresh.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  useSessionBootstrap();
  return <>{children}</>;
}
