import { prisma } from '../config/prisma';
import { redemptionRepository, type RedemptionFilters } from '../repositories/redemption.repository';
import { rewardRepository } from '../repositories/reward.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { voucherRepository } from '../repositories/voucher.repository';
import { voucherService } from './voucher.service';
import { pointsService } from './points.service';
import { settingsService } from './settings.service';
import { notificationService } from './notification.service';
import { auditService, type AuditContext } from './audit.service';
import { BusinessRuleError, NotFoundError, AuthorizationError } from '../errors';
import { makeReference } from '../utils/reference';
import { paginate } from '../utils/pagination';

const TIMELINE = ['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW', 'APPROVED', 'FULFILLED'];

function buildTimeline(redemption: { status: string; createdAt: Date; reviewedAt: Date | null; fulfilledAt: Date | null; rejectionReason: string | null }) {
  if (redemption.status === 'REJECTED' || redemption.status === 'CANCELLED') {
    return [
      { key: 'REQUESTED', label: 'Requested', at: redemption.createdAt, done: true },
      { key: 'POINTS_LOCKED', label: 'Points locked', at: redemption.createdAt, done: true },
      { key: redemption.status, label: redemption.status === 'REJECTED' ? 'Rejected' : 'Cancelled', at: redemption.reviewedAt, done: true, negative: true, reason: redemption.rejectionReason },
    ];
  }
  const currentIndex = TIMELINE.indexOf(redemption.status);
  return TIMELINE.map((key, index) => ({
    key,
    label: { REQUESTED: 'Requested', POINTS_LOCKED: 'Points locked', UNDER_REVIEW: 'Under review', APPROVED: 'Approved', FULFILLED: 'Fulfilled' }[key],
    at: key === 'FULFILLED' ? redemption.fulfilledAt : key === 'APPROVED' ? redemption.reviewedAt : redemption.createdAt,
    done: index <= currentIndex,
  }));
}

