import { prisma } from '../config/prisma';
import { payoutRepository } from '../repositories/payout.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { pointsService } from './points.service';
import { settingsService } from './settings.service';
import { notificationService } from './notification.service';
import { riskService } from './risk.service';
import { auditService, type AuditContext } from './audit.service';
import { encrypt, last4, maskAccount, maskPan } from '../utils/crypto';
import { BusinessRuleError, NotFoundError } from '../errors';
import { makeReference } from '../utils/reference';

export const payoutService = {
  /** Bank account and PAN are encrypted at rest; only last-4 is kept in the clear. */
  async saveProfile(userId: string, input: Record<string, string | undefined> & { method: string }, ctx: AuditContext) {
    if (input.upiId) {
      const duplicate = await payoutRepository.findDuplicateUpi(input.upiId, userId);
      if (duplicate) {
        await riskService.raiseFlag({
          userId, type: 'DUPLICATE_UPI', severity: 'HIGH',
          summary: 'This UPI ID is already attached to another account',
          evidence: { otherUserId: duplicate.userId },
        });
        throw new BusinessRuleError('This UPI ID is already registered to another account');
      }
    }

    if (input.panNumber) {
      const panL4 = last4(input.panNumber);
      const duplicates = await payoutRepository.findDuplicatePan(panL4, userId);
      if (duplicates.length > 0) {
        await riskService.raiseFlag({
          userId, type: 'DUPLICATE_PAN', severity: 'HIGH',
          summary: 'A PAN with the same last four digits exists on another account',
          evidence: { matches: duplicates.length },
        });
      }
    }

    const saved = await payoutRepository.upsertProfile(userId, {
      userId,
      method: input.method,
      upiId: input.upiId ?? null,
      accountNumber: input.accountNumber ? encrypt(input.accountNumber) : null,
      accountLast4: input.accountNumber ? last4(input.accountNumber) : null,
      ifsc: input.ifsc ?? null,
      bankName: input.bankName ?? null,
      accountName: input.accountName ?? null,
      panNumber: input.panNumber ? encrypt(input.panNumber) : null,
      panLast4: input.panNumber ? last4(input.panNumber) : null,
      verified: false,
    });

    await auditService.record({
      ...ctx, actorId: userId, action: 'payout.profile_updated', entityType: 'PayoutProfile', entityId: saved.id,
      after: { method: input.method },
    });
    return payoutService.maskedProfile(userId);
  },

  async maskedProfile(userId: string) {
    const profile = await payoutRepository.profile(userId);
    const kyc = await payoutRepository.latestKyc(userId);
    if (!profile) return { configured: false, kycStatus: kyc?.status ?? null };
    return {
      configured: true,
      method: profile.method,
      upiId: profile.upiId ? `${profile.upiId.slice(0, 2)}****${profile.upiId.slice(-4)}` : null,
      account: maskAccount(profile.accountLast4),
      ifsc: profile.ifsc,
      bankName: profile.bankName,
      pan: maskPan(profile.panLast4),
      verified: profile.verified,
      kycStatus: kyc?.status ?? null,
    };
  },

  async submitKyc(userId: string, input: { documentType: string; documentUrl: string }, ctx: AuditContext) {
    const record = await payoutRepository.createKyc({ userId, ...input, status: 'SUBMITTED' });
    await auditService.record({
      ...ctx, actorId: userId, action: 'kyc.submitted', entityType: 'KycRecord', entityId: record.id,
      after: { documentType: input.documentType },
    });
    return { id: record.id, status: record.status, createdAt: record.createdAt };
  },

  async reviewKyc(kycId: string, decision: 'VERIFIED' | 'REJECTED', reviewerId: string, reason: string | undefined, ctx: AuditContext) {
    const record = await prisma.kycRecord.findUnique({ where: { id: kycId } });
    if (!record) throw new NotFoundError('KYC record');

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.kycRecord.update({
        where: { id: kycId },
        data: { status: decision, reviewerId, reviewedAt: new Date(), rejectionReason: reason ?? null },
      });
      if (decision === 'VERIFIED') {
        await tx.payoutProfile.updateMany({ where: { userId: record.userId }, data: { verified: true } });
      }
      return next;
    });

    await notificationService.create({
      userId: record.userId,
      type: 'ANNOUNCEMENT',
      title: decision === 'VERIFIED' ? 'KYC verified' : 'KYC needs attention',
      body: decision === 'VERIFIED' ? 'You can now request cash payouts.' : reason ?? 'Please resubmit your documents.',
      link: '/settings',
    });

    await auditService.record({
      ...ctx, action: `kyc.${decision.toLowerCase()}`, entityType: 'KycRecord', entityId: kycId,
      before: { status: record.status }, after: { status: decision },
    });
    return updated;
  },

  async requestPayout(userId: string, points: number, ctx: AuditContext) {
    const [profile, wallet, economics] = await Promise.all([
      payoutRepository.profile(userId),
      walletRepository.ensure(userId),
      settingsService.getEconomics(),
    ]);

    if (!profile) throw new BusinessRuleError('Add your payout details before requesting a payout');
    if (!profile.verified) throw new BusinessRuleError('Your KYC must be verified before requesting a payout');
    if (wallet.availablePoints < points) throw new BusinessRuleError('You do not have enough available points');

    const grossAmount = Number((points * economics.pointsToInr).toFixed(2));
    if (grossAmount < economics.payoutMinAmount) {
      throw new BusinessRuleError(`The minimum payout is ₹${economics.payoutMinAmount}`);
    }
    const tdsAmount = Number(((grossAmount * economics.payoutTdsPercent) / 100).toFixed(2));

    const request = await prisma.$transaction(async (tx) => {
      const created = await payoutRepository.createRequest({
        reference: makeReference('PAY'),
        userId, points, grossAmount, tdsAmount,
        netAmount: Number((grossAmount - tdsAmount).toFixed(2)),
        method: profile.method,
        status: 'REQUESTED',
      }, tx);

      await pointsService.award({
        userId,
        points: -points,
        transactionType: 'REDEMPTION_LOCK',
        sourceType: 'PAYOUT',
        sourceId: created.id,
        description: `Points locked for payout ${created.reference}`,
      }, tx);
      return created;
    });

    await auditService.record({
      ...ctx, actorId: userId, action: 'payout.requested', entityType: 'PayoutRequest', entityId: request.id,
      after: { points, grossAmount },
    });
    return request;
  },

  async decide(id: string, decision: 'APPROVED' | 'REJECTED', adminId: string, reason: string | undefined, ctx: AuditContext) {
    const request = await payoutRepository.findRequest(id);
    if (!request) throw new NotFoundError('Payout request');
    if (request.status !== 'REQUESTED') throw new BusinessRuleError('This payout has already been actioned');

    const updated = await prisma.$transaction(async (tx) => {
      if (decision === 'REJECTED') {
        await pointsService.award({
          userId: request.userId,
          points: request.points,
          transactionType: 'REFUND',
          sourceType: 'PAYOUT',
          sourceId: request.id,
          description: `Payout ${request.reference} declined — points returned`,
        }, tx);
        await tx.wallet.update({
          where: { userId: request.userId },
          data: { lockedPoints: { decrement: request.points }, lifetimeEarned: { decrement: request.points } },
        });
      } else {
        await pointsService.award({
          userId: request.userId,
          points: -request.points,
          transactionType: 'REDEMPTION_DEBIT',
          sourceType: 'PAYOUT',
          sourceId: request.id,
          description: `Payout ${request.reference} approved`,
        }, tx);
      }

      return payoutRepository.updateRequest(id, {
        status: decision, approvedById: adminId, failureReason: reason ?? null,
      }, tx);
    });

    await notificationService.create({
      userId: request.userId,
      type: 'PAYOUT_PROCESSED',
      title: decision === 'APPROVED' ? 'Payout approved' : 'Payout declined',
      body: decision === 'APPROVED' ? `₹${request.netAmount} will reach you shortly.` : reason ?? 'Your points have been returned.',
      link: '/wallet',
    });

    await auditService.record({
      ...ctx, action: `payout.${decision.toLowerCase()}`, entityType: 'PayoutRequest', entityId: id,
      before: { status: request.status }, after: { status: decision },
    });
    return updated;
  },

  async markProcessed(id: string, utrNumber: string, ctx: AuditContext) {
    const request = await payoutRepository.findRequest(id);
    if (!request) throw new NotFoundError('Payout request');
    if (request.status !== 'APPROVED') throw new BusinessRuleError('Only approved payouts can be marked as processed');

    const updated = await payoutRepository.updateRequest(id, { status: 'COMPLETED', utrNumber, processedAt: new Date() });
    await auditService.record({ ...ctx, action: 'payout.completed', entityType: 'PayoutRequest', entityId: id, after: { utrNumber } });
    return updated;
  },

  listRequests: (filters: { page?: number; pageSize?: number; status?: string; userId?: string }) =>
    payoutRepository.listRequests(filters),
  listKyc: (status?: string) => payoutRepository.listKyc({ status }),
};
