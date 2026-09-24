import { api } from '@/api/client';
import type { UserDashboard } from '@shared/types';

export interface AdminDashboard {
  stats: { key: string; label: string; value: number }[];
  queueByStatus: { status: string; count: number }[];
  aging: { warning: number; critical: number };
  submissionSeries: Record<string, string | number>[];
  campaignPerformance: {
    id: string; name: string; status: string; submissions: number;
    budgetPoints: number | null; budgetSpentPoints: number; budgetUsedPercent: number | null;
  }[];
  reviewerSla: { reviewerId: string; name: string; decisions: number; approved: number; rejected: number; approvalRate: number }[];
}

export interface SuperAdminDashboard {
  stats: { key: string; label: string; value: number }[];
  liability: {
    outstandingPoints: number; estimatedInrLiability: number; redeemedPoints: number;
    pendingRedemptionPoints: number; voucherLiabilityInr: number; cashPayoutLiabilityInr: number;
    conversionRate: number;
  };
  pointsSeries: Record<string, string | number>[];
  campaignRoi: { id: string; name: string; submissions: number; approved: number; approvalRate: number; pointsSpent: number; costInr: number; costPerApprovedPost: number }[];
  userGrowth: Record<string, string | number>[];
}

export const dashboardApi = {
  user: () => api.get<UserDashboard>('/analytics/dashboard'),
  admin: (range?: { from?: string; to?: string }) => api.get<AdminDashboard>('/analytics/admin', { query: range }),
  superAdmin: (range?: { from?: string; to?: string }) => api.get<SuperAdminDashboard>('/analytics/super-admin', { query: range }),
};
