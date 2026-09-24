import { api } from '@/api/client';
import type { Paginated } from '@shared/types';
import type { Platform } from '@shared/constants';

export interface CampaignListItem {
  id: string; name: string; slug: string; description: string; category: string;
  creditValue: number; status: string; startDate: string; endDate: string;
  platforms: Platform[]; coverImageUrl: string | null;
  budgetPoints: number | null; budgetSpentPoints: number; perUserLimit: number;
  submissionCount: number; mySubmissionCount: number; budgetExhausted: boolean; daysRemaining: number;
}

export interface CampaignDetail extends CampaignListItem {
  product: string | null;
  captionTemplate: string | null;
  hashtags: string[];
  brandGuidelines: string | null;
  rules: { id: string; label: string; detail: string; mandatory: boolean }[];
  creatives: { id: string; type: string; title: string; fileUrl: string; downloads: number }[];
  canSubmit: boolean;
}

export const campaignApi = {
  list: (filters: Record<string, unknown>) => api.get<Paginated<CampaignListItem>>('/campaigns', { query: filters as never }),
  detail: (id: string) => api.get<CampaignDetail>(`/campaigns/${id}`),
  create: (body: Record<string, unknown>) => api.post<CampaignDetail>('/campaigns', body),
  update: (id: string, body: Record<string, unknown>) => api.patch<CampaignDetail>(`/campaigns/${id}`, body),
  changeStatus: (id: string, status: string) => api.patch(`/campaigns/${id}/status`, { status }),
  trackDownload: (campaignId: string, creativeId: string) => api.post(`/campaigns/${campaignId}/creatives/${creativeId}/download`),
};
