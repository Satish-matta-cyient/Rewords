import { z } from 'zod';
import {
  PLATFORMS, ROLES, CAMPAIGN_STATUS, TICKET_CATEGORY, TICKET_PRIORITY,
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
} from '../constants';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9]{10,15}$/, 'Enter a valid phone number');

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,8}$/, 'Referral codes are 6-8 alphanumeric characters');

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  referralCode: referralCodeSchema.optional().or(z.literal('')),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  termsVersion: z.string().default('v1'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(10), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(10) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sortBy: z.string().optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema.optional(),
  college: z.string().trim().max(160).optional(),
  course: z.string().trim().max(120).optional(),
  graduationYear: z.coerce.number().int().min(1990).max(2100).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  interests: z.array(z.string().trim().max(40)).max(12).optional(),
  publicOnLeaderboard: z.boolean().optional(),
});

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(4000),
  product: z.string().trim().max(140).optional(),
  category: z.string().trim().max(60).default('GENERAL'),
  creditValue: z.coerce.number().int().min(1).max(1_000_000),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(CAMPAIGN_STATUS).default('DRAFT'),
  budgetPoints: z.coerce.number().int().min(0).optional().nullable(),
  perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  hashtags: z.array(z.string().trim().max(40)).max(20).default([]),
  captionTemplate: z.string().trim().max(2000).optional(),
  brandGuidelines: z.string().trim().max(4000).optional(),
  coverImageUrl: z.string().trim().max(500).optional(),
  institutionId: z.string().uuid().optional().nullable(),
  rules: z.array(z.object({
    label: z.string().trim().min(2).max(120),
    detail: z.string().trim().min(2).max(500),
    mandatory: z.boolean().default(true),
  })).max(30).default([]),
}).refine((v) => v.endDate > v.startDate, { message: 'End date must be after start date', path: ['endDate'] });

export const campaignUpdateSchema = campaignCreateSchema.innerType().partial();

const socialUrl = z
  .string()
  .trim()
  .url('Enter a valid post URL')
  .max(600)
  .refine((v) => /^https:\/\//i.test(v), 'Post URL must use https');

export const submissionCreateSchema = z.object({
  campaignId: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  postUrl: socialUrl,
  caption: z.string().trim().max(2200).optional(),
  notes: z.string().trim().max(1000).optional(),
  screenshotUrl: z.string().trim().max(600).optional(),
});

export const submissionDecisionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const submissionRejectSchema = z.object({
  reason: z.string().trim().min(3, 'A rejection reason is required').max(500),
  note: z.string().trim().max(1000).optional(),
});

export const bulkDecisionSchema = z.object({
  submissionIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().trim().max(500).optional(),
});

export const redemptionCreateSchema = z.object({
  rewardId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(5).default(1),
});

export const manualAdjustmentSchema = z.object({
  points: z.coerce.number().int().refine((v) => v !== 0, 'Points cannot be zero'),
  reason: z.string().trim().min(5, 'A reason is required for manual adjustments').max(500),
});

export const rewardSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(2000),
  categoryKey: z.string().trim().min(2).max(40),
  imageUrl: z.string().trim().max(600).optional(),
  pointsCost: z.coerce.number().int().min(1),
  cashValue: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  badge: z.string().trim().max(40).optional(),
  terms: z.string().trim().max(2000).optional(),
  deliveryType: z.enum(['VOUCHER_CODE', 'CASH_PAYOUT', 'PHYSICAL', 'MANUAL']).default('VOUCHER_CODE'),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const voucherUploadSchema = z.object({
  rewardId: z.string().uuid(),
  codes: z.array(z.string().trim().min(4).max(64)).min(1).max(5000),
  batchRef: z.string().trim().max(60).optional(),
  expiresAt: z.coerce.date().optional(),
});

export const payoutProfileSchema = z.object({
  method: z.enum(['UPI', 'BANK']),
  upiId: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/).optional(),
  ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC').optional(),
  bankName: z.string().trim().max(120).optional(),
  accountName: z.string().trim().max(120).optional(),
  panNumber: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN').optional(),
}).refine(
  (v) => (v.method === 'UPI' ? Boolean(v.upiId) : Boolean(v.accountNumber && v.ifsc)),
  { message: 'Provide the details required for the selected payout method' },
);

export const payoutRequestSchema = z.object({ points: z.coerce.number().int().min(1) });

export const ticketCreateSchema = z.object({
  category: z.enum(TICKET_CATEGORY),
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(4000),
  priority: z.enum(TICKET_PRIORITY).default('MEDIUM'),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().default(false),
});

export const economicsSchema = z.object({
  referralLevelPercentages: z.array(z.coerce.number().min(0).max(100)).min(1).max(10),
  referralMaxDepth: z.coerce.number().int().min(1).max(10),
  referralSignupBonus: z.coerce.number().int().min(0),
  campaignDefaultCredit: z.coerce.number().int().min(1),
  pointsToInr: z.coerce.number().min(0.0001),
  minRedemptionPoints: z.coerce.number().int().min(1),
  dailySubmissionLimit: z.coerce.number().int().min(1).max(100),
  pointsExpiryDays: z.coerce.number().int().min(0),
  monthlyEarnCap: z.coerce.number().int().min(0),
});

export const adminCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'SUPER_ADMIN']),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(4000),
  audience: z.enum(['ALL', 'TIER', 'CAMPAIGN', 'ACTIVE', 'SEGMENT']).default('ALL'),
  audienceRef: z.string().trim().max(120).optional(),
  severity: z.enum(['INFO', 'SUCCESS', 'WARNING']).default('INFO'),
  publishNow: z.boolean().default(true),
});

export const roleSchema = z.enum(ROLES);
