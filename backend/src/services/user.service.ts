import { prisma } from '../config/prisma';
import { userRepository, type UserListFilters } from '../repositories/user.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { NotFoundError, BusinessRuleError, ConflictError } from '../errors';
import { paginate } from '../utils/pagination';
import { auditService, type AuditContext } from './audit.service';
import { referralService } from './referral.service';
import { pointsService } from './points.service';
import { notificationService } from './notification.service';
import { hashPassword } from '../utils/password';
import { maskAccount, maskPan } from '../utils/crypto';
import { settingsService } from './settings.service';
import type { Role } from '../../../shared/constants';

export const userService = {
  async list(filters: UserListFilters) {
    const { items, total, page, pageSize } = await userRepository.list(filters);
    return paginate(
      items.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        status: u.status,
        role: u.primaryRole,
        riskScore: u.riskScore,
        availablePoints: u.wallet?.availablePoints ?? 0,
        lifetimeEarned: u.wallet?.lifetimeEarned ?? 0,
        referralCode: u.referralCodes[0]?.code ?? null,
        directReferrals: u._count.referralAsParent,
        submissions: u._count.submissions,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total, page, pageSize,
    );
  },

  async detail(userId: string, viewerRole: Role) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        wallet: true,
        referralCodes: true,
        tier: { include: { tier: true } },
        payoutProfile: true,
        institution: { select: { id: true, name: true } },
        _count: { select: { submissions: true, redemptions: true, referralAsParent: true, riskFlags: true } },
      },
    });
    if (!user) throw new NotFoundError('User');

    const [referralStats, recentSubmissions, recentRedemptions, openFlags, latestLedger] = await Promise.all([
      referralService.stats(userId),
      prisma.postSubmission.findMany({
        where: { userId }, take: 10, orderBy: { submittedAt: 'desc' },
        include: { campaign: { select: { name: true } } },
      }),
      prisma.redemption.findMany({
        where: { userId }, take: 10, orderBy: { createdAt: 'desc' },
        include: { reward: { select: { title: true } } },
      }),
      prisma.riskFlag.findMany({ where: { userId, status: { in: ['OPEN', 'UNDER_REVIEW'] } }, orderBy: { createdAt: 'desc' } }),
      prisma.pointsLedger.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' } }),
    ]);

    // Payout details are masked for everyone; raw values are never returned by this endpoint.
    const payout = user.payoutProfile
      ? {
          method: user.payoutProfile.method,
          upiId: user.payoutProfile.upiId ? `${user.payoutProfile.upiId.slice(0, 2)}****${user.payoutProfile.upiId.slice(-4)}` : null,
          account: maskAccount(user.payoutProfile.accountLast4),
          pan: viewerRole === 'SUPER_ADMIN' ? maskPan(user.payoutProfile.panLast4) : 'Restricted',
          ifsc: user.payoutProfile.ifsc,
          verified: user.payoutProfile.verified,
        }
      : null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: user.primaryRole,
      riskScore: user.riskScore,
      emailVerified: Boolean(user.emailVerifiedAt),
      institution: user.institution,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      wallet: user.wallet,
      tier: user.tier?.tier ?? null,
      referral: referralStats,
      counts: user._count,
      payout,
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id, campaign: s.campaign.name, platform: s.platform, status: s.status,
        awardedPoints: s.awardedPoints, submittedAt: s.submittedAt,
      })),
      recentRedemptions: recentRedemptions.map((r) => ({
        id: r.id, reference: r.reference, reward: r.reward.title, status: r.status,
        pointsSpent: r.pointsSpent, createdAt: r.createdAt,
      })),
      openFlags,
      recentLedger: latestLedger,
    };
  },

  async updateProfile(userId: string, data: Record<string, unknown>, ctx: AuditContext) {
    const before = await prisma.profile.findUnique({ where: { userId } });
    const { fullName, phone, interests, ...profileData } = data as {
      fullName?: string; phone?: string; interests?: string[];
    } & Record<string, unknown>;

    if (phone) {
      const taken = await prisma.user.findFirst({ where: { phone, id: { not: userId }, deletedAt: null } });
      if (taken) throw new ConflictError('That phone number is already in use');
    }

    const result = await prisma.$transaction(async (tx) => {
      if (fullName || phone) {
        await tx.user.update({ where: { id: userId }, data: { ...(fullName ? { fullName } : {}), ...(phone ? { phone } : {}) } });
      }
      return tx.profile.upsert({
        where: { userId },
        create: { userId, ...profileData, ...(interests ? { interests: JSON.stringify(interests) } : {}) },
        update: { ...profileData, ...(interests ? { interests: JSON.stringify(interests) } : {}) },
      });
    });

    await auditService.record({ ...ctx, action: 'user.profile_updated', entityType: 'Profile', entityId: userId, before, after: result });
    return result;
  },

  async advanceOnboarding(userId: string, step: number) {
    return prisma.profile.update({
      where: { userId },
      data: { onboardingStep: step, ...(step >= 3 ? { onboardedAt: new Date() } : {}) },
    });
  },

  async setStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', reason: string, ctx: AuditContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.primaryRole === 'SUPER_ADMIN' && ctx.actorRole !== 'SUPER_ADMIN') {
      throw new BusinessRuleError('Only a Super Admin can change another Super Admin account');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id: userId }, data: { status } });
      // The referral tree is preserved; only earning eligibility changes.
      await referralService.pauseEarnings(userId, status !== 'ACTIVE', tx);
      if (status !== 'ACTIVE') {
        await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return next;
    });

    await auditService.record({
      ...ctx, action: `user.${status.toLowerCase()}`, entityType: 'User', entityId: userId,
      before: { status: user.status }, after: { status }, metadata: { reason },
    });

    await notificationService.create({
      userId,
      type: 'ANNOUNCEMENT',
      title: status === 'ACTIVE' ? 'Your account has been reactivated' : 'Your account status changed',
      body: reason,
    });

    return updated;
  },

  async adjustPoints(userId: string, params: { points: number; reason: string }, ctx: AuditContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    const result = await prisma.$transaction(async (tx) =>
      pointsService.manualAdjustment({ userId, adminId: ctx.actorId as string, points: params.points, reason: params.reason }, tx));

    await auditService.record({
      ...ctx, action: 'points.manual_adjustment', entityType: 'User', entityId: userId,
      after: { points: params.points, reason: params.reason, ledgerId: result.ledgerId },
    });

    await notificationService.create({
      userId,
      type: 'POINTS_CREDITED',
      title: params.points > 0 ? `${params.points.toLocaleString()} points added` : `${Math.abs(params.points).toLocaleString()} points deducted`,
      body: params.reason,
      link: '/wallet',
    });

    return result;
  },

  async createStaff(input: { fullName: string; email: string; phone?: string; password: string; role: 'ADMIN' | 'SUPER_ADMIN' }, ctx: AuditContext) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new ConflictError('An account with this email already exists');

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone ?? null,
          passwordHash: await hashPassword(input.password),
          primaryRole: input.role,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          profile: { create: { onboardingStep: 3, onboardedAt: new Date() } },
          notificationPref: { create: {} },
        },
      });
      await walletRepository.create(created.id, tx);
      await referralService.initialiseClosure(created.id, tx);
      return created;
    });

    await auditService.record({
      ...ctx, action: 'admin.created', entityType: 'User', entityId: user.id,
      after: { email: user.email, role: input.role },
    });
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.primaryRole };
  },

  async changeRole(userId: string, role: Role, ctx: AuditContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (userId === ctx.actorId) throw new BusinessRuleError('You cannot change your own role');

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id: userId }, data: { primaryRole: role } });
      // Role change invalidates outstanding sessions so stale tokens cannot retain privileges.
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return next;
    });

    await auditService.record({
      ...ctx, action: 'user.role_changed', entityType: 'User', entityId: userId,
      before: { role: user.primaryRole }, after: { role },
    });
    return { id: updated.id, role: updated.primaryRole };
  },

  async listStaff() {
    const staff = await prisma.user.findMany({
      where: { primaryRole: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullName: true, email: true, primaryRole: true, status: true, lastLoginAt: true, createdAt: true },
    });

    const throughput = await prisma.postReview.groupBy({
      by: ['reviewerId'],
      where: { reviewerId: { in: staff.map((s) => s.id) } },
      _count: { _all: true },
    });

    return staff.map((s) => ({
      ...s,
      role: s.primaryRole,
      decisions: throughput.find((t) => t.reviewerId === s.id)?._count._all ?? 0,
    }));
  },

  /** Soft delete with referral re-parenting and audit preservation. */
  async softDelete(userId: string, reason: string, ctx: AuditContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.primaryRole === 'SUPER_ADMIN') throw new BusinessRuleError('Super Admin accounts cannot be deleted from here');

    const result = await prisma.$transaction(async (tx) => {
      const reparent = await referralService.reparentChildren(userId, tx);
      await tx.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), status: 'DEACTIVATED', email: `deleted+${userId}@edurewards.invalid`, phone: null },
      });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return reparent;
    });

    await auditService.record({
      ...ctx, action: 'user.deleted', entityType: 'User', entityId: userId,
      before: { email: user.email }, metadata: { reason, ...result },
    });
    return result;
  },

  async walletSummary(userId: string) {
    const [wallet, economics] = await Promise.all([
      walletRepository.ensure(userId),
      settingsService.getEconomics(),
    ]);
    return {
      availablePoints: wallet.availablePoints,
      pendingPoints: wallet.pendingPoints,
      lockedPoints: wallet.lockedPoints,
      redeemedPoints: wallet.redeemedPoints,
      expiredPoints: wallet.expiredPoints,
      lifetimeEarned: wallet.lifetimeEarned,
      estimatedValueInr: settingsService.pointsToInr(wallet.availablePoints, economics),
    };
  },
};
