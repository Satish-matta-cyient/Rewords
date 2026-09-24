import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authApi } from './api';
import { useAuthStore } from '@/store/authStore';
import { setUnauthorizedHandler, getAccessToken, setAccessToken, ApiError } from '@/api/client';
import { queryClient, queryKeys } from '@/api/queryClient';
import { toast } from '@/store/uiStore';

/**
 * Restores the session on boot. The access token lives only in memory, so a
 * page refresh always exchanges the httpOnly refresh cookie for a new one.
 */
export function useSessionBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const setAnonymous = useAuthStore((s) => s.setAnonymous);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
      queryClient.clear();
    });
  }, [clear]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The access token is memory-only, so a refresh always exchanges the
        // httpOnly cookie first, then loads the profile.
        if (!getAccessToken()) {
          const refreshed = await authApi.refresh().catch(() => null);
          if (refreshed) setAccessToken(refreshed.accessToken);
        }
        const user = await authApi.me();
        if (!cancelled) setSession(user, getAccessToken() ?? '');
      } catch {
        if (!cancelled) setAnonymous();
      }
    })();
    return () => { cancelled = true; };
  }, [setSession, setAnonymous]);
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setSession(data.user, data.accessToken);
      queryClient.clear();
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => { clear(); queryClient.clear(); },
  });
}

export function useCurrentUser() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.me,
    enabled: Boolean(user),
    initialData: user ?? undefined,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => toast.success('Check your inbox', 'If that email is registered, a reset link is on its way.'),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => toast.success('Password updated', 'Sign in with your new password.'),
  });
}

export function useVerifyEmail(token: string | null) {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['auth', 'verify', token],
    queryFn: async () => {
      const result = await authApi.verifyEmail(token as string);
      const user = await authApi.me().catch(() => null);
      if (user) setUser(user);
      return result;
    },
    enabled: Boolean(token),
    retry: false,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => toast.success('Password changed'),
    onError: (error) => toast.error('Could not change password', error instanceof ApiError ? error.message : undefined),
  });
}

export function useReferralPreview(code: string | null) {
  return useQuery({
    queryKey: ['auth', 'referral', code],
    queryFn: () => authApi.resolveReferral(code as string),
    enabled: Boolean(code && /^[A-Z0-9]{6,8}$/.test(code)),
    retry: false,
  });
}

/** Invalidates everything that depends on the wallet after a points-changing action. */
export function useInvalidatePoints() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ['wallet'] });
    void client.invalidateQueries({ queryKey: ['analytics'] });
    void client.invalidateQueries({ queryKey: ['rewards'] });
    void client.invalidateQueries({ queryKey: ['notifications'] });
  };
}