export const redemptionService = {
  /**
   * Creates a redemption and locks the points atomically.
   * The wallet invariant inside PointsService makes over-redemption impossible
   * even under concurrent requests.
   */
  async create(userId: string, input: { rewardId: string; quantity: number }, ctx: AuditContext) {
    const [reward, wallet, economics] = await Promise.all([
      rewardRepository.findById(input.rewardId),
      walletRepository.ensure(userId),
      settingsService.getEconomics(),
    ]);
    if (!reward) throw new NotFoundError('Reward');
    if (!reward.active) throw new BusinessRuleError('This reward is no longer available');

    const totalPoints = reward.pointsCost * input.quantity;
    if (totalPoints < economics.minRedemptionPoints) {
      throw new BusinessRuleError(`The minimum redemption is ${economics.minRedemptionPoints.toLocaleString()} points`);
    }
    if (wallet.availablePoints < totalPoints) {
      throw new BusinessRuleError('You do not have enough available points for this reward', {
        required: totalPoints, available: wallet.availablePoints,
      });
    }

    if (reward.deliveryType === 'VOUCHER_CODE') {
      const available = await voucherRepository.availableCount(reward.id);
      if (available < input.quantity) throw new BusinessRuleError('This reward is out of stock');
    } else if (reward.stock < input.quantity) {
      throw new BusinessRuleError('This reward is out of stock');
    }

    const redemption = await prisma.$transaction(async (tx) => {
      const created = await redemptionRepository.create({
        reference: makeReference('RDM'),
        userId,
        rewardId: reward.id,
        pointsSpent: totalPoints,
        cashValue: reward.cashValue * input.quantity,
        status: 'POINTS_LOCKED',
      }, tx);

      await tx.redemptionItem.create({
        data: { redemptionId: created.id, label: reward.title, quantity: input.quantity, pointsEach: reward.pointsCost },
      });

      await pointsService.award({
        userId,
        points: -totalPoints,
        transactionType: 'REDEMPTION_LOCK',
        sourceType: 'REDEMPTION',
        sourceId: created.id,
        description: `Points locked for ${reward.title}`,
      }, tx);

      await notificationService.create({
        userId,
        type: 'REDEMPTION_CREATED',
        title: 'Redemption requested',
        body: `${totalPoints.toLocaleString()} points are locked while ${reward.title} is reviewed.`,
        link: `/my-redemptions/${created.id}`,
      }, tx);

      return created;
    });

    await auditService.record({
      ...ctx, actorId: userId, action: 'redemption.created', entityType: 'Redemption', entityId: redemption.id,
      after: { rewardId: reward.id, points: totalPoints },
    });
    return redemption;
  },

  async listForUser(userId: string, filters: RedemptionFilters) {
    const { items, total, page, pageSize } = await redemptionRepository.list({ ...filters, userId });
    return paginate(
      items.map((r) => ({
        id: r.id, reference: r.reference, reward: r.reward.title, rewardImage: r.reward.imageUrl,
        deliveryType: r.reward.deliveryType, pointsSpent: r.pointsSpent, cashValue: r.cashValue,
        status: r.status, createdAt: r.createdAt, fulfilledAt: r.fulfilledAt, rejectionReason: r.rejectionReason,
      })),
      total, page, pageSize,
    );
  },

  async listForAdmin(filters: RedemptionFilters) {
    const { items, total, page, pageSize } = await redemptionRepository.list(filters);
    return paginate(
      items.map((r) => ({
        id: r.id, reference: r.reference, reward: r.reward.title, deliveryType: r.reward.deliveryType,
        user: r.user, pointsSpent: r.pointsSpent, cashValue: r.cashValue,
        status: r.status, createdAt: r.createdAt, reviewedAt: r.reviewedAt,
        ageHours: Number(((Date.now() - r.createdAt.getTime()) / 3_600_000).toFixed(1)),
      })),
      total, page, pageSize,
    );
  },

  async detail(id: string, viewer: { userId: string; role: string }) {
    const redemption = await redemptionRepository.findById(id);
    if (!redemption) throw new NotFoundError('Redemption');
    const isStaff = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    if (!isStaff && redemption.userId !== viewer.userId) throw new AuthorizationError();

    return {
      id: redemption.id,
      reference: redemption.reference,
      status: redemption.status,
      pointsSpent: redemption.pointsSpent,
      cashValue: redemption.cashValue,
      rejectionReason: redemption.rejectionReason,
      createdAt: redemption.createdAt,
      reviewedAt: redemption.reviewedAt,
      fulfilledAt: redemption.fulfilledAt,
      reward: redemption.reward,
      items: redemption.items,
      user: isStaff ? redemption.user : undefined,
      timeline: buildTimeline(redemption),
      // Presence only — the code itself requires an explicit reveal call.
      voucherAvailable: Boolean(redemption.voucher) && ['APPROVED', 'FULFILLED'].includes(redemption.status),
    };
  },

  async approve(id: string, adminId: string, ctx: AuditContext) {
    const redemption = await redemptionRepository.findById(id);
    if (!redemption) throw new NotFoundError('Redemption');
    if (!['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW'].includes(redemption.status)) {
      throw new BusinessRuleError(`A redemption in ${redemption.status} state cannot be approved`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Converts the lock into a permanent debit.
      await pointsService.award({
        userId: redemption.userId,
        points: -redemption.pointsSpent,
        transactionType: 'REDEMPTION_DEBIT',
        sourceType: 'REDEMPTION',
        sourceId: redemption.id,
        description: `Redeemed ${redemption.reward.title}`,
      }, tx);

      let voucherAssigned = false;
      if (redemption.reward.deliveryType === 'VOUCHER_CODE') {
        await voucherService.assign(redemption.rewardId, redemption.id, redemption.userId, tx);
        voucherAssigned = true;
      }

      const updated = await redemptionRepository.update(id, {
        status: voucherAssigned ? 'FULFILLED' : 'APPROVED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        ...(voucherAssigned ? { fulfilledAt: new Date() } : {}),
      }, tx);

      await notificationService.create({
        userId: redemption.userId,
        type: voucherAssigned ? 'VOUCHER_DELIVERED' : 'REDEMPTION_APPROVED',
        title: voucherAssigned ? 'Your voucher is ready' : 'Redemption approved',
        body: voucherAssigned
          ? `Your ${redemption.reward.title} voucher code is available in your redemptions.`
          : `${redemption.reward.title} has been approved and is being processed.`,
        link: `/my-redemptions/${id}`,
      }, tx);

      return { updated, voucherAssigned };
    });

    await auditService.record({
      ...ctx, action: 'redemption.approved', entityType: 'Redemption', entityId: id,
      before: { status: redemption.status },
      after: { status: result.updated.status, voucherAssigned: result.voucherAssigned },
    });
    return result.updated;
  },

  /** Rejection releases the locked points back to the ambassador. */
  async reject(id: string, adminId: string, reason: string, ctx: AuditContext) {
    const redemption = await redemptionRepository.findById(id);
    if (!redemption) throw new NotFoundError('Redemption');
    if (['FULFILLED', 'REJECTED', 'CANCELLED'].includes(redemption.status)) {
      throw new BusinessRuleError('This redemption is already closed');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await pointsService.award({
        userId: redemption.userId,
        points: redemption.pointsSpent,
        transactionType: 'REFUND',
        sourceType: 'REDEMPTION',
        sourceId: redemption.id,
        description: `Points returned — ${redemption.reward.title} not approved`,
      }, tx);
      // The refund credits "available"; the matching lock must also be cleared.
      await tx.wallet.update({
        where: { userId: redemption.userId },
        data: { lockedPoints: { decrement: redemption.pointsSpent }, lifetimeEarned: { decrement: redemption.pointsSpent } },
      });

      await voucherService.release(redemption.id, tx);

      const next = await redemptionRepository.update(id, {
        status: 'REJECTED', rejectionReason: reason, reviewedById: adminId, reviewedAt: new Date(),
      }, tx);

      await notificationService.create({
        userId: redemption.userId,
        type: 'REDEMPTION_REJECTED',
        title: 'Redemption not approved',
        body: `${reason} Your ${redemption.pointsSpent.toLocaleString()} points have been returned.`,
        link: `/my-redemptions/${id}`,
      }, tx);
      return next;
    });

    await auditService.record({
      ...ctx, action: 'redemption.rejected', entityType: 'Redemption', entityId: id,
      before: { status: redemption.status }, after: { status: 'REJECTED', reason },
    });
    return updated;
  },

  async markFulfilled(id: string, adminId: string, ctx: AuditContext) {
    const redemption = await redemptionRepository.findById(id);
    if (!redemption) throw new NotFoundError('Redemption');
    if (redemption.status !== 'APPROVED') throw new BusinessRuleError('Only approved redemptions can be fulfilled');

    const updated = await redemptionRepository.update(id, { status: 'FULFILLED', fulfilledAt: new Date(), reviewedById: adminId });
    await auditService.record({ ...ctx, action: 'redemption.fulfilled', entityType: 'Redemption', entityId: id });
    return updated;
  },

  revealVoucher: (id: string, userId: string) => voucherService.revealForUser(id, userId),
};
