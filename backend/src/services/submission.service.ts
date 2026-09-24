import { prisma } from '../config/prisma';
import { submissionRepository, type SubmissionFilters } from '../repositories/submission.repository';
import { campaignService } from './campaign.service';
import { settingsService } from './settings.service';
import { riskService } from './risk.service';
import { auditService, type AuditContext } from './audit.service';
import { BusinessRuleError, ConflictError, NotFoundError, AuthorizationError } from '../errors';
import { normaliseUrl, platformMatchesUrl } from '../utils/url';
import { paginate } from '../utils/pagination';
import { startOfDay, hoursBetween } from '../utils/date';
import { SLA_CRITICAL_HOURS, SLA_WARNING_HOURS, type Platform } from '../../../shared/constants';

export interface SubmissionInput {
  campaignId: string; platform: Platform; postUrl: string;
  caption?: string; notes?: string; screenshotUrl?: string;
}

function slaBand(submittedAt: Date, status: string): 'OK' | 'WARNING' | 'CRITICAL' | 'CLOSED' {
  if (!['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(status)) return 'CLOSED';
  const age = hoursBetween(submittedAt);
  if (age > SLA_CRITICAL_HOURS) return 'CRITICAL';
  if (age > SLA_WARNING_HOURS) return 'WARNING';
  return 'OK';
}

function shape(row: {
  id: string; postUrl: string; platform: string; status: string; awardedPoints: number;
  riskLevel: string; submittedAt: Date; reviewedAt: Date | null; caption: string | null; notes: string | null;
  campaign: { id: string; name: string; creditValue: number };
  user: { id: string; fullName: string; email: string; riskScore: number; profile: { avatarUrl: string | null } | null };
  media: { fileUrl: string; type: string }[];
}) {
  return {
    id: row.id,
    campaignId: row.campaign.id,
    campaignName: row.campaign.name,
    creditValue: row.campaign.creditValue,
    platform: row.platform as Platform,
    postUrl: row.postUrl,
    status: row.status,
    awardedPoints: row.awardedPoints,
    riskLevel: row.riskLevel,
    caption: row.caption,
    notes: row.notes,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    ageHours: Number(hoursBetween(row.submittedAt).toFixed(1)),
    sla: slaBand(row.submittedAt, row.status),
    screenshotUrl: row.media.find((m) => m.type === 'SCREENSHOT')?.fileUrl ?? null,
    user: { id: row.user.id, fullName: row.user.fullName, email: row.user.email, riskScore: row.user.riskScore, avatarUrl: row.user.profile?.avatarUrl ?? null },
  };
}

export const submissionService = {
  async create(userId: string, input: SubmissionInput, ctx: AuditContext) {
    if (!platformMatchesUrl(input.platform, input.postUrl)) {
      throw new BusinessRuleError(`That URL does not look like a ${input.platform} post`);
    }

    const economics = await settingsService.getEconomics();
    const todayCount = await submissionRepository.countForUserSince(userId, startOfDay());
    if (todayCount >= economics.dailySubmissionLimit) {
      throw new BusinessRuleError(`You have reached today's submission limit of ${economics.dailySubmissionLimit}`);
    }

    await campaignService.assertAcceptingSubmissions(input.campaignId, userId, input.platform);

    const normalisedUrl = normaliseUrl(input.postUrl);
    const duplicate = await submissionRepository.findByNormalisedUrl(normalisedUrl);
    if (duplicate) {
      // A URL reused by a different account is a fraud signal, not just a validation failure.
      if (duplicate.userId !== userId) {
        await riskService.flagDuplicateUrl(userId, duplicate.userId, normalisedUrl);
        throw new ConflictError('This post has already been submitted by another ambassador');
      }
      if (duplicate.status !== 'REJECTED') {
        throw new ConflictError('You have already submitted this post');
      }
    }

    const submission = await prisma.$transaction(async (tx) => {
      const created = await submissionRepository.create({
        userId,
        campaignId: input.campaignId,
        platform: input.platform,
        postUrl: input.postUrl,
        normalisedUrl,
        caption: input.caption ?? null,
        notes: input.notes ?? null,
        status: 'PENDING',
        resubmissionOf: duplicate?.id ?? null,
      }, tx);

      if (input.screenshotUrl) {
        await tx.postMedia.create({ data: { submissionId: created.id, fileUrl: input.screenshotUrl, type: 'SCREENSHOT' } });
      }
      await submissionRepository.addReview({
        submissionId: created.id, reviewerId: null, fromStatus: 'DRAFT', toStatus: 'PENDING', reason: 'Submitted by ambassador',
      }, tx);
      return created;
    });

    const risk = await riskService.scoreSubmission(submission.id, userId);
    if (risk.level !== 'LOW') await submissionRepository.update(submission.id, { riskLevel: risk.level });

    await auditService.record({
      ...ctx, actorId: userId, action: 'submission.created', entityType: 'PostSubmission', entityId: submission.id,
      after: { campaignId: input.campaignId, platform: input.platform, postUrl: input.postUrl },
    });

    return submission;
  },

  async listForUser(userId: string, filters: SubmissionFilters) {
    const { items, total, page, pageSize } = await submissionRepository.listForUser(userId, filters);
    return paginate(items.map(shape), total, page, pageSize);
  },

  async listForReview(filters: SubmissionFilters) {
    const { items, total, page, pageSize } = await submissionRepository.list(filters);
    return paginate(items.map(shape), total, page, pageSize);
  },

  async detail(id: string, viewer: { userId: string; role: string }) {
    const submission = await submissionRepository.findById(id);
    if (!submission) throw new NotFoundError('Submission');
    const isStaff = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    if (!isStaff && submission.userId !== viewer.userId) throw new AuthorizationError();

    const history = submission.reviews.map((r) => ({
      id: r.id,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      reason: r.reason,
      reviewer: r.reviewer?.fullName ?? 'System',
      createdAt: r.createdAt,
      // Internal reviewer notes are never exposed to the ambassador.
      notes: isStaff ? r.notes : r.notes.filter((n) => !n.internal),
    }));

    const [riskSignals, userStats] = isStaff
      ? await Promise.all([
          riskService.signalsForSubmission(submission.id, submission.userId),
          prisma.postSubmission.groupBy({ by: ['status'], where: { userId: submission.userId }, _count: { _all: true } }),
        ])
      : [[], []];

    return { ...shape(submission), history, riskSignals, userStats };
  },

  async queueStats() {
    const [byStatus, warning, critical] = await Promise.all([
      submissionRepository.countByStatus(),
      submissionRepository.pendingOlderThan(SLA_WARNING_HOURS),
      submissionRepository.pendingOlderThan(SLA_CRITICAL_HOURS),
    ]);
    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      agingWarning: warning - critical,
      agingCritical: critical,
      pending: byStatus.filter((s) => ['PENDING', 'UNDER_REVIEW'].includes(s.status)).reduce((a, b) => a + b._count._all, 0),
    };
  },
};
