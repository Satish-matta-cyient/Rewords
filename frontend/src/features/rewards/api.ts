import { api } from '@/api/client';
import type { Paginated } from '@shared/types';

export interface RewardItem {
  id: string; title: string; description: string; category: string; categoryName: string;
  imageUrl: string | null; pointsCost: number; cashValue: number; stock: number; inStock: boolean;
  badge: string | null; featured: boolean; deliveryType: string; active: boolean;
  affordable: boolean; balanceAfter: number | null;
}

export interface RewardDetail extends RewardItem {
  terms: string | null;
  minRedemptionPoints: number;
}

export const rewardApi = {
  list: (filters: Record<string, unknown>) => api.get<Paginated<RewardItem>>('/rewards', { query: filters as never }),
  detail: (id: string) => api.get<RewardDetail>(`/rewards/${id}`),
  categories: () => api.get<{ id: string; key: string; name: string }[]>('/rewards/categories'),
  create: (body: Record<string, unknown>) => api.post('/rewards', body),
  update: (id: string, body: Record<string, unknown>) => api.patch(`/rewards/${id}`, body),
};
