import { api } from '@/api/client';
import type { Paginated } from '@shared/types';
import type { Platform } from '@shared/constants';

export interface SubmissionRow {
  id: string; campaignId: string; campaignName: string; creditValue: number;
  platform: Platform; postUrl: string; status: string; awardedPoints: number;
  riskLevel: string; caption: string | null; notes: string | null;
  submittedAt: string; reviewedAt: string | null; ageHours: number; sla: string;
  screenshotUrl: string | null;
  user: { id: string; fullName: string; email: string; riskScore: number; avatarUrl: string | null };
}

export interface SubmissionDetail extends SubmissionRow {
  history: { id: string; fromStatus: string; toStatus: string; reason: string | null; reviewer: string; createdAt: string; notes: { id: string; body: string; internal: boolean }[] }[];
  riskSignals: { key: string; label: string; weight: number; severity: string }[];
  userStats: { status: string; _count: { _all: number } }[];
}

export interface QueueStats {
  byStatus: { status: string; count: number }[];
  agingWarning: number; agingCritical: number; pending: number;
}

export const submissionApi = {
  create: (body: FormData | Record<string, unknown>) => api.post<{ id: string }>('/submissions', body),
  mine: (filters: Record<string, unknown>) => api.get<Paginated<SubmissionRow>>('/submissions', { query: filters as never }),
  detail: (id: string) => api.get<SubmissionDetail>(`/submissions/${id}`),

  queue: (filters: Record<string, unknown>) => api.get<Paginated<SubmissionRow>>('/verifications', { query: filters as never }),
  queueStats: () => api.get<QueueStats>('/verifications/stats'),
  reviewDetail: (id: string) => api.get<SubmissionDetail>(`/verifications/${id}`),
  claim: (id: string) => api.post(`/verifications/${id}/claim`),
  approve: (id: string, note?: string) => api.post<{ pointsAwarded: number; networkPointsDistributed: number }>(`/verifications/${id}/approve`, { note }),
  reject: (id: string, reason: string, note?: string) => api.post(`/verifications/${id}/reject`, { reason, note }),
  requestInfo: (id: string, reason: string) => api.post(`/verifications/${id}/request-info`, { reason }),
  reverse: (id: string, reason: string) => api.post(`/verifications/${id}/reverse`, { reason }),
  bulkApprove: (submissionIds: string[]) => api.post<{ id: string; ok: boolean; error?: string }[]>('/verifications/bulk/approve', { submissionIds }),
  bulkReject: (submissionIds: string[], reason: string) => api.post<{ id: string; ok: boolean }[]>('/verifications/bulk/reject', { submissionIds, reason }),
};
