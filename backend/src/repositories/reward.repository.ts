import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface RewardFilters {
  page?: number; pageSize?: number; search?: string;
  categoryKey?: string; minPoints?: number; maxPoints?: number;
  featuredOnly?: boolean; includeInactive?: boolean;
}

export const rewardRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.reward.findFirst({ where: { id, deletedAt: null }, include: { category: true } });
  },

  async list(filters: RewardFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.RewardWhereInput = {
      deletedAt: null,
      ...(filters.includeInactive ? {} : { active: true }),
      ...(filters.featuredOnly ? { featured: true } : {}),
      ...(filters.categoryKey ? { category: { key: filters.categoryKey } } : {}),
      ...(filters.minPoints !== undefined || filters.maxPoints !== undefined
        ? { pointsCost: { ...(filters.minPoints !== undefined ? { gte: filters.minPoints } : {}), ...(filters.maxPoints !== undefined ? { lte: filters.maxPoints } : {}) } }
        : {}),
      ...(filters.search ? { OR: [{ title: { contains: filters.search } }, { description: { contains: filters.search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.reward.findMany({
        where, skip, take,
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { pointsCost: 'asc' }],
        include: { category: true, _count: { select: { voucherCodes: { where: { status: 'UNUSED' } } } } },
      }),
      prisma.reward.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  categories() {
    return prisma.rewardCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  },

  create(data: Prisma.RewardUncheckedCreateInput) { return prisma.reward.create({ data }); },
  update(id: string, data: Prisma.RewardUncheckedUpdateInput) { return prisma.reward.update({ where: { id }, data }); },

  decrementStock(id: string, qty: number, db: Tx | typeof prisma = prisma) {
    return db.reward.update({ where: { id }, data: { stock: { decrement: qty } } });
  },
  incrementStock(id: string, qty: number, db: Tx | typeof prisma = prisma) {
    return db.reward.update({ where: { id }, data: { stock: { increment: qty } } });
  },
};
