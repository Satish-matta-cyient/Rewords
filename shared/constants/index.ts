export const ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = { USER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export const USER_STATUS = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const CAMPAIGN_STATUS = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const SUBMISSION_STATUS = [
  'DRAFT', 'PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'REVERSED', 'EXPIRED',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];

export const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'YOUTUBE', 'TELEGRAM'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TRANSACTION_TYPES = [
  'REFERRAL_BONUS', 'POST_REWARD', 'LEVEL_BONUS', 'MANUAL_CREDIT', 'MANUAL_DEBIT',
  'REDEMPTION_LOCK', 'REDEMPTION_DEBIT', 'REVERSAL', 'EXPIRY', 'REFUND',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const SOURCE_TYPES = ['SUBMISSION', 'REDEMPTION', 'REFERRAL', 'ADMIN', 'SYSTEM', 'PAYOUT'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const REDEMPTION_STATUS = [
  'REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELLED',
] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUS)[number];

export const VOUCHER_STATUS = ['UNUSED', 'RESERVED', 'ASSIGNED', 'USED', 'EXPIRED'] as const;

export const PAYOUT_STATUS = ['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'] as const;

export const KYC_STATUS = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'] as const;

export const NOTIFICATION_TYPES = [
  'REFERRAL_JOINED', 'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED', 'INFO_REQUESTED',
  'POINTS_CREDITED', 'REDEMPTION_CREATED', 'REDEMPTION_APPROVED', 'REDEMPTION_REJECTED',
  'VOUCHER_DELIVERED', 'PAYOUT_PROCESSED', 'RISK_ALERT', 'ANNOUNCEMENT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RISK_TYPES = [
  'SELF_REFERRAL', 'CIRCULAR_REFERRAL', 'DUPLICATE_PHONE', 'DUPLICATE_PAN', 'DUPLICATE_UPI',
  'DUPLICATE_URL', 'SHARED_IP', 'DEVICE_FINGERPRINT', 'HIGH_REJECTION', 'VELOCITY', 'PAYOUT_ANOMALY',
] as const;
export const RISK_SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const RISK_STATUS = ['OPEN', 'UNDER_REVIEW', 'DISMISSED', 'ACTIONED'] as const;

export const TICKET_STATUS = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const TICKET_CATEGORY = ['ACCOUNT', 'POINTS', 'REDEMPTION', 'CAMPAIGN', 'TECHNICAL', 'OTHER'] as const;

export const REWARD_CATEGORIES = [
  'SHOPPING', 'FOOD', 'TRAVEL', 'ENTERTAINMENT', 'EDUCATION', 'CASH', 'OTHER',
] as const;

export const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;

/** Setting keys — the single place economics are named. Never hardcode elsewhere. */
export const SETTING_KEYS = {
  REFERRAL_LEVEL_PERCENTAGES: 'referral.levelPercentages',
  REFERRAL_MAX_DEPTH: 'referral.maxDepth',
  REFERRAL_SIGNUP_BONUS: 'referral.signupBonus',
  CAMPAIGN_DEFAULT_CREDIT: 'campaign.defaultCredit',
  POINTS_TO_INR: 'points.inrConversion',
  POINTS_EXPIRY_DAYS: 'points.expiryDays',
  MIN_REDEMPTION_POINTS: 'redemption.minimumPoints',
  DAILY_SUBMISSION_LIMIT: 'submission.dailyLimit',
  PER_USER_MONTHLY_EARN_CAP: 'points.monthlyEarnCap',
  PAYOUT_MIN_AMOUNT: 'payout.minimumAmount',
  PAYOUT_TDS_PERCENT: 'payout.tdsPercent',
  LIVENESS_FAILURE_THRESHOLD: 'liveness.failureThreshold',
  VOUCHER_LOW_STOCK_THRESHOLD: 'voucher.lowStockThreshold',
} as const;

export const SLA_WARNING_HOURS = 24;
export const SLA_CRITICAL_HOURS = 72;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
