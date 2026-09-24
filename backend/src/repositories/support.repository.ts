import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface TicketFilters {
  page?: number; pageSize?: number; status?: string; priority?: string;
  category?: string; assigneeId?: string; userId?: string; search?: string;
}

export const supportRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignee: { select: { id: true, fullName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true, primaryRole: true } }, attachments: true },
        },
      },
    });
  },

  async list(filters: TicketFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.SupportTicketWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.search ? { OR: [{ subject: { contains: filters.search } }, { reference: { contains: filters.search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where, skip, take, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        include: { user: { select: { fullName: true, email: true } }, assignee: { select: { fullName: true } }, _count: { select: { messages: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  create(data: Prisma.SupportTicketUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.supportTicket.create({ data });
  },

  update(id: string, data: Prisma.SupportTicketUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.supportTicket.update({ where: { id }, data });
  },

  addMessage(data: Prisma.SupportMessageUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.supportMessage.create({ data });
  },

  openCount() {
    return prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER'] } } });
  },
};
