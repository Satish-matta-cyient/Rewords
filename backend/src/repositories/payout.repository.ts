import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export const payoutRepository = {
  profile(userId: string, db: Tx | typeof prisma = prisma) {
    return db.payoutProfile.findUnique({ where: { userId } });
  },

  upsertProfile(userId: string, data: Prisma.PayoutProfileUncheckedCreateInput) {
    const { userId: _ignored, ...update } = data;
    return prisma.payoutProfile.upsert({ where: { userId }, create: data, update });
  },

  createRequest(data: Prisma.PayoutRequestUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.payoutRequest.create({ data });
  },

  updateRequest(id: string, data: Prisma.PayoutRequestUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.payoutRequest.update({ where: { id }, data });
  },

  findRequest(id: string, db: Tx | typeof prisma = prisma) {
    return db.payoutRequest.findUnique({ where: { id }, include: { user: { select: { id: true, fullName: true, email: true } } } });
  },

  async listRequests(filters: { page?: number; pageSize?: number; status?: string; userId?: string }) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.PayoutRequestWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { user: { select: { fullName: true, email: true } } } }),
      prisma.payoutRequest.count({ where }),
    ]);
    return { items, total, page, pageSize };
  },

  createKyc(data: Prisma.KycRecordUncheckedCreateInput) { return prisma.kycRecord.create({ data }); },

  latestKyc(userId: string) {
    return prisma.kycRecord.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  updateKyc(id: string, data: Prisma.KycRecordUncheckedUpdateInput) {
    return prisma.kycRecord.update({ where: { id }, data });
  },

  listKyc(filters: { status?: string }) {
    return prisma.kycRecord.findMany({
      where: { ...(filters.status ? { status: filters.status } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { user: { select: { fullName: true, email: true } } },
    });
  },

  cashLiability() {
    return prisma.payoutRequest.aggregate({
      where: { status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] } },
      _sum: { netAmount: true, points: true },
    });
  },

  findDuplicateUpi(upiId: string, excludeUserId: string) {
    return prisma.payoutProfile.findFirst({ where: { upiId, userId: { not: excludeUserId } } });
  },

  findDuplicatePan(panLast4: string, excludeUserId: string) {
    return prisma.payoutProfile.findMany({ where: { panLast4, userId: { not: excludeUserId } }, select: { userId: true } });
  },
};
