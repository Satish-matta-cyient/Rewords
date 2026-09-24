import { prisma, type Tx } from '../config/prisma';

export const voucherRepository = {
  /**
   * Atomically claims the next UNUSED code by using a conditional updateMany —
   * two concurrent approvals can never win the same row.
   */
  async claimNext(rewardId: string, redemptionId: string, userId: string, db: Tx | typeof prisma = prisma) {
    const candidate = await db.voucherCode.findFirst({
      where: { rewardId, status: 'UNUSED', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;

    const claimed = await db.voucherCode.updateMany({
      where: { id: candidate.id, status: 'UNUSED' },
      data: { status: 'ASSIGNED', assignedToId: userId, redemptionId, assignedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    return db.voucherCode.findUnique({ where: { id: candidate.id } });
  },

  release(redemptionId: string, db: Tx | typeof prisma = prisma) {
    return db.voucherCode.updateMany({
      where: { redemptionId },
      data: { status: 'UNUSED', assignedToId: null, redemptionId: null, assignedAt: null },
    });
  },

  countByStatus(rewardId: string) {
    return prisma.voucherCode.groupBy({ by: ['status'], _count: { _all: true }, where: { rewardId } });
  },

  availableCount(rewardId: string, db: Tx | typeof prisma = prisma) {
    return db.voucherCode.count({ where: { rewardId, status: 'UNUSED' } });
  },

  listForReward(rewardId: string, take = 200) {
    return prisma.voucherCode.findMany({
      where: { rewardId }, take, orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, status: true, assignedAt: true, expiresAt: true, batchRef: true },
    });
  },

  findForRedemption(redemptionId: string) {
    return prisma.voucherCode.findUnique({ where: { redemptionId } });
  },

  lowStockRewards(threshold: number) {
    return prisma.$queryRawUnsafe<{ id: string; title: string; available: number }[]>(
      `SELECT r.id as id, r.title as title, COUNT(v.id) as available
       FROM Reward r LEFT JOIN VoucherCode v ON v.rewardId = r.id AND v.status = 'UNUSED'
       WHERE r.active = 1 AND r.deliveryType = 'VOUCHER_CODE' AND r.deletedAt IS NULL
       GROUP BY r.id HAVING available <= ?`,
      threshold,
    );
  },
};
