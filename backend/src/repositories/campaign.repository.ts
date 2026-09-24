import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface CampaignFilters {
  page?: number; pageSize?: number; search?: string;
  status?: string; category?: string; platform?: string; institutionId?: string;
  activeOnly?: boolean;
}

export const campaignRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.campaign.findFirst({
      where: { id, deletedAt: null },
      include: { rules: { orderBy: { sortOrder: 'asc' } }, creatives: true, platforms: true, _count: { select: { submissions: true } } },
    });
  },

  findBySlug(slug: string) {
    return prisma.campaign.findUnique({ where: { slug } });
  },

  async list(filters: CampaignFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.CampaignWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.activeOnly ? { status: 'ACTIVE', endDate: { gte: new Date() } } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
      ...(filters.platform ? { platforms: { some: { platform: filters.platform } } } : {}),
      ...(filters.search ? { OR: [{ name: { contains: filters.search } }, { description: { contains: filters.search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where, skip, take,
        orderBy: [{ status: 'asc' }, { endDate: 'asc' }],
        include: { platforms: true, _count: { select: { submissions: true } } },
      }),
      prisma.campaign.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  create(data: Prisma.CampaignUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.campaign.create({ data });
  },

  update(id: string, data: Prisma.CampaignUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.campaign.update({ where: { id }, data });
  },

  incrementSpend(id: string, points: number, db: Tx | typeof prisma = prisma) {
    return db.campaign.update({ where: { id }, data: { budgetSpentPoints: { increment: points } } });
  },

  performance(from: Date, to: Date) {
    return prisma.campaign.findMany({
      where: { deletedAt: null, createdAt: { lte: to } },
      select: {
        id: true, name: true, creditValue: true, budgetPoints: true, budgetSpentPoints: true, status: true,
        _count: { select: { submissions: true } },
        submissions: { where: { createdAt: { gte: from, lte: to } }, select: { status: true, awardedPoints: true } },
      },
    });
  },
};
