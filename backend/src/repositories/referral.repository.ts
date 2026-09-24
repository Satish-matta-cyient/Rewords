import { prisma, type Tx } from '../config/prisma';

export const referralRepository = {
  findCode(code: string, db: Tx | typeof prisma = prisma) {
    return db.referralCode.findUnique({ where: { code }, include: { user: true } });
  },

  activeCodeForUser(userId: string, db: Tx | typeof prisma = prisma) {
    return db.referralCode.findFirst({ where: { userId, active: true } });
  },

  createCode(userId: string, code: string, db: Tx | typeof prisma = prisma) {
    return db.referralCode.create({ data: { userId, code } });
  },

  incrementSignups(code: string, db: Tx | typeof prisma = prisma) {
    return db.referralCode.update({ where: { code }, data: { signups: { increment: 1 } } });
  },

  incrementClicks(code: string) {
    return prisma.referralCode.updateMany({ where: { code }, data: { clicks: { increment: 1 } } });
  },

  relationForChild(childId: string, db: Tx | typeof prisma = prisma) {
    return db.referralRelation.findUnique({ where: { childId } });
  },

  createRelation(childId: string, parentId: string, codeUsed: string, db: Tx | typeof prisma = prisma) {
    return db.referralRelation.create({ data: { childId, parentId, codeUsed } });
  },

  /** Ancestors ordered nearest-first. depth 1 = direct referrer. */
  ancestors(userId: string, maxDepth: number, db: Tx | typeof prisma = prisma) {
    return db.referralClosure.findMany({
      where: { descendantId: userId, depth: { gt: 0, lte: maxDepth } },
      orderBy: { depth: 'asc' },
      include: { ancestor: { select: { id: true, status: true, fullName: true, email: true } } },
    });
  },

  descendants(userId: string, maxDepth?: number, db: Tx | typeof prisma = prisma) {
    return db.referralClosure.findMany({
      where: { ancestorId: userId, depth: { gt: 0, ...(maxDepth ? { lte: maxDepth } : {}) } },
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      include: {
        descendant: {
          select: {
            id: true, fullName: true, email: true, status: true, createdAt: true,
            profile: { select: { avatarUrl: true } },
            _count: { select: { referralAsParent: true } },
          },
        },
      },
    });
  },

  /** Self-row at depth 0 keeps the closure table complete and simplifies inserts. */
  async insertSelfClosure(userId: string, db: Tx | typeof prisma = prisma) {
    return db.referralClosure.create({ data: { ancestorId: userId, descendantId: userId, depth: 0 } });
  },

  /**
   * Links a child into the closure table by copying every ancestor row of the parent
   * (plus the parent itself) and incrementing depth.
   */
  async linkClosure(childId: string, parentId: string, db: Tx | typeof prisma = prisma) {
    const parentAncestry = await db.referralClosure.findMany({ where: { descendantId: parentId } });
    const rows = parentAncestry.map((row) => ({
      ancestorId: row.ancestorId,
      descendantId: childId,
      depth: row.depth + 1,
    }));
    for (const row of rows) {
      await db.referralClosure.create({ data: row });
    }
    return rows.length;
  },

  isDescendant(ancestorId: string, descendantId: string, db: Tx | typeof prisma = prisma) {
    return db.referralClosure.findFirst({ where: { ancestorId, descendantId, depth: { gt: 0 } } });
  },

  directCount(userId: string) {
    return prisma.referralRelation.count({ where: { parentId: userId } });
  },

  totalDownline(userId: string) {
    return prisma.referralClosure.count({ where: { ancestorId: userId, depth: { gt: 0 } } });
  },

  setEarningsPaused(userId: string, paused: boolean, db: Tx | typeof prisma = prisma) {
    return db.referralRelation.updateMany({ where: { childId: userId }, data: { earningsPaused: paused } });
  },
};
