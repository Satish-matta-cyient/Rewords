import { prisma } from '../config/prisma';
import { supportRepository, type TicketFilters } from '../repositories/support.repository';
import { notificationService } from './notification.service';
import { auditService, type AuditContext } from './audit.service';
import { NotFoundError, AuthorizationError, BusinessRuleError } from '../errors';
import { makeReference } from '../utils/reference';
import { paginate } from '../utils/pagination';

const CLOSED = new Set(['RESOLVED', 'CLOSED']);

export const supportService = {
  async create(userId: string, input: { category: string; subject: string; description: string; priority: string }, ctx: AuditContext) {
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await supportRepository.create({
        reference: makeReference('TKT'),
        userId, category: input.category, subject: input.subject, priority: input.priority, status: 'OPEN',
      }, tx);
      await supportRepository.addMessage({ ticketId: created.id, authorId: userId, body: input.description }, tx);
      return created;
    });

    await auditService.record({
      ...ctx, actorId: userId, action: 'support.ticket_created', entityType: 'SupportTicket', entityId: ticket.id,
      after: { category: input.category, priority: input.priority },
    });
    return ticket;
  },

  async list(filters: TicketFilters) {
    const { items, total, page, pageSize } = await supportRepository.list(filters);
    return paginate(
      items.map((t) => ({
        id: t.id, reference: t.reference, subject: t.subject, category: t.category,
        status: t.status, priority: t.priority, messages: t._count.messages,
        user: t.user, assignee: t.assignee?.fullName ?? null,
        createdAt: t.createdAt, updatedAt: t.updatedAt,
      })),
      total, page, pageSize,
    );
  },

  async detail(id: string, viewer: { userId: string; role: string }) {
    const ticket = await supportRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');
    const isStaff = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    if (!isStaff && ticket.userId !== viewer.userId) throw new AuthorizationError();

    return {
      ...ticket,
      // Internal notes stay internal.
      messages: ticket.messages.filter((m) => isStaff || !m.internal),
    };
  },

  async reply(id: string, authorId: string, input: { body: string; internal: boolean }, viewerRole: string, ctx: AuditContext) {
    const ticket = await supportRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');
    const isStaff = viewerRole === 'ADMIN' || viewerRole === 'SUPER_ADMIN';
    if (!isStaff && ticket.userId !== authorId) throw new AuthorizationError();
    if (CLOSED.has(ticket.status) && !isStaff) throw new BusinessRuleError('This ticket is closed. Please open a new one.');
    const internal = isStaff ? input.internal : false;

    const message = await prisma.$transaction(async (tx) => {
      const created = await supportRepository.addMessage({ ticketId: id, authorId, body: input.body, internal }, tx);
      await supportRepository.update(id, {
        status: isStaff ? (internal ? ticket.status : 'WAITING_FOR_USER') : 'IN_PROGRESS',
        ...(isStaff && !ticket.firstResponseAt && !internal ? { firstResponseAt: new Date() } : {}),
      }, tx);

      if (isStaff && !internal) {
        await notificationService.create({
          userId: ticket.userId, type: 'ANNOUNCEMENT',
          title: `Reply on ${ticket.reference}`, body: input.body.slice(0, 160), link: `/support/${id}`,
        }, tx);
      }
      return created;
    });

    await auditService.record({ ...ctx, action: 'support.replied', entityType: 'SupportTicket', entityId: id, metadata: { internal } });
    return message;
  },

  async update(id: string, patch: { status?: string; priority?: string; assigneeId?: string | null }, ctx: AuditContext) {
    const before = await supportRepository.findById(id);
    if (!before) throw new NotFoundError('Ticket');

    const updated = await supportRepository.update(id, {
      ...patch,
      ...(patch.status && CLOSED.has(patch.status) ? { resolvedAt: new Date() } : {}),
    });

    await auditService.record({
      ...ctx, action: 'support.updated', entityType: 'SupportTicket', entityId: id,
      before: { status: before.status, priority: before.priority, assigneeId: before.assigneeId }, after: patch,
    });
    return updated;
  },

  openCount: () => supportRepository.openCount(),
};
