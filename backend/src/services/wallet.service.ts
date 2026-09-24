import { ledgerRepository, type LedgerFilters } from '../repositories/ledger.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { settingsService } from './settings.service';
import { paginate } from '../utils/pagination';
import { prisma } from '../config/prisma';
import { daysAgo, dailySeries } from '../utils/date';

export const walletService = {
  async summary(userId: string) {
    const [wallet, economics, pendingAgg] = await Promise.all([
      walletRepository.ensure(userId),
      settingsService.getEconomics(),
      prisma.postSubmission.aggregate({
        where: { userId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
        _count: { _all: true },
      }),
    ]);

    // "Pending" is shown as the value of submissions still awaiting a decision.
    const pendingSubmissions = await prisma.postSubmission.findMany({
      where: { userId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      include: { campaign: { select: { creditValue: true } } },
    });
    const pendingPoints = pendingSubmissions.reduce((sum, s) => sum + s.campaign.creditValue, 0);

    return {
      availablePoints: wallet.availablePoints,
      pendingPoints,
      pendingSubmissions: pendingAgg._count._all,
      lockedPoints: wallet.lockedPoints,
      redeemedPoints: wallet.redeemedPoints,
      expiredPoints: wallet.expiredPoints,
      lifetimeEarned: wallet.lifetimeEarned,
      estimatedValueInr: settingsService.pointsToInr(wallet.availablePoints, economics),
      conversionRate: economics.pointsToInr,
      minRedemptionPoints: economics.minRedemptionPoints,
    };
  },

  async ledger(userId: string, filters: LedgerFilters) {
    const { items, total, page, pageSize } = await ledgerRepository.list({ ...filters, userId });
    return paginate(
      items.map((entry) => ({
        id: entry.id,
        date: entry.createdAt,
        description: entry.description,
        type: entry.transactionType,
        level: entry.level,
        points: entry.points,
        balanceAfter: entry.balanceAfter,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        status: entry.points > 0 ? 'CREDIT' : 'DEBIT',
        expiresAt: entry.expiresAt,
      })),
      total, page, pageSize,
    );
  },

  /** Chart-ready 30-day earn/redeem series, zero-filled. */
  async trend(userId: string, days = 30) {
    const from = daysAgo(days);
    const rows = await prisma.pointsLedger.findMany({
      where: { userId, createdAt: { gte: from } },
      select: { points: true, createdAt: true, transactionType: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map(dailySeries(from, new Date()).map((d) => [d.label, { label: d.label, earned: 0, redeemed: 0 }]));
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (row.points > 0) bucket.earned += row.points;
      else bucket.redeemed += Math.abs(row.points);
    }
    return [...buckets.values()];
  },
};
