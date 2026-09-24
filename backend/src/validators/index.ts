import { z } from 'zod';
import { paginationSchema, dateRangeSchema } from '../../../shared/schemas';
import {
  SUBMISSION_STATUS, PLATFORMS, CAMPAIGN_STATUS, REDEMPTION_STATUS,
  RISK_SEVERITY, RISK_STATUS, RISK_TYPES, TICKET_STATUS, TICKET_PRIORITY, TICKET_CATEGORY, ROLES,
} from '../../../shared/constants';

export const listQuerySchema = paginationSchema.merge(dateRangeSchema);

export const userListQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  role: z.enum(ROLES).optional(),
  institutionId: z.string().uuid().optional(),
  riskOnly: z.coerce.boolean().optional(),
});

export const submissionQuerySchema = listQuerySchema.extend({
  status: z.enum(SUBMISSION_STATUS).optional(),
  campaignId: z.string().uuid().optional(),
  platform: z.enum(PLATFORMS).optional(),
  userId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const campaignQuerySchema = listQuerySchema.extend({
  status: z.enum(CAMPAIGN_STATUS).optional(),
  category: z.string().optional(),
  platform: z.enum(PLATFORMS).optional(),
  activeOnly: z.coerce.boolean().optional(),
  institutionId: z.string().uuid().optional(),
});

export const rewardQuerySchema = listQuerySchema.extend({
  categoryKey: z.string().optional(),
  minPoints: z.coerce.number().int().min(0).optional(),
  maxPoints: z.coerce.number().int().min(0).optional(),
  featuredOnly: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

export const redemptionQuerySchema = listQuerySchema.extend({
  status: z.enum(REDEMPTION_STATUS).optional(),
  userId: z.string().uuid().optional(),
});

export const ledgerQuerySchema = listQuerySchema.extend({
  transactionType: z.string().optional(),
  level: z.coerce.number().int().optional(),
});

export const auditQuerySchema = listQuerySchema.extend({
  actorId: z.string().uuid().optional(),
  actorRole: z.enum(ROLES).optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export const riskQuerySchema = listQuerySchema.extend({
  status: z.enum(RISK_STATUS).optional(),
  severity: z.enum(RISK_SEVERITY).optional(),
  type: z.enum(RISK_TYPES).optional(),
  userId: z.string().uuid().optional(),
});

export const ticketQuerySchema = listQuerySchema.extend({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
  category: z.enum(TICKET_CATEGORY).optional(),
  assigneeId: z.string().uuid().optional(),
});

export const statusChangeSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().trim().min(3, 'A reason is required').max(500),
});

export const campaignStatusSchema = z.object({ status: z.enum(CAMPAIGN_STATUS) });

export const riskResolveSchema = z.object({
  decision: z.enum(['DISMISSED', 'ACTIONED']),
  note: z.string().trim().min(3).max(1000),
});

export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  password: z.string().min(10),
});

export const onboardingSchema = z.object({ step: z.coerce.number().int().min(0).max(3) });

export const roleChangeSchema = z.object({ role: z.enum(ROLES) });

export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export const payoutDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

export const kycDecisionSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

export * from '../../../shared/schemas';
