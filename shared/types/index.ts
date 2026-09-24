import type {
  Role, UserStatus, CampaignStatus, SubmissionStatus, Platform,
  TransactionType, RedemptionStatus, NotificationType,
} from '../constants';

export interface ApiSuccess<T> { success: true; data: T; meta?: Record<string, unknown>; }
export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown; requestId?: string };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number; pageSize: number; total: number; totalPages: number;
  hasNext: boolean; hasPrev: boolean;
}
export interface Paginated<T> { items: T[]; pagination: PaginationMeta; }

export interface AuthUser {
  id: string; email: string; fullName: string; role: Role; status: UserStatus;
  emailVerified: boolean; avatarUrl?: string | null; onboardingStep: number;
  referralCode?: string | null; institutionId?: string | null;
}

export interface WalletSummary {
  availablePoints: number; pendingPoints: number; lockedPoints: number;
  redeemedPoints: number; expiredPoints: number; lifetimeEarned: number;
  estimatedValueInr: number;
}

export interface LedgerEntry {
  id: string; transactionType: TransactionType; points: number; balanceAfter: number;
  level: number | null; description: string; sourceType: string; sourceId: string;
  createdAt: string;
}

export interface ReferralNode {
  userId: string; fullName: string; email: string; avatarUrl?: string | null;
  depth: number; joinedAt: string; status: UserStatus;
  pointsGenerated: number; directReferrals: number; children: ReferralNode[];
}

export interface CampaignSummary {
  id: string; name: string; slug: string; description: string; category: string;
  creditValue: number; status: CampaignStatus; startDate: string; endDate: string;
  platforms: Platform[]; coverImageUrl?: string | null;
  budgetPoints: number | null; budgetSpentPoints: number;
  submissionCount: number; mySubmissionCount?: number; perUserLimit: number;
}

export interface SubmissionSummary {
  id: string; campaignName: string; campaignId: string; platform: Platform;
  postUrl: string; status: SubmissionStatus; awardedPoints: number;
  riskLevel: string; submittedAt: string; reviewedAt: string | null;
  userFullName?: string; userEmail?: string; ageHours?: number;
  screenshotUrl?: string | null;
}

export interface DashboardStat { key: string; label: string; value: number; delta?: number; hint?: string; format?: 'number' | 'currency' | 'percent'; }
export interface SeriesPoint { label: string; [key: string]: string | number; }

export interface UserDashboard {
  greetingName: string;
  stats: DashboardStat[];
  referral: { code: string; link: string; signupBonus: number };
  referralPerformance: SeriesPoint[];
  pointsTrend: SeriesPoint[];
  recentActivity: { id: string; title: string; detail: string; points?: number; createdAt: string; type: string }[];
  recommendedRewards: { id: string; title: string; pointsCost: number; cashValue: number; imageUrl: string | null; category: string; affordable: boolean }[];
  tier: { key: string; name: string; nextKey: string | null; progressPercent: number } | null;
}

export interface NotificationItem {
  id: string; type: NotificationType; title: string; body: string;
  link: string | null; readAt: string | null; createdAt: string;
}
