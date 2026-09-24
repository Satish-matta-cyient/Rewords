import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface UserListFilters {
  page?: number; pageSize?: number; search?: string;
  status?: string; role?: string; institutionId?: string;
  riskOnly?: boolean; sortBy?: string; sort?: 'asc' | 'desc';
}

const SORTABLE = new Set(['createdAt', 'fullName', 'email', 'riskScore', 'lastLoginAt']);

export const userRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.user.findFirst({ where: { id, deletedAt: null } });
  },

  findByEmail(email: string, db: Tx | typeof prisma = prisma) {
    return db.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
  },

  findByPhone(phone: string) {
    return prisma.user.findFirst({ where: { phone, deletedAt: null } });
  },

  findWithProfile(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: true, wallet: true, referralCodes: { where: { active: true }, take: 1 }, tier: { include: { tier: true } } },
    });
  },

  create(data: Prisma.UserCreateInput, db: Tx | typeof prisma = prisma) {
    return db.user.create({ data });
  },

  update(id: string, data: Prisma.UserUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.user.update({ where: { id }, data });
  },

  async list(filters: UserListFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.role ? { primaryRole: filters.role } : {}),
      ...(filters.institutionId ? { institutionId: filters.institutionId } : {}),
      ...(filters.riskOnly ? { riskScore: { gt: 0 } } : {}),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search } },
              { email: { contains: filters.search } },
              { phone: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const sortBy = SORTABLE.has(filters.sortBy ?? '') ? (filters.sortBy as string) : 'createdAt';

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: filters.sort ?? 'desc' },
        include: {
          wallet: true,
          referralCodes: { where: { active: true }, take: 1 },
          _count: { select: { submissions: true, referralAsParent: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  countByStatus() {
    return prisma.user.groupBy({ by: ['status'], _count: { _all: true }, where: { deletedAt: null } });
  },

  countCreatedBetween(from: Date, to: Date) {
    return prisma.user.count({ where: { deletedAt: null, createdAt: { gte: from, lte: to } } });
  },

  countActiveSince(since: Date) {
    return prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: since } } });
  },
};
