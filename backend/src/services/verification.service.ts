import { prisma } from '../config/prisma';
import { submissionRepository } from '../repositories/submission.repository';
import { campaignRepository } from '../repositories/campaign.repository';
import { pointsService } from './points.service';
import { referralService } from './referral.service';
import { notificationService } from './notification.service';
import { auditService, type AuditContext } from './audit.service';
import { gamificationService } from './gamification.service';
import { riskService } from './risk.service';
import { BusinessRuleError, NotFoundError } from '../errors';
import { logger } from '../config/logger';

const DECIDABLE = new Set(['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED']);

/**
 * VerificationService owns the approve/reject lifecycle.
 * Approval is a single database transaction covering:
 *   submission status -> ledger -> wallet -> referral distribution ->
 *   campaign budget -> notification -> review trail.
 */
export const verificationService = {
  async claim(submissionId: string, reviewerId: string, ctx: AuditContext) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new NotFoundError('Submission');
    if (submission.status !== 'PENDING') return submission;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await submissionRepository.update(submissionId, { status: 'UNDER_REVIEW', reviewedById: reviewerId }, tx);
      await submissionRepository.addReview({
        submissionId, reviewerId, fromStatus: submission.status, toStatus: 'UNDER_REVIEW', reason: 'Picked up for review',
      }, tx);
      return next;
    });

    await auditService.record({ ...ctx, action: 'submission.claimed', entityType: 'PostSubmission', entityId: submissionId });
    return updated;
  },

  async approve(submissionId: string, reviewerId: string, options: { note?: string }, ctx: AuditContext) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new NotFoundError('Submission');
    if (!DECIDABLE.has(submission.status)) {
      throw new BusinessRuleError(`A submission in ${submission.status} state cannot be approved`);
    }

    const campaign = await campaignRepository.findById(submission.campaignId);
    if (!campaign) throw new NotFoundError('Campaign');

    // Budget is re-checked at decision time, not just at submission time.
    if (campaign.budgetPoints !== null && campaign.budgetSpentPoints + campaign.creditValue > campaign.budgetPoints) {
      throw new BusinessRuleError('Approving this would exceed the campaign budget. Increase the budget or reject the submission.');
    }

    await pointsService.assertWithinEarningCap(submission.userId, campaign.creditValue);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await submissionRepository.update(submissionId, {
        status: 'APPROVED',
        awardedPoints: campaign.creditValue,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      }, tx);

      const review = await submissionRepository.addReview({
        submissionId, reviewerId, fromStatus: submission.status, toStatus: 'APPROVED', reason: 'Approved',
      }, tx);
      if (options.note) {
        await tx.reviewNote.create({ data: { reviewId: review.id, body: options.note, internal: true } });
      }

      const award = await pointsService.award({
        userId: submission.userId,
        points: campaign.creditValue,
        transactionType: 'POST_REWARD',
        sourceType: 'SUBMISSION',
        sourceId: submissionId,
        description: `${campaign.name} — approved post on ${submission.platform}`,
        metadata: { campaignId: campaign.id, platform: submission.platform },
      }, tx);

      // Referral ladder is paid from the same base value, in the same transaction.
      const distribution = await referralService.distribute({
        originUserId: submission.userId,
        basePoints: campaign.creditValue,
        sourceType: 'SUBMISSION',
        sourceId: submissionId,
        description: `${campaign.name} network bonus`,
      }, tx);

      await campaignRepository.incrementSpend(campaign.id, campaign.creditValue + distribution.totalPoints, tx);

      await notificationService.create({
        userId: submission.userId,
        type: 'SUBMISSION_APPROVED',
        title: 'Your post was approved',
        body: `${campaign.name}: ${campaign.creditValue.toLocaleString()} points have been credited to your wallet.`,
        link: `/my-submissions/${submissionId}`,
        metadata: { points: campaign.creditValue },
      }, tx);

      return { updated, award, distribution };
    });

    // Non-critical follow-ups run outside the financial transaction.
    void gamificationService.refreshForUser(submission.userId).catch((error) => logger.warn({ error }, 'tier refresh failed'));

    await auditService.record({
      ...ctx, action: 'submission.approved', entityType: 'PostSubmission', entityId: submissionId,
      before: { status: submission.status },
      after: { status: 'APPROVED', points: campaign.creditValue, networkPoints: result.distribution.totalPoints },
    });

    return {
      submission: result.updated,
      pointsAwarded: campaign.creditValue,
      networkPointsDistributed: result.distribution.totalPoints,
      levelsPaid: result.distribution.breakdown,
    };
  },

  async reject(submissionId: string, reviewerId: string, input: { reason: string; note?: string }, ctx: AuditContext) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new NotFoundError('Submission');
    if (!DECIDABLE.has(submission.status)) {
      throw new BusinessRuleError(`A submission in ${submission.status} state cannot be rejected`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await submissionRepository.update(submissionId, {
        status: 'REJECTED', reviewedAt: new Date(), reviewedById: reviewerId,
      }, tx);
      const review = await submissionRepository.addReview({
        submissionId, reviewerId, fromStatus: submission.status, toStatus: 'REJECTED', reason: input.reason,
      }, tx);
      if (input.note) await tx.reviewNote.create({ data: { reviewId: review.id, body: input.note, internal: true } });

      await notificationService.create({
        userId: submission.userId,
        type: 'SUBMISSION_REJECTED',
        title: 'Your post needs attention',
        body: input.reason,
        link: `/my-submissions/${submissionId}`,
      }, tx);
      return next;
    });

    void riskService.evaluateRejectionRate(submission.userId).catch(() => undefined);

    await auditService.record({
      ...ctx, action: 'submission.rejected', entityType: 'PostSubmission', entityId: submissionId,
      before: { status: submission.status }, after: { status: 'REJECTED', reason: input.reason },
    });
    return updated;
  },

  async requestInformation(submissionId: string, reviewerId: string, input: { reason: string }, ctx: AuditContext) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new NotFoundError('Submission');
    if (!DECIDABLE.has(submission.status)) throw new BusinessRuleError('This submission is already closed');

    const updated = await prisma.$transaction(async (tx) => {
      const next = await submissionRepository.update(submissionId, { status: 'INFO_REQUESTED', reviewedById: reviewerId }, tx);
      await submissionRepository.addReview({
        submissionId, reviewerId, fromStatus: submission.status, toStatus: 'INFO_REQUESTED', reason: input.reason,
      }, tx);
      await notificationService.create({
        userId: submission.userId,
        type: 'INFO_REQUESTED',
        title: 'More information needed',
        body: input.reason,
        link: `/my-submissions/${submissionId}`,
      }, tx);
      return next;
    });

    await auditService.record({
      ...ctx, action: 'submission.info_requested', entityType: 'PostSubmission', entityId: submissionId,
      after: { reason: input.reason },
    });
    return updated;
  },

  /**
   * Reverses an approved submission: original award and every downstream
   * referral bonus are compensated with REVERSAL rows.
   */
  async reverse(submissionId: string, reviewerId: string | null, reason: string, ctx: AuditContext) {
    const submission = await submissionRepository.findById(submissionId);
    if (!submission) throw new NotFoundError('Submission');
    if (submission.status !== 'APPROVED') throw new BusinessRuleError('Only approved submissions can be reversed');

    const result = await prisma.$transaction(async (tx) => {
      const reversal = await pointsService.reverseBySource('SUBMISSION', submissionId, reason, reviewerId, tx);
      const updated = await submissionRepository.update(submissionId, { status: 'REVERSED', awardedPoints: 0 }, tx);
      await submissionRepository.addReview({
        submissionId, reviewerId, fromStatus: 'APPROVED', toStatus: 'REVERSED', reason,
      }, tx);
      await notificationService.create({
        userId: submission.userId,
        type: 'RISK_ALERT',
        title: 'Points reversed for a submission',
        body: reason,
        link: `/my-submissions/${submissionId}`,
      }, tx);
      return { updated, reversal };
    });

    await riskService.raiseFlag({
      userId: submission.userId,
      type: 'DUPLICATE_URL',
      severity: 'MEDIUM',
      summary: `Points reversed for submission ${submissionId}: ${reason}`,
      evidence: { submissionId, reason },
    });

    await auditService.record({
      ...ctx, action: 'submission.reversed', entityType: 'PostSubmission', entityId: submissionId,
      after: { reason, ...result.reversal },
    });
    return result;
  },

  /** Bulk approval processes items independently so one failure cannot block the rest. */
  async bulkApprove(ids: string[], reviewerId: string, ctx: AuditContext) {
    const results: { id: string; ok: boolean; error?: string; points?: number }[] = [];
    for (const id of ids) {
      try {
        const res = await verificationService.approve(id, reviewerId, {}, ctx);
        results.push({ id, ok: true, points: res.pointsAwarded });
      } catch (error) {
        results.push({ id, ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    await auditService.record({
      ...ctx, action: 'submission.bulk_approved', entityType: 'PostSubmission',
      metadata: { requested: ids.length, succeeded: results.filter((r) => r.ok).length },
    });
    return results;
  },

  async bulkReject(ids: string[], reviewerId: string, reason: string, ctx: AuditContext) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        await verificationService.reject(id, reviewerId, { reason }, ctx);
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    await auditService.record({
      ...ctx, action: 'submission.bulk_rejected', entityType: 'PostSubmission',
      metadata: { requested: ids.length, succeeded: results.filter((r) => r.ok).length, reason },
    });
    return results;
  },
};
