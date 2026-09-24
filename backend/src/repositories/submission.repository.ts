import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export interface SubmissionFilters {
  page?: number; pageSize?: number; search?: string;
  status?: string; campaignId?: string; platform?: string; userId?: string;
  reviewerId?: string; riskLevel?: string; from?: Date; to?: Date;
}

const listInclude = {
  campaign: { select: { id: true, name: true, creditValue: true } },
  user: { select: { id: true, fullName: true, email: true, riskScore: true, profile: { select: { avatarUrl: true } } } },
  media: true,
} satisfies Prisma.PostSubmissionInclude;

function buildWhere(filters: SubmissionFilters): Prisma.PostSubmissionWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.reviewerId ? { reviewedById: filters.reviewerId } : {}),
    ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
    ...(filters.from || filters.to
      ? { submittedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { postUrl: { contains: filters.search } },
            { user: { fullName: { contains: filters.search } } },
            { user: { email: { contains: filters.search } } },
          ],
        }
      : {}),
  };
}

export const submissionRepository = {
  findById(id: string, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.findUnique({
      where: { id },
      include: {
        ...listInclude,
        reviews: { orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { fullName: true } }, notes: true } },
      },
    });
  },

  findByNormalisedUrl(normalisedUrl: string, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.findUnique({ where: { normalisedUrl }, select: { id: true, userId: true, status: true } });
  },

  async list(filters: SubmissionFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      prisma.postSubmission.findMany({ where, skip, take, orderBy: { submittedAt: 'asc' }, include: listInclude }),
      prisma.postSubmission.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  async listForUser(userId: string, filters: SubmissionFilters) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where = { ...buildWhere(filters), userId };
    const [items, total] = await Promise.all([
      prisma.postSubmission.findMany({ where, skip, take, orderBy: { submittedAt: 'desc' }, include: listInclude }),
      prisma.postSubmission.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  create(data: Prisma.PostSubmissionUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.create({ data });
  },

  update(id: string, data: Prisma.PostSubmissionUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.update({ where: { id }, data });
  },

  addReview(data: Prisma.PostReviewUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.postReview.create({ data });
  },

  countForUserOnCampaign(userId: string, campaignId: string, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.count({
      where: { userId, campaignId, status: { in: ['PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED'] } },
    });
  },

  countForUserSince(userId: string, since: Date, db: Tx | typeof prisma = prisma) {
    return db.postSubmission.count({ where: { userId, submittedAt: { gte: since } } });
  },

  countByStatus(from?: Date, to?: Date) {
    return prisma.postSubmission.groupBy({
      by: ['status'],
      _count: { _all: true },
      ...(from && to ? { where: { submittedAt: { gte: from, lte: to } } } : {}),
    });
  },

  pendingOlderThan(hours: number) {
    return prisma.postSubmission.count({
      where: { status: { in: ['PENDING', 'UNDER_REVIEW'] }, submittedAt: { lte: new Date(Date.now() - hours * 3_600_000) } },
    });
  },

  approvedForLiveness(limit: number, olderThanHours: number) {
    return prisma.postSubmission.findMany({
      where: {
        status: 'APPROVED',
        OR: [{ lastLivenessAt: null }, { lastLivenessAt: { lte: new Date(Date.now() - olderThanHours * 3_600_000) } }],
      },
      take: limit,
      orderBy: { lastLivenessAt: 'asc' },
    });
  },

  reviewerThroughput(from: Date, to: Date) {
    return prisma.postReview.groupBy({
      by: ['reviewerId', 'toStatus'],
      _count: { _all: true },
      where: { createdAt: { gte: from, lte: to }, reviewerId: { not: null } },
    });
  },
};
