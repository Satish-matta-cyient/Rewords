import { prisma } from '../config/prisma';
import { walletRepository } from '../repositories/wallet.repository';
import { monthKey } from '../utils/date';
import { logger } from '../config/logger';

export const gamificationService = {
  /** Recomputes tier, streak and badges for one user. Safe to call repeatedly. */
  async refreshForUser(userId: string) {
    const [wallet, referrals, approved, tiers] = await Promise.all([
      walletRepository.ensure(userId),
      prisma.referralRelation.count({ where: { parentId: userId } }),
      prisma.postSubmission.count({ where: { userId, status: 'APPROVED' } }),
      prisma.tier.findMany({ orderBy: { minPoints: 'asc' } }),
    ]);

    const earned = tiers.filter((t) => wallet.lifetimeEarned >= t.minPoints && referrals >= t.minReferrals);
    const current = earned[earned.length - 1] ?? tiers[0];
    if (current) {
      await prisma.userTier.upsert({
        where: { userId },
        create: { userId, tierId: current.id },
        update: { tierId: current.id },
      });
    }

    await gamificationService.evaluateBadges(userId, { referrals, approved, lifetimeEarned: wallet.lifetimeEarned });
    await gamificationService.touchStreak(userId);
    return current;
  },

  async evaluateBadges(userId: string, stats: { referrals: number; approved: number; lifetimeEarned: number }) {
    const badges = await prisma.badge.findMany();
    for (const badge of badges) {
      if (!badge.criteria) continue;
      let criteria: { metric: string; gte: number };
      try { criteria = JSON.parse(badge.criteria); } catch { continue; }
      const value = (stats as Record<string, number>)[criteria.metric];
      if (value === undefined || value < criteria.gte) continue;
      await prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        create: { userId, badgeId: badge.id },
        update: {},
      });
    }
  },

  async touchStreak(userId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const streak = await prisma.streak.findUnique({ where: { userId } });
    if (!streak) return prisma.streak.create({ data: { userId, currentDays: 1, longestDays: 1, lastActiveOn: today } });

    const last = streak.lastActiveOn ? new Date(streak.lastActiveOn) : null;
    if (last) last.setHours(0, 0, 0, 0);
    if (last && last.getTime() === today.getTime()) return streak;

    const isConsecutive = last ? today.getTime() - last.getTime() === 86_400_000 : false;
    const currentDays = isConsecutive ? streak.currentDays + 1 : 1;
    return prisma.streak.update({
      where: { userId },
      data: { currentDays, longestDays: Math.max(streak.longestDays, currentDays), lastActiveOn: today },
    });
  },

  async profile(userId: string) {
    const [tier, tiers, badges, streak, wallet, referrals] = await Promise.all([
      prisma.userTier.findUnique({ where: { userId }, include: { tier: true } }),
      prisma.tier.findMany({ orderBy: { minPoints: 'asc' } }),
      prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }),
      prisma.streak.findUnique({ where: { userId } }),
      walletRepository.ensure(userId),
      prisma.referralRelation.count({ where: { parentId: userId } }),
    ]);

    const currentIndex = tier ? tiers.findIndex((t) => t.id === tier.tierId) : 0;
    const next = tiers[currentIndex + 1] ?? null;
    const progressPercent = next
      ? Math.min(100, Math.round((wallet.lifetimeEarned / next.minPoints) * 100))
      : 100;

    return {
      tier: tier?.tier ?? tiers[0] ?? null,
      nextTier: next,
      progressPercent,
      pointsToNextTier: next ? Math.max(0, next.minPoints - wallet.lifetimeEarned) : 0,
      badges: badges.map((b) => ({ ...b.badge, earnedAt: b.earnedAt })),
      allBadges: await prisma.badge.findMany(),
      streak: streak ?? { currentDays: 0, longestDays: 0 },
      stats: { lifetimeEarned: wallet.lifetimeEarned, directReferrals: referrals },
    };
  },

  /** Leaderboards respect the user's opt-out flag. */
  async leaderboard(scope: 'POINTS' | 'NETWORK' | 'APPROVED_POSTS', period = monthKey(), viewerId?: string) {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { scope, period },
      orderBy: { rank: 'asc' },
      take: 50,
      include: { user: { select: { id: true, fullName: true, profile: { select: { avatarUrl: true, publicOnLeaderboard: true } }, tier: { include: { tier: true } } } } },
    });

    const visible = entries
      .filter((e) => e.user.profile?.publicOnLeaderboard !== false || e.userId === viewerId)
      .map((e) => ({
        rank: e.rank,
        userId: e.userId,
        name: e.user.profile?.publicOnLeaderboard === false ? 'Private ambassador' : e.user.fullName,
        avatarUrl: e.user.profile?.avatarUrl ?? null,
        tier: e.user.tier?.tier.key ?? null,
        value: e.value,
        isYou: e.userId === viewerId,
      }));

    const you = visible.find((v) => v.isYou) ?? null;
    return { period, scope, entries: visible, you };
  },

  /** Rebuilds all leaderboards. Invoked by the scheduler. */
  async rebuildLeaderboards(period = monthKey()) {
    const periodStart = new Date(`${period}-01T00:00:00.000Z`);
    const periodEnd = new Date(periodStart); periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [points, network, posts] = await Promise.all([
      prisma.pointsLedger.groupBy({
        by: ['userId'], where: { points: { gt: 0 }, createdAt: { gte: periodStart, lt: periodEnd } },
        _sum: { points: true },
      }),
      prisma.referralRelation.groupBy({
        by: ['parentId'], where: { createdAt: { gte: periodStart, lt: periodEnd } }, _count: { _all: true },
      }),
      prisma.postSubmission.groupBy({
        by: ['userId'], where: { status: 'APPROVED', reviewedAt: { gte: periodStart, lt: periodEnd } }, _count: { _all: true },
      }),
    ]);

    const datasets: [string, { userId: string; value: number }[]][] = [
      ['POINTS', points.map((p) => ({ userId: p.userId, value: p._sum.points ?? 0 }))],
      ['NETWORK', network.map((n) => ({ userId: n.parentId, value: n._count._all }))],
      ['APPROVED_POSTS', posts.map((p) => ({ userId: p.userId, value: p._count._all }))],
    ];

    let written = 0;
    for (const [scope, rows] of datasets) {
      const ranked = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 100);
      for (const [index, row] of ranked.entries()) {
        await prisma.leaderboardEntry.upsert({
          where: { period_scope_userId: { period, scope, userId: row.userId } },
          create: { period, scope, userId: row.userId, rank: index + 1, value: row.value },
          update: { rank: index + 1, value: row.value },
        });
        written += 1;
      }
    }
    logger.info({ period, written }, 'leaderboards rebuilt');
    return { period, written };
  },
};
