import { api } from '@/api/client';
import type { Paginated } from '@shared/types';
import type { Role } from '@shared/constants';

export interface UserRow {
  id: string; fullName: string; email: string; phone: string | null;
  status: string; role: string; riskScore: number;
  availablePoints: number; lifetimeEarned: number; referralCode: string | null;
  directReferrals: number; submissions: number;
  lastLoginAt: string | null; createdAt: string;
}

export interface UserDetail {
  id: string; fullName: string; email: string; phone: string | null; status: string; role: string;
  riskScore: number; emailVerified: boolean; createdAt: string; lastLoginAt: string | null;
  institution: { id: string; name: string } | null;
  profile: Record<string, unknown> | null;
  wallet: { availablePoints: number; lockedPoints: number; redeemedPoints: number; lifetimeEarned: number } | null;
  tier: { key: string; name: string } | null;
  referral: { directReferrals: number; totalNetwork: number; pointsFromNetwork: number; code: string | null; levels: { level: number; members: number; points: number }[] };
  counts: { submissions: number; redemptions: number; referralAsParent: number; riskFlags: number };
  payout: { method: string; upiId: string | null; account: string; pan: string; verified: boolean } | null;
  recentSubmissions: { id: string; campaign: string; platform: string; status: string; awardedPoints: number; submittedAt: string }[];
  recentRedemptions: { id: string; reference: string; reward: string; status: string; pointsSpent: number; createdAt: string }[];
  openFlags: { id: string; type: string; severity: string; summary: string; createdAt: string }[];
  recentLedger: { id: string; transactionType: string; points: number; description: string; createdAt: string }[];
}

export const userApi = {
  list: (filters: Record<string, unknown>) => api.get<Paginated<UserRow>>('/users', { query: filters as never }),
  detail: (id: string) => api.get<UserDetail>(`/users/${id}`),
  setStatus: (id: string, status: string, reason: string) => api.patch(`/users/${id}/status`, { status, reason }),
  adjustPoints: (id: string, points: number, reason: string) => api.post(`/users/${id}/points`, { points, reason }),
  changeRole: (id: string, role: Role) => api.patch(`/users/${id}/role`, { role }),
  listStaff: () => api.get<{ id: string; fullName: string; email: string; role: string; status: string; decisions: number; lastLoginAt: string | null }[]>('/users/staff'),
  createStaff: (body: Record<string, unknown>) => api.post('/users/staff', body),
  remove: (id: string, reason: string) => api.delete(`/users/${id}`, { reason }),
  me: () => api.get<UserDetail>('/users/me'),
  updateMe: (body: Record<string, unknown>) => api.patch('/users/me', body),
};
