import { create } from 'zustand';
import type { AuthUser } from '@shared/types';
import { setAccessToken } from '@/api/client';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  setSession: (user: AuthUser, accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
  setAnonymous: () => void;
}

/**
 * Only the in-memory access token lives here. The refresh token stays in an
 * httpOnly cookie, so a XSS payload cannot exfiltrate a long-lived credential.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  setSession: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, status: 'authenticated' });
  },
  setUser: (user) => set({ user, status: 'authenticated' }),
  clear: () => {
    setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },
  setAnonymous: () => set({ user: null, status: 'anonymous' }),
}));

export const selectRole = (s: AuthState) => s.user?.role ?? null;
export const selectIsStaff = (s: AuthState) => s.user?.role === 'ADMIN' || s.user?.role === 'SUPER_ADMIN';
