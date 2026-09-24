import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface RedemptionFilters {
  page?: number; pageSize?: number; status?: string; userId?: string; search?: string; from?: Date; to?: Date;
}

const include = {
  reward: { select: { id: true, title: true, imageUrl: true, deliveryType: true, cashValue: true } },
  user: { select: { id: true, fullName: true, email: true } },
  items: true,
} satisfies Prisma.RedemptionInclude;

export const redemptionRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.redemption.findUnique({ where: { id }, include: { ...include, voucher: true } });
  },

  async list(filters: RedemptionFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.RedemptionWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(filters.search
        ? { OR: [{ reference: { contains: filters.search } }, { user: { email: { contains: filters.search } } }, { user: { fullName: { contains: filters.search } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.redemption.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include }),
      prisma.redemption.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  create(data: Prisma.RedemptionUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.redemption.create({ data });
  },

  update(id: string, data: Prisma.RedemptionUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.redemption.update({ where: { id }, data });
  },

  countByStatus() {
    return prisma.redemption.groupBy({ by: ['status'], _count: { _all: true }, _sum: { pointsSpent: true, cashValue: true } });
  },

  pendingLiability() {
    return prisma.redemption.aggregate({
      where: { status: { in: ['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW', 'APPROVED'] } },
      _sum: { pointsSpent: true, cashValue: true },
    });
  },
};
