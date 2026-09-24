import { prisma } from '../config/prisma';
import { walletRepository } from '../repositories/wallet.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { redemptionRepository } from '../repositories/redemption.repository';
import { payoutRepository } from '../repositories/payout.repository';
import { riskRepository } from '../repositories/risk.repository';
import { settingsService } from './settings.service';
import { referralService } from './referral.service';
import { rewardService } from './reward.service';
import { walletService } from './wallet.service';
import { gamificationService } from './gamification.service';
import { daysAgo, dailySeries, monthKey } from '../utils/date';
import { SLA_CRITICAL_HOURS, SLA_WARNING_HOURS } from '../../../shared/constants';
import { env } from '../config/env';
import { buildReferralLink } from '../utils/referralCode';
import type { UserDashboard } from '../../../shared/types';

function range(from?: Date, to?: Date) {
  return { from: from ?? daysAgo(30), to: to ?? new Date() };
}

export const analyticsService = {
  /** Everything the ambassador dashboard renders, in a single round trip. */
  async userDashboard(userId: string): Promise<UserDashboard> {
    const [user, wallet, referral, activity, recommended, trend, gamification, redeemedCount] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true } }),
      walletRepository.ensure(userId),
      referralService.stats(userId),
      prisma.pointsLedger.findMany({ where: { userId }, take: 8, orderBy: { createdAt: 'desc' } }),
      rewardService.recommendations(userId, 3),
      walletService.trend(userId, 30),
      gamificationService.profile(userId),
      prisma.redemption.count({ where: { userId, status: { in: ['APPROVED', 'FULFILLED'] } } }),
    ]);

    const economics = await settingsService.getEconomics();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [earnedThisMonth, referralsThisMonth, cashValue] = await Promise.all([
      prisma.pointsLedger.aggregate({ where: { userId, points: { gt: 0 }, createdAt: { gte: monthStart } }, _sum: { points: true } }),
      prisma.referralRelation.count({ where: { parentId: userId, createdAt: { gte: monthStart } } }),
      prisma.redemption.aggregate({ where: { userId, status: { in: ['APPROVED', 'FULFILLED'] } }, _sum: { cashValue: true } }),
    ]);

    // Referral growth: cumulative network size per day over 30 days.
    const joins = await prisma.referralClosure.findMany({
      where: { ancestorId: userId, depth: { gt: 0 }, createdAt: { gte: daysAgo(30) } },
      select: { createdAt: true, depth: true },
    });
    const referralSeries = dailySeries(daysAgo(30), new Date()).map((day) => {
      const sameDay = joins.filter((j) => j.createdAt.toISOString().slice(0, 10) === day.label);
      return {
        label: day.label,
        direct: sameDay.filter((j) => j.depth === 1).length,
        network: sameDay.filter((j) => j.depth > 1).length,
      };
    });

    return {
      greetingName: user.fullName.split(' ')[0],
      stats: [
        { key: 'available', label: 'Available Points', value: wallet.availablePoints, delta: earnedThisMonth._sum.points ?? 0, hint: `+${(earnedThisMonth._sum.points ?? 0).toLocaleString()} this month` },
        { key: 'referrals', label: 'Total Referrals', value: referral.totalNetwork, delta: referralsThisMonth, hint: `${referralsThisMonth} joined this month` },
        { key: 'earned', label: 'Points Earned', value: wallet.lifetimeEarned, hint: 'Lifetime earnings' },
        { key: 'redeemed', label: 'Rewards Redeemed', value: redeemedCount, hint: `₹${(cashValue._sum.cashValue ?? 0).toLocaleString()} total value` },
      ],
      referral: {
        code: referral.code ?? '',
        link: referral.link ?? buildReferralLink(env.FRONTEND_URL, referral.code ?? ''),
        signupBonus: economics.referralSignupBonus,
      },
      referralPerformance: referralSeries,
      pointsTrend: trend,
      recentActivity: activity.map((a) => ({
        id: a.id,
        title: a.description,
        detail: a.transactionType.replace(/_/g, ' ').toLowerCase(),
        points: a.points,
        createdAt: a.createdAt.toISOString(),
        type: a.transactionType,
      })),
      recommendedRewards: recommended.map((r) => ({ ...r, imageUrl: r.imageUrl ?? null })),
      tier: gamification.tier
        ? {
            key: gamification.tier.key,
            name: gamification.tier.name,
            nextKey: gamification.nextTier?.key ?? null,
            progressPercent: gamification.progressPercent,
          }
        : null,
    };
  },

  async adminDashboard(input: { from?: Date; to?: Date }) {
    const { from, to } = range(input.from, input.to);

    const [queue, pendingRedemptions, activeUsers, newUsers, issued, redeemed, flags, warning, critical, campaigns] =
      await Promise.all([
        submissionRepository.countByStatus(from, to),
        prisma.redemption.count({ where: { status: { in: ['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW'] } } }),
        prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: daysAgo(30) } } }),
        prisma.user.count({ where: { deletedAt: null, createdAt: { gte: from, lte: to } } }),
        prisma.pointsLedger.aggregate({ where: { points: { gt: 0 }, createdAt: { gte: from, lte: to } }, _sum: { points: true } }),
        prisma.pointsLedger.aggregate({ where: { transactionType: 'REDEMPTION_DEBIT', createdAt: { gte: from, lte: to } }, _sum: { points: true } }),
        riskRepository.openCount(),
        submissionRepository.pendingOlderThan(SLA_WARNING_HOURS),
        submissionRepository.pendingOlderThan(SLA_CRITICAL_HOURS),
        prisma.campaign.findMany({
          where: { deletedAt: null, status: { in: ['ACTIVE', 'PAUSED'] } },
          select: {
            id: true, name: true, creditValue: true, budgetPoints: true, budgetSpentPoints: true, status: true,
            _count: { select: { submissions: true } },
          },
          take: 8,
        }),
      ]);

    const submissionSeries = await analyticsService.submissionSeries(from, to);
    const pending = queue.filter((q) => ['PENDING', 'UNDER_REVIEW'].includes(q.status)).reduce((a, b) => a + b._count._all, 0);

    return {
      stats: [
        { key: 'pendingVerifications', label: 'Pending Verifications', value: pending },
        { key: 'pendingRedemptions', label: 'Pending Redemptions', value: pendingRedemptions },
        { key: 'activeUsers', label: 'Active Users (30d)', value: activeUsers },
        { key: 'newUsers', label: 'New Users', value: newUsers },
        { key: 'pointsIssued', label: 'Points Issued', value: issued._sum.points ?? 0 },
        { key: 'pointsRedeemed', label: 'Points Redeemed', value: Math.abs(redeemed._sum.points ?? 0) },
        { key: 'riskFlags', label: 'Open Risk Flags', value: flags },
        { key: 'slaBreaches', label: 'SLA Breaches (>72h)', value: critical },
      ],
      queueByStatus: queue.map((q) => ({ status: q.status, count: q._count._all })),
      aging: { warning: warning - critical, critical },
      submissionSeries,
      campaignPerformance: campaigns.map((c) => ({
        id: c.id, name: c.name, status: c.status, submissions: c._count.submissions,
        budgetPoints: c.budgetPoints, budgetSpentPoints: c.budgetSpentPoints,
        budgetUsedPercent: c.budgetPoints ? Math.round((c.budgetSpentPoints / c.budgetPoints) * 100) : null,
      })),
      reviewerSla: await analyticsService.reviewerPerformance(from, to),
    };
  },

  async superAdminDashboard(input: { from?: Date; to?: Date }) {
    const { from, to } = range(input.from, input.to);
    const economics = await settingsService.getEconomics();

    const [totals, users, newUsers, activeUsers, referralGrowth, distributed, redeemed, pendingRedemption, cash, flags, critical] =
      await Promise.all([
        walletRepository.totals(),
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, createdAt: { gte: from, lte: to } } }),
        prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: daysAgo(30) } } }),
        prisma.referralRelation.count({ where: { createdAt: { gte: from, lte: to } } }),
        prisma.pointsLedger.aggregate({ where: { points: { gt: 0 }, createdAt: { gte: from, lte: to } }, _sum: { points: true } }),
        prisma.pointsLedger.aggregate({ where: { transactionType: 'REDEMPTION_DEBIT' }, _sum: { points: true } }),
        redemptionRepository.pendingLiability(),
        payoutRepository.cashLiability(),
        riskRepository.openCount(),
        submissionRepository.pendingOlderThan(SLA_CRITICAL_HOURS),
      ]);

    const outstanding = (totals._sum.availablePoints ?? 0) + (totals._sum.lockedPoints ?? 0);

    return {
      stats: [
        { key: 'totalUsers', label: 'Total Users', value: users },
        { key: 'newUsers', label: 'New Users', value: newUsers },
        { key: 'activeUsers', label: 'Active Users (30d)', value: activeUsers },
        { key: 'referralGrowth', label: 'Referral Growth', value: referralGrowth },
        { key: 'pointsDistributed', label: 'Points Distributed', value: distributed._sum.points ?? 0 },
        { key: 'pointsOutstanding', label: 'Points Outstanding', value: outstanding },
        { key: 'pointsRedeemed', label: 'Points Redeemed', value: Math.abs(redeemed._sum.points ?? 0) },
        { key: 'fraudFlags', label: 'Open Fraud Flags', value: flags },
        { key: 'slaBreaches', label: 'Verification SLA Breaches', value: critical },
      ],
      liability: {
        outstandingPoints: outstanding,
        estimatedInrLiability: settingsService.pointsToInr(outstanding, economics),
        redeemedPoints: totals._sum.redeemedPoints ?? 0,
        pendingRedemptionPoints: pendingRedemption._sum.pointsSpent ?? 0,
        voucherLiabilityInr: pendingRedemption._sum.cashValue ?? 0,
        cashPayoutLiabilityInr: cash._sum.netAmount ?? 0,
        conversionRate: economics.pointsToInr,
      },
      pointsSeries: await analyticsService.pointsSeries(from, to),
      campaignRoi: await analyticsService.campaignRoi(from, to),
      userGrowth: await analyticsService.userGrowthSeries(from, to),
    };
  },

  async submissionSeries(from: Date, to: Date) {
    const rows = await prisma.postSubmission.findMany({
      where: { submittedAt: { gte: from, lte: to } },
      select: { submittedAt: true, status: true },
    });
    return dailySeries(from, to).map((day) => {
      const same = rows.filter((r) => r.submittedAt.toISOString().slice(0, 10) === day.label);
      return {
        label: day.label,
        submitted: same.length,
        approved: same.filter((r) => r.status === 'APPROVED').length,
        rejected: same.filter((r) => r.status === 'REJECTED').length,
      };
    });
  },

  async pointsSeries(from: Date, to: Date) {
    const rows = await prisma.pointsLedger.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, points: true, transactionType: true },
    });
    return dailySeries(from, to).map((day) => {
      const same = rows.filter((r) => r.createdAt.toISOString().slice(0, 10) === day.label);
      return {
        label: day.label,
        issued: same.filter((r) => r.points > 0).reduce((a, b) => a + b.points, 0),
        redeemed: Math.abs(same.filter((r) => r.transactionType === 'REDEMPTION_DEBIT').reduce((a, b) => a + b.points, 0)),
      };
    });
  },

  async userGrowthSeries(from: Date, to: Date) {
    const rows = await prisma.user.findMany({ where: { deletedAt: null, createdAt: { gte: from, lte: to } }, select: { createdAt: true } });
    const baseline = await prisma.user.count({ where: { deletedAt: null, createdAt: { lt: from } } });
    let cumulative = baseline;
    return dailySeries(from, to).map((day) => {
      const added = rows.filter((r) => r.createdAt.toISOString().slice(0, 10) === day.label).length;
      cumulative += added;
      return { label: day.label, new: added, total: cumulative };
    });
  },

  async campaignRoi(from: Date, to: Date) {
    const economics = await settingsService.getEconomics();
    const campaigns = await prisma.campaign.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, budgetSpentPoints: true, budgetPoints: true, creditValue: true,
        submissions: { where: { submittedAt: { gte: from, lte: to } }, select: { status: true } },
      },
    });
    return campaigns.map((c) => {
      const approved = c.submissions.filter((s) => s.status === 'APPROVED').length;
      const total = c.submissions.length;
      return {
        id: c.id,
        name: c.name,
        submissions: total,
        approved,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        pointsSpent: c.budgetSpentPoints,
        costInr: settingsService.pointsToInr(c.budgetSpentPoints, economics),
        costPerApprovedPost: approved > 0 ? Number((settingsService.pointsToInr(c.budgetSpentPoints, economics) / approved).toFixed(2)) : 0,
      };
    });
  },

  async reviewerPerformance(from: Date, to: Date) {
    const rows = await submissionRepository.reviewerThroughput(from, to);
    const reviewerIds = [...new Set(rows.map((r) => r.reviewerId).filter(Boolean))] as string[];
    const reviewers = await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, fullName: true } });

    return reviewers.map((reviewer) => {
      const own = rows.filter((r) => r.reviewerId === reviewer.id);
      const approved = own.find((r) => r.toStatus === 'APPROVED')?._count._all ?? 0;
      const rejected = own.find((r) => r.toStatus === 'REJECTED')?._count._all ?? 0;
      const total = own.reduce((a, b) => a + b._count._all, 0);
      return {
        reviewerId: reviewer.id, name: reviewer.fullName,
        decisions: total, approved, rejected,
        approvalRate: approved + rejected > 0 ? Math.round((approved / (approved + rejected)) * 100) : 0,
      };
    }).sort((a, b) => b.decisions - a.decisions);
  },

  async referralAnalytics(userId: string) {
    const stats = await referralService.stats(userId);
    const topPerformers = await prisma.pointsLedger.groupBy({
      by: ['originUserId'],
      where: { userId, originUserId: { not: null }, points: { gt: 0 } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 5,
    });
    const ids = topPerformers.map((t) => t.originUserId as string);
    const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });

    return {
      ...stats,
      topPerformers: topPerformers.map((t) => ({
        userId: t.originUserId,
        name: people.find((p) => p.id === t.originUserId)?.fullName ?? 'Unknown',
        points: t._sum.points ?? 0,
      })),
      leaderboard: await gamificationService.leaderboard('NETWORK', monthKey(), userId),
    };
  },
};
