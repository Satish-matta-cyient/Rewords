import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry a deliberate client-side rejection.
        if (error instanceof ApiError && error.status < 500 && error.status !== 429) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Central key factory — no stringly-typed keys scattered across features. */
export const queryKeys = {
  auth: { me: ['auth', 'me'] as const },
  dashboard: { user: ['analytics', 'user'] as const, admin: (r?: string) => ['analytics', 'admin', r] as const, superAdmin: (r?: string) => ['analytics', 'super-admin', r] as const },
  wallet: { summary: ['wallet'] as const, ledger: (f: unknown) => ['wallet', 'ledger', f] as const, trend: ['wallet', 'trend'] as const },
  referrals: { me: ['referrals', 'me'] as const, tree: ['referrals', 'tree'] as const, analytics: ['referrals', 'analytics'] as const },
  campaigns: { list: (f: unknown) => ['campaigns', f] as const, detail: (id: string) => ['campaigns', id] as const },
  submissions: { mine: (f: unknown) => ['submissions', 'mine', f] as const, detail: (id: string) => ['submissions', id] as const },
  verifications: { queue: (f: unknown) => ['verifications', f] as const, stats: ['verifications', 'stats'] as const },
  rewards: { list: (f: unknown) => ['rewards', f] as const, detail: (id: string) => ['rewards', id] as const, categories: ['rewards', 'categories'] as const },
  redemptions: { mine: (f: unknown) => ['redemptions', 'mine', f] as const, admin: (f: unknown) => ['redemptions', 'admin', f] as const, detail: (id: string) => ['redemptions', id] as const },
  users: { list: (f: unknown) => ['users', f] as const, detail: (id: string) => ['users', id] as const, staff: ['users', 'staff'] as const },
  notifications: { list: (f: unknown) => ['notifications', f] as const, unread: ['notifications', 'unread'] as const },
  risk: { list: (f: unknown) => ['risk', f] as const, detail: (id: string) => ['risk', id] as const },
  audit: { list: (f: unknown) => ['audit', f] as const },
  support: { mine: (f: unknown) => ['support', 'mine', f] as const, inbox: (f: unknown) => ['support', 'inbox', f] as const, detail: (id: string) => ['support', id] as const },
  settings: { economics: ['settings', 'economics'] as const, all: ['settings'] as const },
  vouchers: { overview: ['vouchers'] as const, detail: (id: string) => ['vouchers', id] as const },
  gamification: { profile: ['gamification', 'profile'] as const, leaderboard: (s: string) => ['gamification', 'leaderboard', s] as const },
  reports: { catalogue: ['reports'] as const, run: (k: string, r: unknown) => ['reports', k, r] as const },
  institutions: { list: ['institutions'] as const },
  payouts: { profile: ['payouts', 'profile'] as const, requests: ['payouts', 'requests'] as const },
};
