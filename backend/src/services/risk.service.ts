import { prisma } from '../config/prisma';
import { riskRepository, type RiskFilters } from '../repositories/risk.repository';
import { notificationService } from './notification.service';
import { auditService, type AuditContext } from './audit.service';
import { paginate } from '../utils/pagination';
import { daysAgo } from '../utils/date';
import { NotFoundError } from '../errors';
import { logger } from '../config/logger';

const WEIGHTS: Record<string, number> = {
  SELF_REFERRAL: 40, CIRCULAR_REFERRAL: 40, DUPLICATE_PHONE: 30, DUPLICATE_PAN: 35,
  DUPLICATE_UPI: 35, DUPLICATE_URL: 25, SHARED_IP: 15, DEVICE_FINGERPRINT: 20,
  HIGH_REJECTION: 20, VELOCITY: 25, PAYOUT_ANOMALY: 30,
};

export interface FlagInput {
  userId: string;
  type: keyof typeof WEIGHTS;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  evidence?: Record<string, unknown>;
}

export const riskService = {
  /** Idempotent per (user, type): repeat detections append an event to the open flag. */
  async raiseFlag(input: FlagInput) {
    const weight = WEIGHTS[input.type] ?? 10;
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await riskRepository.findOpenFlag(input.userId, input.type, tx);
        const flag = existing
          ? await riskRepository.update(existing.id, { score: existing.score + weight }, tx)
          : await riskRepository.createFlag({
              userId: input.userId,
              type: input.type,
              severity: input.severity ?? 'MEDIUM',
              summary: input.summary,
              score: weight,
              evidence: input.evidence ? JSON.stringify(input.evidence) : null,
            }, tx);

        await riskRepository.createEvent({
          flagId: flag.id, userId: input.userId, type: input.type, weight,
          detail: input.summary,
        }, tx);

        await tx.user.update({ where: { id: input.userId }, data: { riskScore: { increment: weight } } });
        return flag;
      });
    } catch (error) {
      logger.error({ error, input }, 'failed to raise risk flag');
      return null;
    }
  },

  /** Signals captured at registration time. */
  async evaluateSignup(userId: string, meta: { ip?: string | null; fingerprint?: string | null; phone?: string; referredBy?: string | null }) {
    await riskRepository.createEvent({
      userId, type: 'SIGNUP', weight: 0, detail: 'Account created',
      ip: meta.ip ?? null, fingerprint: meta.fingerprint ?? null,
    });

    const since = daysAgo(7);
    if (meta.ip) {
      const sameIp = await riskRepository.eventsByIp(meta.ip, since);
      const distinct = new Set(sameIp.map((e) => e.userId));
      distinct.delete(userId);
      if (distinct.size >= 3) {
        await riskService.raiseFlag({
          userId, type: 'SHARED_IP', severity: distinct.size >= 6 ? 'HIGH' : 'MEDIUM',
          summary: `${distinct.size} other accounts registered from the same IP in the last 7 days`,
          evidence: { accounts: distinct.size },
        });
      }
    }

    if (meta.fingerprint) {
      const sameDevice = await riskRepository.eventsByFingerprint(meta.fingerprint, since);
      const distinct = new Set(sameDevice.map((e) => e.userId));
      distinct.delete(userId);
      if (distinct.size >= 2) {
        await riskService.raiseFlag({
          userId, type: 'DEVICE_FINGERPRINT', severity: 'HIGH',
          summary: `${distinct.size} other accounts share this device fingerprint`,
          evidence: { accounts: distinct.size },
        });
      }
    }

    if (meta.referredBy) {
      // Abnormally fast network growth for the referrer.
      const recent = await prisma.referralRelation.count({
        where: { parentId: meta.referredBy, createdAt: { gte: daysAgo(1) } },
      });
      if (recent >= 15) {
        await riskService.raiseFlag({
          userId: meta.referredBy, type: 'VELOCITY', severity: 'HIGH',
          summary: `${recent} referrals accepted in 24 hours`,
          evidence: { referralsLast24h: recent },
        });
      }
    }
  },

  async flagDuplicateUrl(userId: string, originalUserId: string, url: string) {
    await riskService.raiseFlag({
      userId, type: 'DUPLICATE_URL', severity: 'HIGH',
      summary: 'Submitted a post URL already claimed by another ambassador',
      evidence: { url, originalUserId },
    });
  },

  async evaluateRejectionRate(userId: string) {
    const rows = await prisma.postSubmission.groupBy({
      by: ['status'], where: { userId }, _count: { _all: true },
    });
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const rejected = rows.find((r) => r.status === 'REJECTED')?._count._all ?? 0;
    if (total >= 5 && rejected / total >= 0.5) {
      await riskService.raiseFlag({
        userId, type: 'HIGH_REJECTION', severity: 'MEDIUM',
        summary: `${Math.round((rejected / total) * 100)}% of submissions have been rejected`,
        evidence: { total, rejected },
      });
    }
  },

  /** Cheap, read-only heuristics surfaced in the reviewer drawer. */
  async scoreSubmission(submissionId: string, userId: string) {
    const signals = await riskService.signalsForSubmission(submissionId, userId);
    const score = signals.reduce((sum, s) => sum + s.weight, 0);
    const level = score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
    return { level: level as 'LOW' | 'MEDIUM' | 'HIGH', score, signals };
  },

  async signalsForSubmission(submissionId: string, userId: string) {
    const [user, openFlags, recentSubmissions, rejectionRows] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { riskScore: true, createdAt: true, emailVerifiedAt: true } }),
      prisma.riskFlag.count({ where: { userId, status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.postSubmission.count({ where: { userId, submittedAt: { gte: daysAgo(1) } } }),
      prisma.postSubmission.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
    ]);

    const signals: { key: string; label: string; weight: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' }[] = [];
    if (openFlags > 0) signals.push({ key: 'OPEN_FLAGS', label: `${openFlags} open risk flag(s)`, weight: 25, severity: 'HIGH' });
    if ((user?.riskScore ?? 0) >= 40) signals.push({ key: 'RISK_SCORE', label: `Account risk score ${user?.riskScore}`, weight: 20, severity: 'HIGH' });
    if (!user?.emailVerifiedAt) signals.push({ key: 'UNVERIFIED', label: 'Email not verified', weight: 15, severity: 'MEDIUM' });
    if (recentSubmissions >= 5) signals.push({ key: 'VELOCITY', label: `${recentSubmissions} submissions in 24h`, weight: 15, severity: 'MEDIUM' });

    const total = rejectionRows.reduce((s, r) => s + r._count._all, 0);
    const rejected = rejectionRows.find((r) => r.status === 'REJECTED')?._count._all ?? 0;
    if (total >= 4 && rejected / total >= 0.4) {
      signals.push({ key: 'REJECTION_RATE', label: `${Math.round((rejected / total) * 100)}% rejection rate`, weight: 15, severity: 'MEDIUM' });
    }
    if (user && Date.now() - user.createdAt.getTime() < 86_400_000) {
      signals.push({ key: 'NEW_ACCOUNT', label: 'Account created in the last 24 hours', weight: 10, severity: 'LOW' });
    }
    if (signals.length === 0) signals.push({ key: 'CLEAN', label: 'No risk signals detected', weight: 0, severity: 'LOW' });
    return signals;
  },

  async list(filters: RiskFilters) {
    const { items, total, page, pageSize } = await riskRepository.list(filters);
    return paginate(items, total, page, pageSize);
  },

  async detail(id: string) {
    const flag = await riskRepository.findById(id);
    if (!flag) throw new NotFoundError('Risk flag');
    return { ...flag, evidence: flag.evidence ? JSON.parse(flag.evidence) : null };
  },

  async resolve(id: string, decision: 'DISMISSED' | 'ACTIONED', note: string, ctx: AuditContext) {
    const flag = await riskRepository.findById(id);
    if (!flag) throw new NotFoundError('Risk flag');

    const updated = await prisma.$transaction(async (tx) => {
      const next = await riskRepository.update(id, {
        status: decision, resolvedById: ctx.actorId ?? null, resolvedAt: new Date(), resolutionNote: note,
      }, tx);
      if (decision === 'DISMISSED') {
        await tx.user.update({ where: { id: flag.userId }, data: { riskScore: { decrement: Math.min(flag.score, flag.user.riskScore) } } });
      }
      return next;
    });

    if (decision === 'ACTIONED') {
      await notificationService.create({
        userId: flag.userId, type: 'RISK_ALERT',
        title: 'Account review completed', body: note, link: '/support',
      });
    }

    await auditService.record({
      ...ctx, action: `risk.${decision.toLowerCase()}`, entityType: 'RiskFlag', entityId: id,
      before: { status: flag.status }, after: { status: decision, note },
    });
    return updated;
  },

  openCount: () => riskRepository.openCount(),
};
