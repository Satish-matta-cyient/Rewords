import { api } from '@/api/client';
import type { Paginated } from '@shared/types';

export interface WalletSummary {
  availablePoints: number; pendingPoints: number; pendingSubmissions: number;
  lockedPoints: number; redeemedPoints: number; expiredPoints: number;
  lifetimeEarned: number; estimatedValueInr: number;
  conversionRate: number; minRedemptionPoints: number;
}

export interface LedgerRow {
  id: string; date: string; description: string; type: string; level: number | null;
  points: number; balanceAfter: number; sourceType: string; sourceId: string;
  status: 'CREDIT' | 'DEBIT'; expiresAt: string | null;
}

export const walletApi = {
  summary: () => api.get<WalletSummary>('/wallet'),
  ledger: (filters: Record<string, unknown>) => api.get<Paginated<LedgerRow>>('/wallet/ledger', { query: filters as never }),
  trend: (days = 30) => api.get<Record<string, string | number>[]>('/wallet/trend', { query: { days } }),
};
