import { referralRepository } from '../repositories/referral.repository';
import { prisma, type Tx } from '../config/prisma';
import { BusinessRuleError, ConflictError, NotFoundError } from '../errors';
import { generateReferralCode, buildReferralLink } from '../utils/referralCode';
import { settingsService } from './settings.service';
import { pointsService } from './points.service';
import { notificationService } from './notification.service';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { ReferralNode } from '../../../shared/types';
import type { SourceType } from '../../../shared/constants';

export const referralService = {
  /** Codes are retried on collision; the unique index is the real guarantee. */
  async issueCode(userId: string, db: Tx | typeof prisma = prisma): Promise<string> {
    const existing = await referralRepository.activeCodeForUser(userId, db);
    if (existing) return existing.code;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateReferralCode(attempt < 5 ? 6 : 8);
      const taken = await referralRepository.findCode(code, db);
      if (taken) continue;
      await referralRepository.createCode(userId, code, db);
      return code;
    }
    throw new ConflictError('Could not allocate a unique referral code. Please try again.');
  },

  async resolveCode(code: string) {
    const record = await referralRepository.findCode(code.toUpperCase());
    if (!record || !record.active) throw new NotFoundError('Referral code');
    if (record.user.status === 'DEACTIVATED') throw new BusinessRuleError('This referral code is no longer valid');
    return record;
  },

  async trackClick(code: string) {
    await referralRepository.incrementClicks(code.toUpperCase());
  },

  /**
   * Attaches a new user beneath a referrer.
   * Guards: self-referral, circular referral, and parent immutability.
   */
  async attach(childId: string, code: string, db: Tx) {
    const record = await referralRepository.findCode(code.toUpperCase(), db);
    if (!record) throw new BusinessRuleError('That referral code does not exist');

    const parentId = record.userId;
    if (parentId === childId) throw new BusinessRuleError('You cannot refer yourself');

    const existingRelation = await referralRepository.relationForChild(childId, db);
    if (existingRelation) throw new ConflictError('This account is already linked to a referrer');

    // Circular protection: the prospective parent must not already sit below the child.
    const wouldCycle = await referralRepository.isDescendant(childId, parentId, db);
    if (wouldCycle) throw new BusinessRuleError('That referral link would create a circular network');

    await referralRepository.createRelation(childId, parentId, record.code, db);
    await referralRepository.linkClosure(childId, parentId, db);
    await referralRepository.incrementSignups(record.code, db);

    return { parentId, code: record.code };
  },

  /** Every user gets a depth-0 self row so closure inserts are uniform. */
  async initialiseClosure(userId: string, db: Tx) {
    await referralRepository.insertSelfClosure(userId, db);
  },

  /**
   * Distributes level bonuses up the chain for a qualifying event.
   * Runs entirely inside the caller's transaction.
   */
  async distribute(params: {
    originUserId: string;
    basePoints: number;
    sourceType: SourceType;
    sourceId: string;
    description: string;
  }, db: Tx) {
    const economics = await settingsService.getEconomics(db);
    const ancestors = await referralRepository.ancestors(params.originUserId, economics.referralMaxDepth, db);

    const breakdown: { userId: string; level: number; points: number; percent: number }[] = [];
    let totalPoints = 0;

    for (const row of ancestors) {
      const level = row.depth;
      const percent = economics.referralLevelPercentages[level - 1];
      if (percent === undefined || percent <= 0) continue;

      // A suspended ancestor keeps their place in the tree but stops accruing.
      if (row.ancestor.status !== 'ACTIVE') {
        logger.debug({ userId: row.ancestorId, level }, 'referral earning skipped — ancestor not active');
        continue;
      }
      const relation = await db.referralRelation.findUnique({ where: { childId: row.descendantId } });
      if (relation?.earningsPaused) continue;

      const points = Math.floor((params.basePoints * percent) / 100);
      if (points <= 0) continue;

      const result = await pointsService.award({
        userId: row.ancestorId,
        points,
        transactionType: 'LEVEL_BONUS',
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        description: `${params.description} · Level ${level} (${percent}%)`,
        level,
        originUserId: params.originUserId,
        metadata: { percent, basePoints: params.basePoints },
      }, db);

      if (!result.duplicate) {
        totalPoints += points;
        breakdown.push({ userId: row.ancestorId, level, points, percent });
        await notificationService.create({
          userId: row.ancestorId,
          type: 'POINTS_CREDITED',
          title: `+${points.toLocaleString()} points from your network`,
          body: `A level ${level} member's activity earned you ${points.toLocaleString()} points.`,
          link: '/wallet',
          metadata: { level, points },
        }, db);
      }
    }

    if (breakdown.length > 0) {
      const alreadyRecorded = await db.pointsDistribution.findUnique({
        where: { sourceType_sourceId: { sourceType: params.sourceType, sourceId: params.sourceId } },
      });
      if (!alreadyRecorded) {
        await db.pointsDistribution.create({
          data: {
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            triggeredById: params.originUserId,
            totalPoints,
            levelsPaid: breakdown.length,
            breakdown: JSON.stringify(breakdown),
          },
        });
      }
    }

    return { totalPoints, breakdown };
  },

  /** Awards the joining bonus to the direct referrer when a new member signs up. */
  async awardSignupBonus(childId: string, parentId: string, db: Tx) {
    const economics = await settingsService.getEconomics(db);
    if (economics.referralSignupBonus <= 0) return null;

    const parent = await db.user.findUnique({ where: { id: parentId }, select: { status: true, fullName: true } });
    if (!parent || parent.status !== 'ACTIVE') return null;

    const child = await db.user.findUnique({ where: { id: childId }, select: { fullName: true } });

    const result = await pointsService.award({
      userId: parentId,
      points: economics.referralSignupBonus,
      transactionType: 'REFERRAL_BONUS',
      sourceType: 'REFERRAL',
      sourceId: childId,
      description: `Referral bonus — ${child?.fullName ?? 'new member'} joined`,
      level: 1,
      originUserId: childId,
    }, db);

    if (!result.duplicate) {
      await notificationService.create({
        userId: parentId,
        type: 'REFERRAL_JOINED',
        title: 'A new ambassador joined through your link',
        body: `${child?.fullName ?? 'Someone'} signed up using your referral code. You earned ${economics.referralSignupBonus.toLocaleString()} points.`,
        link: '/network',
      }, db);
    }
    return result;
  },

  /** Builds the nested tree used by the Network page. */
  async tree(userId: string, maxDepth?: number): Promise<ReferralNode> {
    const economics = await settingsService.getEconomics();
    const depthLimit = maxDepth ?? economics.referralMaxDepth;
    const rows = await referralRepository.descendants(userId, depthLimit);
    const root = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, status: true, createdAt: true, profile: { select: { avatarUrl: true } } },
    });

    // Points each downline member generated for this user, read straight from the ledger.
    const contributions = await prisma.pointsLedger.groupBy({
      by: ['originUserId'],
      where: { userId, originUserId: { not: null }, points: { gt: 0 } },
      _sum: { points: true },
    });
    const contributionMap = new Map(contributions.map((c) => [c.originUserId as string, c._sum.points ?? 0]));

    const nodes = new Map<string, ReferralNode>();
    nodes.set(userId, {
      userId: root.id, fullName: root.fullName, email: root.email, avatarUrl: root.profile?.avatarUrl ?? null,
      depth: 0, joinedAt: root.createdAt.toISOString(), status: root.status as ReferralNode['status'],
      pointsGenerated: 0, directReferrals: 0, children: [],
    });

    for (const row of rows) {
      const d = row.descendant;
      nodes.set(d.id, {
        userId: d.id, fullName: d.fullName, email: d.email, avatarUrl: d.profile?.avatarUrl ?? null,
        depth: row.depth, joinedAt: d.createdAt.toISOString(), status: d.status as ReferralNode['status'],
        pointsGenerated: contributionMap.get(d.id) ?? 0,
        directReferrals: d._count.referralAsParent,
        children: [],
      });
    }

    const relations = await prisma.referralRelation.findMany({
      where: { childId: { in: [...nodes.keys()] } },
      select: { childId: true, parentId: true },
    });
    for (const rel of relations) {
      const parent = nodes.get(rel.parentId);
      const child = nodes.get(rel.childId);
      if (parent && child) parent.children.push(child);
    }

    return nodes.get(userId) as ReferralNode;
  },

  async stats(userId: string) {
    const economics = await settingsService.getEconomics();
    const [direct, total, byLevel, earned, code] = await Promise.all([
      referralRepository.directCount(userId),
      referralRepository.totalDownline(userId),
      prisma.referralClosure.groupBy({
        by: ['depth'],
        where: { ancestorId: userId, depth: { gt: 0, lte: economics.referralMaxDepth } },
        _count: { _all: true },
      }),
      prisma.pointsLedger.aggregate({
        where: { userId, transactionType: { in: ['REFERRAL_BONUS', 'LEVEL_BONUS'] }, points: { gt: 0 } },
        _sum: { points: true },
      }),
      referralRepository.activeCodeForUser(userId),
    ]);

    const pointsByLevel = await prisma.pointsLedger.groupBy({
      by: ['level'],
      where: { userId, transactionType: { in: ['REFERRAL_BONUS', 'LEVEL_BONUS'] }, points: { gt: 0 } },
      _sum: { points: true },
    });

    return {
      directReferrals: direct,
      totalNetwork: total,
      pointsFromNetwork: earned._sum.points ?? 0,
      maxDepth: economics.referralMaxDepth,
      levelPercentages: economics.referralLevelPercentages,
      code: code?.code ?? null,
      link: code ? buildReferralLink(env.FRONTEND_URL, code.code) : null,
      clicks: code?.clicks ?? 0,
      signups: code?.signups ?? 0,
      levels: Array.from({ length: economics.referralMaxDepth }, (_, idx) => {
        const level = idx + 1;
        return {
          level,
          percent: economics.referralLevelPercentages[idx] ?? 0,
          members: byLevel.find((b) => b.depth === level)?._count._all ?? 0,
          points: pointsByLevel.find((p) => p.level === level)?._sum.points ?? 0,
        };
      }),
    };
  },

  /** Suspension pauses earnings but deliberately leaves the tree structure intact. */
  async pauseEarnings(userId: string, paused: boolean, db: Tx | typeof prisma = prisma) {
    await referralRepository.setEarningsPaused(userId, paused, db);
  },

  /**
   * Policy-driven deletion: direct children are re-parented to the deleted user's
   * parent (or orphaned), and closure rows are rebuilt for the affected subtree.
   */
  async reparentChildren(userId: string, db: Tx) {
    const relation = await referralRepository.relationForChild(userId, db);
    const newParentId = relation?.parentId ?? null;
    const children = await db.referralRelation.findMany({ where: { parentId: userId } });

    for (const child of children) {
      await db.referralClosure.deleteMany({ where: { descendantId: child.childId, depth: { gt: 0 } } });
      if (newParentId) {
        await db.referralRelation.update({
          where: { childId: child.childId },
          data: { parentId: newParentId, codeUsed: `${child.codeUsed}:reparented` },
        });
        await referralRepository.linkClosure(child.childId, newParentId, db);
      } else {
        await db.referralRelation.delete({ where: { childId: child.childId } });
      }
      // Rebuild descendants of the moved child.
      const subtree = await db.referralRelation.findMany({ where: { parentId: child.childId } });
      for (const grandchild of subtree) {
        await db.referralClosure.deleteMany({ where: { descendantId: grandchild.childId, depth: { gt: 0 } } });
        await referralRepository.linkClosure(grandchild.childId, child.childId, db);
      }
    }
    return { reparented: children.length, newParentId };
  },
};
