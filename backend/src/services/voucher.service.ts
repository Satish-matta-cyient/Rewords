import { prisma } from '../config/prisma';
import { voucherRepository } from '../repositories/voucher.repository';
import { rewardRepository } from '../repositories/reward.repository';
import { auditService, type AuditContext } from './audit.service';
import { settingsService } from './settings.service';
import { NotFoundError, BusinessRuleError } from '../errors';
import type { Tx } from '../config/prisma';

export const voucherService = {
  /** Bulk import. Codes already present for the reward are skipped, never duplicated. */
  async importCodes(input: { rewardId: string; codes: string[]; batchRef?: string; expiresAt?: Date }, ctx: AuditContext) {
    const reward = await rewardRepository.findById(input.rewardId);
    if (!reward) throw new NotFoundError('Reward');

    const unique = [...new Set(input.codes.map((c) => c.trim()).filter(Boolean))];
    const existing = await prisma.voucherCode.findMany({
      where: { rewardId: input.rewardId, code: { in: unique } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map((e) => e.code));
    const toInsert = unique.filter((c) => !existingSet.has(c));

    if (toInsert.length === 0) {
      throw new BusinessRuleError('Every code in this file already exists for that reward');
    }

    await prisma.$transaction(async (tx) => {
      await tx.voucherCode.createMany({
        data: toInsert.map((code) => ({
          rewardId: input.rewardId, code, batchRef: input.batchRef ?? null, expiresAt: input.expiresAt ?? null,
        })),
      });
      await rewardRepository.incrementStock(input.rewardId, toInsert.length, tx);
    });

    await auditService.record({
      ...ctx, action: 'voucher.codes_imported', entityType: 'Reward', entityId: input.rewardId,
      metadata: { imported: toInsert.length, skipped: unique.length - toInsert.length, batchRef: input.batchRef },
    });

    return { imported: toInsert.length, skipped: unique.length - toInsert.length, duplicatesInFile: input.codes.length - unique.length };
  },

  /** Called inside the redemption approval transaction. */
  async assign(rewardId: string, redemptionId: string, userId: string, db: Tx) {
    const voucher = await voucherRepository.claimNext(rewardId, redemptionId, userId, db);
    if (!voucher) throw new BusinessRuleError('No voucher codes are available for this reward. Restock before approving.');
    await rewardRepository.decrementStock(rewardId, 1, db);
    return voucher;
  },

  release: (redemptionId: string, db: Tx) => voucherRepository.release(redemptionId, db),

  async inventory(rewardId: string) {
    const reward = await rewardRepository.findById(rewardId);
    if (!reward) throw new NotFoundError('Reward');
    const [counts, codes] = await Promise.all([
      voucherRepository.countByStatus(rewardId),
      voucherRepository.listForReward(rewardId),
    ]);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return {
      reward: { id: reward.id, title: reward.title, pointsCost: reward.pointsCost, deliveryType: reward.deliveryType },
      counts: {
        unused: byStatus.UNUSED ?? 0, reserved: byStatus.RESERVED ?? 0,
        assigned: byStatus.ASSIGNED ?? 0, used: byStatus.USED ?? 0, expired: byStatus.EXPIRED ?? 0,
      },
      // Codes are masked in listings; the full value is only revealed to its owner.
      codes: codes.map((c) => ({ ...c, code: `${c.code.slice(0, 3)}••••${c.code.slice(-3)}` })),
    };
  },

  async overview() {
    const economics = await settingsService.getEconomics();
    const rewards = await prisma.reward.findMany({
      where: { deletedAt: null, deliveryType: 'VOUCHER_CODE' },
      select: { id: true, title: true, pointsCost: true, active: true, lowStockThreshold: true },
    });
    const counts = await prisma.voucherCode.groupBy({ by: ['rewardId', 'status'], _count: { _all: true } });

    return rewards.map((r) => {
      const rows = counts.filter((c) => c.rewardId === r.id);
      const available = rows.find((c) => c.status === 'UNUSED')?._count._all ?? 0;
      const threshold = r.lowStockThreshold || economics.voucherLowStockThreshold;
      return {
        ...r,
        available,
        assigned: rows.find((c) => c.status === 'ASSIGNED')?._count._all ?? 0,
        used: rows.find((c) => c.status === 'USED')?._count._all ?? 0,
        lowStock: available <= threshold,
        threshold,
      };
    });
  },

  lowStock: async () => {
    const economics = await settingsService.getEconomics();
    return voucherRepository.lowStockRewards(economics.voucherLowStockThreshold);
  },

  /** The only place a full voucher code is returned, and only to its owner. */
  async revealForUser(redemptionId: string, userId: string) {
    const redemption = await prisma.redemption.findUnique({ where: { id: redemptionId }, include: { voucher: true } });
    if (!redemption || redemption.userId !== userId) throw new NotFoundError('Redemption');
    if (!['APPROVED', 'FULFILLED'].includes(redemption.status)) {
      throw new BusinessRuleError('Your voucher code will appear here once the redemption is approved');
    }
    if (!redemption.voucher) throw new NotFoundError('Voucher code');
    await prisma.voucherCode.update({ where: { id: redemption.voucher.id }, data: { status: 'USED' } });
    return { code: redemption.voucher.code, expiresAt: redemption.voucher.expiresAt };
  },
};
