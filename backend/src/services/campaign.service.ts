import { prisma } from '../config/prisma';
import { campaignRepository, type CampaignFilters } from '../repositories/campaign.repository';
import { NotFoundError, BusinessRuleError, ConflictError } from '../errors';
import { paginate } from '../utils/pagination';
import { auditService, type AuditContext } from './audit.service';
import { slugify } from '../utils/reference';
import type { Platform } from '../../../shared/constants';

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

export interface CampaignInput {
  name: string; description: string; product?: string; category: string;
  creditValue: number; startDate: Date; endDate: Date; status: string;
  budgetPoints?: number | null; perUserLimit: number; platforms: Platform[];
  hashtags: string[]; captionTemplate?: string; brandGuidelines?: string;
  coverImageUrl?: string; institutionId?: string | null;
  rules: { label: string; detail: string; mandatory: boolean }[];
}

export const campaignService = {
  async list(filters: CampaignFilters, viewerId?: string) {
    const { items, total, page, pageSize } = await campaignRepository.list(filters);

    // One grouped query instead of N per-card lookups.
    const mySubmissions = viewerId
      ? await prisma.postSubmission.groupBy({
          by: ['campaignId'],
          where: { userId: viewerId, campaignId: { in: items.map((c) => c.id) }, status: { notIn: ['REJECTED', 'REVERSED'] } },
          _count: { _all: true },
        })
      : [];

    return paginate(
      items.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, description: c.description, category: c.category,
        creditValue: c.creditValue, status: c.status, startDate: c.startDate, endDate: c.endDate,
        platforms: c.platforms.map((p) => p.platform as Platform),
        coverImageUrl: c.coverImageUrl, budgetPoints: c.budgetPoints, budgetSpentPoints: c.budgetSpentPoints,
        perUserLimit: c.perUserLimit,
        submissionCount: c._count.submissions,
        mySubmissionCount: mySubmissions.find((m) => m.campaignId === c.id)?._count._all ?? 0,
        budgetExhausted: c.budgetPoints !== null && c.budgetSpentPoints >= c.budgetPoints,
        daysRemaining: Math.max(0, Math.ceil((c.endDate.getTime() - Date.now()) / 86_400_000)),
      })),
      total, page, pageSize,
    );
  },

  async detail(id: string, viewerId?: string) {
    const campaign = await campaignRepository.findById(id);
    if (!campaign) throw new NotFoundError('Campaign');

    const mySubmissionCount = viewerId
      ? await prisma.postSubmission.count({
          where: { campaignId: id, userId: viewerId, status: { notIn: ['REJECTED', 'REVERSED'] } },
        })
      : 0;

    return {
      ...campaign,
      hashtags: parseJsonArray(campaign.hashtags),
      platforms: campaign.platforms.map((p) => p.platform as Platform),
      submissionCount: campaign._count.submissions,
      mySubmissionCount,
      budgetExhausted: campaign.budgetPoints !== null && campaign.budgetSpentPoints >= campaign.budgetPoints,
      canSubmit: mySubmissionCount < campaign.perUserLimit,
    };
  },

  async create(input: CampaignInput, ctx: AuditContext) {
    let slug = slugify(input.name);
    if (await campaignRepository.findBySlug(slug)) slug = `${slug}-${Date.now().toString(36)}`;

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await campaignRepository.create({
        name: input.name, slug, description: input.description, product: input.product ?? null,
        category: input.category, creditValue: input.creditValue,
        startDate: input.startDate, endDate: input.endDate, status: input.status,
        budgetPoints: input.budgetPoints ?? null, perUserLimit: input.perUserLimit,
        captionTemplate: input.captionTemplate ?? null,
        hashtags: JSON.stringify(input.hashtags),
        brandGuidelines: input.brandGuidelines ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        institutionId: input.institutionId ?? null,
        createdById: ctx.actorId ?? null,
      }, tx);

      for (const platform of input.platforms) {
        await tx.campaignPlatform.create({ data: { campaignId: created.id, platform } });
      }
      for (const [index, rule] of input.rules.entries()) {
        await tx.campaignRule.create({ data: { campaignId: created.id, ...rule, sortOrder: index } });
      }
      return created;
    });

    await auditService.record({ ...ctx, action: 'campaign.created', entityType: 'Campaign', entityId: campaign.id, after: campaign });
    return campaign;
  },

  async update(id: string, patch: Partial<CampaignInput>, ctx: AuditContext) {
    const before = await campaignRepository.findById(id);
    if (!before) throw new NotFoundError('Campaign');

    const { platforms, rules, hashtags, ...rest } = patch;
    const updated = await prisma.$transaction(async (tx) => {
      const next = await campaignRepository.update(id, {
        ...rest,
        ...(hashtags ? { hashtags: JSON.stringify(hashtags) } : {}),
      }, tx);

      if (platforms) {
        await tx.campaignPlatform.deleteMany({ where: { campaignId: id } });
        for (const platform of platforms) await tx.campaignPlatform.create({ data: { campaignId: id, platform } });
      }
      if (rules) {
        await tx.campaignRule.deleteMany({ where: { campaignId: id } });
        for (const [index, rule] of rules.entries()) await tx.campaignRule.create({ data: { campaignId: id, ...rule, sortOrder: index } });
      }
      return next;
    });

    await auditService.record({ ...ctx, action: 'campaign.updated', entityType: 'Campaign', entityId: id, before, after: updated });
    return updated;
  },

  async changeStatus(id: string, status: string, ctx: AuditContext) {
    const before = await campaignRepository.findById(id);
    if (!before) throw new NotFoundError('Campaign');
    if (before.status === 'ARCHIVED') throw new ConflictError('Archived campaigns cannot be modified');

    const updated = await campaignRepository.update(id, { status });
    await auditService.record({
      ...ctx, action: 'campaign.status_changed', entityType: 'Campaign', entityId: id,
      before: { status: before.status }, after: { status },
    });
    return updated;
  },

  /** Server-side gate used before any submission is accepted. */
  async assertAcceptingSubmissions(campaignId: string, userId: string, platform: Platform, db = prisma) {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      include: { platforms: true },
    });
    if (!campaign) throw new NotFoundError('Campaign');
    if (campaign.status !== 'ACTIVE') throw new BusinessRuleError('This campaign is not currently accepting submissions');

    const now = new Date();
    if (campaign.startDate > now) throw new BusinessRuleError('This campaign has not started yet');
    if (campaign.endDate < now) throw new BusinessRuleError('This campaign has ended');

    if (!campaign.platforms.some((p) => p.platform === platform)) {
      throw new BusinessRuleError(`${platform} submissions are not accepted for this campaign`);
    }

    if (campaign.budgetPoints !== null && campaign.budgetSpentPoints + campaign.creditValue > campaign.budgetPoints) {
      throw new BusinessRuleError('This campaign has exhausted its points budget');
    }

    const existing = await db.postSubmission.count({
      where: { campaignId, userId, status: { in: ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } },
    });
    if (existing >= campaign.perUserLimit) {
      throw new BusinessRuleError(`You have reached the submission limit (${campaign.perUserLimit}) for this campaign`);
    }

    return campaign;
  },

  async addCreative(campaignId: string, data: { type: string; title: string; fileUrl: string; fileSize?: number; mimeType?: string }, ctx: AuditContext) {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) throw new NotFoundError('Campaign');
    const creative = await prisma.campaignCreative.create({ data: { campaignId, ...data } });
    await auditService.record({ ...ctx, action: 'campaign.creative_added', entityType: 'Campaign', entityId: campaignId, after: creative });
    return creative;
  },

  async trackCreativeDownload(creativeId: string) {
    return prisma.campaignCreative.update({ where: { id: creativeId }, data: { downloads: { increment: 1 } } });
  },
};
