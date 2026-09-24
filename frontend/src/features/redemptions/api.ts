import { api } from '@/api/client';
import type { Paginated } from '@shared/types';

export interface RedemptionRow {
  id: string; reference: string; reward: string; rewardImage?: string | null;
  deliveryType: string; pointsSpent: number; cashValue: number; status: string;
  createdAt: string; fulfilledAt?: string | null; rejectionReason?: string | null;
  user?: { id: string; fullName: string; email: string }; ageHours?: number; reviewedAt?: string | null;
}

export interface RedemptionDetail {
  id: string; reference: string; status: string; pointsSpent: number; cashValue: number;
  rejectionReason: string | null; createdAt: string; reviewedAt: string | null; fulfilledAt: string | null;
  reward: { id: string; title: string; imageUrl: string | null; deliveryType: string; cashValue: number };
  items: { id: string; label: string; quantity: number; pointsEach: number }[];
  user?: { id: string; fullName: string; email: string };
  timeline: { key: string; label: string; at: string | null; done: boolean; negative?: boolean; reason?: string | null }[];
  voucherAvailable: boolean;
}

export const redemptionApi = {
  create: (rewardId: string, quantity = 1) => api.post<{ id: string; reference: string }>('/redemptions', { rewardId, quantity }),
  mine: (filters: Record<string, unknown>) => api.get<Paginated<RedemptionRow>>('/redemptions', { query: filters as never }),
  detail: (id: string) => api.get<RedemptionDetail>(`/redemptions/${id}`),
  revealVoucher: (id: string) => api.post<{ code: string; expiresAt: string | null }>(`/redemptions/${id}/voucher`),

  adminList: (filters: Record<string, unknown>) => api.get<Paginated<RedemptionRow>>('/redemptions/admin', { query: filters as never }),
  approve: (id: string) => api.post(`/redemptions/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/redemptions/${id}/reject`, { reason }),
  fulfil: (id: string) => api.post(`/redemptions/${id}/fulfil`),
};
