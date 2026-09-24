import { api } from '@/api/client';
import type { ReferralNode } from '@shared/types';

export interface ReferralStats {
  directReferrals: number;
  totalNetwork: number;
  pointsFromNetwork: number;
  maxDepth: number;
  levelPercentages: number[];
  code: string | null;
  link: string | null;
  clicks: number;
  signups: number;
  levels: { level: number; percent: number; members: number; points: number }[];
}

export interface ReferralAnalytics extends ReferralStats {
  topPerformers: { userId: string; name: string; points: number }[];
  leaderboard: { entries: { rank: number; name: string; value: number; isYou: boolean }[]; you: { rank: number; value: number } | null };
}

export const referralApi = {
  stats: () => api.get<ReferralStats>('/referrals/me'),
  tree: (depth?: number) => api.get<ReferralNode>('/referrals/tree', { query: { depth } }),
  subtree: (userId: string) => api.get<ReferralNode>(`/referrals/${userId}`),
  analytics: () => api.get<ReferralAnalytics>('/referrals/analytics'),
};
