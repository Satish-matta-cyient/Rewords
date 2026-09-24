import { prisma } from '../config/prisma';

/** Moves campaigns between SCHEDULED -> ACTIVE -> COMPLETED based on their dates. */
export async function campaignLifecycleJob() {
  const now = new Date();

  const [activated, completed] = await Promise.all([
    prisma.campaign.updateMany({
      where: { status: 'SCHEDULED', startDate: { lte: now }, endDate: { gt: now }, deletedAt: null },
      data: { status: 'ACTIVE' },
    }),
    prisma.campaign.updateMany({
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, endDate: { lt: now }, deletedAt: null },
      data: { status: 'COMPLETED' },
    }),
  ]);

  return { activated: activated.count, completed: completed.count };
}
