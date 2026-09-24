import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';

export const walletRepository = {
  findByUser(userId: string, db: Tx | typeof prisma = prisma) {
    return db.wallet.findUnique({ where: { userId } });
  },

  create(userId: string, db: Tx | typeof prisma = prisma) {
    return db.wallet.create({ data: { userId } });
  },

  async ensure(userId: string, db: Tx | typeof prisma = prisma) {
    const existing = await db.wallet.findUnique({ where: { userId } });
    return existing ?? db.wallet.create({ data: { userId } });
  },

  update(userId: string, data: Prisma.WalletUncheckedUpdateInput, db: Tx | typeof prisma = prisma) {
    return db.wallet.update({ where: { userId }, data });
  },

  totals() {
    return prisma.wallet.aggregate({
      _sum: {
        availablePoints: true, pendingPoints: true, lockedPoints: true,
        redeemedPoints: true, expiredPoints: true, lifetimeEarned: true,
      },
    });
  },
};
