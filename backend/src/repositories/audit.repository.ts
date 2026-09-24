import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface AuditFilters {
  page?: number; pageSize?: number; actorId?: string; actorRole?: string;
  action?: string; entityType?: string; entityId?: string; from?: Date; to?: Date; search?: string;
}

export const auditRepository = {
  create(data: Prisma.AuditLogUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.auditLog.create({ data });
  },

  async list(filters: AuditFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.actorRole ? { actorRole: filters.actorRole } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(filters.search ? { OR: [{ action: { contains: filters.search } }, { entityType: { contains: filters.search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  distinctActions() {
    return prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' }, take: 200 });
  },
};
