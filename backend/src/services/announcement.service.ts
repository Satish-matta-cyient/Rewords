import { prisma } from '../config/prisma';
import { notificationService } from './notification.service';
import { auditService, type AuditContext } from './audit.service';
import { daysAgo } from '../utils/date';

export const announcementService = {
  async create(input: { title: string; body: string; audience: string; audienceRef?: string; severity: string; publishNow: boolean }, ctx: AuditContext) {
    const announcement = await prisma.announcement.create({
      data: {
        title: input.title, body: input.body, audience: input.audience,
        audienceRef: input.audienceRef ?? null, severity: input.severity,
        authorId: ctx.actorId ?? null,
        publishedAt: input.publishNow ? new Date() : null,
      },
    });

    if (input.publishNow) {
      const recipients = await announcementService.resolveAudience(input.audience, input.audienceRef);
      await notificationService.createMany(
        recipients.map((userId) => ({
          userId, type: 'ANNOUNCEMENT' as const, title: input.title, body: input.body, link: '/notifications',
        })),
      );
    }

    await auditService.record({
      ...ctx, action: 'announcement.created', entityType: 'Announcement', entityId: announcement.id, after: announcement,
    });
    return announcement;
  },

  /** Segment resolution kept server-side so audiences can never be spoofed. */
  async resolveAudience(audience: string, ref?: string | null): Promise<string[]> {
    if (audience === 'TIER' && ref) {
      const rows = await prisma.userTier.findMany({ where: { tier: { key: ref } }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (audience === 'CAMPAIGN' && ref) {
      const rows = await prisma.postSubmission.findMany({ where: { campaignId: ref }, distinct: ['userId'], select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (audience === 'ACTIVE') {
      const rows = await prisma.user.findMany({
        where: { deletedAt: null, status: 'ACTIVE', lastLoginAt: { gte: daysAgo(30) } }, select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    const rows = await prisma.user.findMany({ where: { deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  list: () => prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { author: { select: { fullName: true } } } }),

  active: () => prisma.announcement.findMany({
    where: { publishedAt: { not: null, lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: { publishedAt: 'desc' }, take: 3,
  }),
};
