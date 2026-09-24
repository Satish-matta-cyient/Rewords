import { prisma } from '../config/prisma';
import { toCsv } from '../utils/csv';
import { daysAgo } from '../utils/date';
import { BusinessRuleError } from '../errors';
import { analyticsService } from './analytics.service';

type Row = Record<string, unknown>;

interface ReportDefinition {
  key: string;
  label: string;
  columns: string[];
  build(range: { from: Date; to: Date }): Promise<Row[]>;
}

/**
 * Report definitions are data, not code paths — adding an Excel writer later
 * only requires a new serialiser, not new query logic.
 */
const REPORTS: ReportDefinition[] = [
  {
    key: 'users', label: 'Users',
    columns: ['id', 'fullName', 'email', 'status', 'role', 'availablePoints', 'lifetimeEarned', 'directReferrals', 'createdAt'],
    async build({ from, to }) {
      const users = await prisma.user.findMany({
        where: { deletedAt: null, createdAt: { gte: from, lte: to } },
        include: { wallet: true, _count: { select: { referralAsParent: true } } },
      });
      return users.map((u) => ({
        id: u.id, fullName: u.fullName, email: u.email, status: u.status, role: u.primaryRole,
        availablePoints: u.wallet?.availablePoints ?? 0, lifetimeEarned: u.wallet?.lifetimeEarned ?? 0,
        directReferrals: u._count.referralAsParent, createdAt: u.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'referrals', label: 'Referrals',
    columns: ['childId', 'childName', 'parentId', 'parentName', 'codeUsed', 'earningsPaused', 'joinedAt'],
    async build({ from, to }) {
      const rows = await prisma.referralRelation.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { child: { select: { fullName: true } }, parent: { select: { fullName: true } } },
      });
      return rows.map((r) => ({
        childId: r.childId, childName: r.child.fullName, parentId: r.parentId, parentName: r.parent.fullName,
        codeUsed: r.codeUsed, earningsPaused: r.earningsPaused, joinedAt: r.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'submissions', label: 'Submissions',
    columns: ['id', 'user', 'email', 'campaign', 'platform', 'status', 'awardedPoints', 'riskLevel', 'submittedAt', 'reviewedAt'],
    async build({ from, to }) {
      const rows = await prisma.postSubmission.findMany({
        where: { submittedAt: { gte: from, lte: to } },
        include: { user: { select: { fullName: true, email: true } }, campaign: { select: { name: true } } },
      });
      return rows.map((s) => ({
        id: s.id, user: s.user.fullName, email: s.user.email, campaign: s.campaign.name,
        platform: s.platform, status: s.status, awardedPoints: s.awardedPoints, riskLevel: s.riskLevel,
        submittedAt: s.submittedAt.toISOString(), reviewedAt: s.reviewedAt?.toISOString() ?? '',
      }));
    },
  },
  {
    key: 'points', label: 'Points ledger',
    columns: ['id', 'user', 'type', 'points', 'balanceAfter', 'level', 'sourceType', 'sourceId', 'description', 'createdAt'],
    async build({ from, to }) {
      const rows = await prisma.pointsLedger.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { user: { select: { email: true } } },
        take: 50_000,
      });
      return rows.map((l) => ({
        id: l.id, user: l.user.email, type: l.transactionType, points: l.points, balanceAfter: l.balanceAfter,
        level: l.level ?? '', sourceType: l.sourceType, sourceId: l.sourceId, description: l.description,
        createdAt: l.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'redemptions', label: 'Redemptions',
    columns: ['reference', 'user', 'email', 'reward', 'pointsSpent', 'cashValue', 'status', 'createdAt', 'fulfilledAt'],
    async build({ from, to }) {
      const rows = await prisma.redemption.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { user: { select: { fullName: true, email: true } }, reward: { select: { title: true } } },
      });
      return rows.map((r) => ({
        reference: r.reference, user: r.user.fullName, email: r.user.email, reward: r.reward.title,
        pointsSpent: r.pointsSpent, cashValue: r.cashValue, status: r.status,
        createdAt: r.createdAt.toISOString(), fulfilledAt: r.fulfilledAt?.toISOString() ?? '',
      }));
    },
  },
  {
    key: 'vouchers', label: 'Voucher inventory',
    columns: ['reward', 'status', 'count'],
    async build() {
      const rows = await prisma.voucherCode.groupBy({ by: ['rewardId', 'status'], _count: { _all: true } });
      const rewards = await prisma.reward.findMany({ select: { id: true, title: true } });
      return rows.map((r) => ({
        reward: rewards.find((x) => x.id === r.rewardId)?.title ?? r.rewardId,
        status: r.status, count: r._count._all,
      }));
    },
  },
  {
    key: 'payouts', label: 'Cash payouts',
    columns: ['reference', 'user', 'points', 'grossAmount', 'tdsAmount', 'netAmount', 'status', 'createdAt'],
    async build({ from, to }) {
      const rows = await prisma.payoutRequest.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { user: { select: { email: true } } },
      });
      return rows.map((p) => ({
        reference: p.reference, user: p.user.email, points: p.points, grossAmount: p.grossAmount,
        tdsAmount: p.tdsAmount, netAmount: p.netAmount, status: p.status, createdAt: p.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'risk', label: 'Risk flags',
    columns: ['id', 'user', 'type', 'severity', 'status', 'score', 'summary', 'createdAt'],
    async build({ from, to }) {
      const rows = await prisma.riskFlag.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: { user: { select: { email: true } } },
      });
      return rows.map((r) => ({
        id: r.id, user: r.user.email, type: r.type, severity: r.severity, status: r.status,
        score: r.score, summary: r.summary, createdAt: r.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'audit', label: 'Audit log',
    columns: ['id', 'actorRole', 'action', 'entityType', 'entityId', 'ip', 'createdAt'],
    async build({ from, to }) {
      const rows = await prisma.auditLog.findMany({ where: { createdAt: { gte: from, lte: to } }, take: 50_000 });
      return rows.map((a) => ({
        id: a.id, actorRole: a.actorRole ?? '', action: a.action, entityType: a.entityType,
        entityId: a.entityId ?? '', ip: a.ip ?? '', createdAt: a.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'campaigns', label: 'Campaign performance',
    columns: ['id', 'name', 'submissions', 'approved', 'approvalRate', 'pointsSpent', 'costInr', 'costPerApprovedPost'],
    async build({ from, to }) { return analyticsService.campaignRoi(from, to) as unknown as Row[]; },
  },
  {
    key: 'admin-performance', label: 'Admin performance',
    columns: ['reviewerId', 'name', 'decisions', 'approved', 'rejected', 'approvalRate'],
    async build({ from, to }) { return analyticsService.reviewerPerformance(from, to) as unknown as Row[]; },
  },
];

export const reportService = {
  catalogue: () => REPORTS.map((r) => ({ key: r.key, label: r.label, columns: r.columns })),

  async run(key: string, range: { from?: Date; to?: Date }) {
    const definition = REPORTS.find((r) => r.key === key);
    if (!definition) throw new BusinessRuleError(`Unknown report: ${key}`);
    const window = { from: range.from ?? daysAgo(90), to: range.to ?? new Date() };
    const rows = await definition.build(window);
    return { key, label: definition.label, columns: definition.columns, rows, window };
  },

  async toCsv(key: string, range: { from?: Date; to?: Date }) {
    const result = await reportService.run(key, range);
    return { filename: `${key}-${new Date().toISOString().slice(0, 10)}.csv`, content: toCsv(result.rows, result.columns) };
  },
};
