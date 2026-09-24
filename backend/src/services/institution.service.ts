import { prisma } from '../config/prisma';
import { auditService, type AuditContext } from './audit.service';
import { NotFoundError } from '../errors';
import { slugify } from '../utils/reference';

export const institutionService = {
  async list() {
    const institutions = await prisma.institution.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, campaigns: true, members: true } } },
    });
    return institutions.map((i) => ({
      id: i.id, name: i.name, slug: i.slug, type: i.type, city: i.city, state: i.state,
      logoUrl: i.logoUrl, active: i.active,
      users: i._count.users, campaigns: i._count.campaigns, members: i._count.members,
    }));
  },

  async detail(id: string) {
    const institution = await prisma.institution.findUnique({
      where: { id },
      include: { _count: { select: { users: true, campaigns: true } } },
    });
    if (!institution) throw new NotFoundError('Institution');

    const [points, submissions] = await Promise.all([
      prisma.pointsLedger.aggregate({ where: { user: { institutionId: id }, points: { gt: 0 } }, _sum: { points: true } }),
      prisma.postSubmission.count({ where: { user: { institutionId: id } } }),
    ]);

    return { ...institution, pointsIssued: points._sum.points ?? 0, submissions };
  },

  async create(input: { name: string; type: string; city?: string; state?: string; logoUrl?: string }, ctx: AuditContext) {
    const institution = await prisma.institution.create({ data: { ...input, slug: slugify(input.name) } });
    await auditService.record({ ...ctx, action: 'institution.created', entityType: 'Institution', entityId: institution.id, after: institution });
    return institution;
  },

  async assignUser(institutionId: string, userId: string, ctx: AuditContext) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { institutionId } }),
      prisma.institutionUser.upsert({
        where: { institutionId_userId: { institutionId, userId } },
        create: { institutionId, userId },
        update: {},
      }),
    ]);
    await auditService.record({ ...ctx, action: 'institution.user_assigned', entityType: 'Institution', entityId: institutionId, metadata: { userId } });
    return { assigned: true };
  },
};
