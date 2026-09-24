import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface RiskFilters {
  page?: number; pageSize?: number; status?: string; severity?: string; type?: string; userId?: string;
}

export const riskRepository = {
  createFlag(data: Prisma.RiskFlagUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.riskFlag.create({ data });
  },

  createEvent(data: Prisma.RiskEventUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.riskEvent.create({ data });
  },

  findOpenFlag(userId: string, type: string, db: Tx | typeof prisma = prisma) {
    return db.riskFlag.findFirst({ where: { userId, type, status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
  },

  findById(id: string) {
    return prisma.riskFlag.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true, status: true, riskScore: true } }, events: { orderBy: { createdAt: 'desc' } } },
    });
  },

  async list(filters: RiskFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.RiskFlagWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.riskFlag.findMany({
        where, skip, take,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        include: { user: { select: { id: true, fullName: true, email: true, status: true } } },
      }),
      prisma.riskFlag.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  update(id: string, data: Prisma.RiskFlagUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.riskFlag.update({ where: { id }, data });
  },

  openCount() {
    return prisma.riskFlag.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
  },

  eventsByFingerprint(fingerprint: string, since: Date) {
    return prisma.riskEvent.findMany({ where: { fingerprint, createdAt: { gte: since } }, select: { userId: true } });
  },

  eventsByIp(ip: string, since: Date) {
    return prisma.riskEvent.findMany({ where: { ip, createdAt: { gte: since } }, select: { userId: true } });
  },
};
