import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface LedgerFilters {
  userId?: string; page?: number; pageSize?: number;
  transactionType?: string; from?: Date; to?: Date; level?: number;
}

export const ledgerRepository = {
  create(data: Prisma.PointsLedgerUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.pointsLedger.create({ data });
  },

  findExisting(
    userId: string, transactionType: string, sourceType: string, sourceId: string,
    db: Tx | typeof prisma = prisma,
  ) {
    return db.pointsLedger.findUnique({
      where: { userId_transactionType_sourceType_sourceId: { userId, transactionType, sourceType, sourceId } },
    });
  },

  bySource(sourceType: string, sourceId: string, db: Tx | typeof prisma = prisma) {
    return db.pointsLedger.findMany({ where: { sourceType, sourceId } });
  },

  async list(filters: LedgerFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.PointsLedgerWhereInput = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.transactionType ? { transactionType: filters.transactionType } : {}),
      ...(filters.level !== undefined ? { level: filters.level } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.pointsLedger.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.pointsLedger.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  sumPoints(where: Prisma.PointsLedgerWhereInput) {
    return prisma.pointsLedger.aggregate({ where, _sum: { points: true } });
  },

  earnedInPeriod(userId: string, from: Date) {
    return prisma.pointsLedger.aggregate({
      where: { userId, points: { gt: 0 }, createdAt: { gte: from } },
      _sum: { points: true },
    });
  },

  recentForUser(userId: string, take = 8) {
    return prisma.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
  },

  expiring(before: Date, take = 500) {
    return prisma.pointsLedger.findMany({
      where: { expiresAt: { lte: before, not: null }, points: { gt: 0 } },
      take,
      orderBy: { expiresAt: 'asc' },
    });
  },
};
