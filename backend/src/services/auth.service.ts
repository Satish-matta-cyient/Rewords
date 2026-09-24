import { prisma } from '../config/prisma';
import { userRepository } from '../repositories/user.repository';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  signAccessToken, generateOpaqueToken, hashToken, refreshExpiryDate, minutesFromNow,
} from '../utils/tokens';
import { AuthenticationError, BusinessRuleError, ConflictError, NotFoundError } from '../errors';
import { referralService } from './referral.service';
import { walletRepository } from '../repositories/wallet.repository';
import { auditService, type AuditContext } from './audit.service';
import { riskService } from './risk.service';
import { notificationService } from './notification.service';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { buildReferralLink } from '../utils/referralCode';
import type { AuthUser } from '../../../shared/types';
import type { Role } from '../../../shared/constants';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface RegisterInput {
  fullName: string; email: string; phone: string; password: string;
  referralCode?: string; termsVersion: string;
}

function toAuthUser(user: {
  id: string; email: string; fullName: string; primaryRole: string; status: string;
  emailVerifiedAt: Date | null; institutionId: string | null;
}, extras: { avatarUrl?: string | null; onboardingStep?: number; referralCode?: string | null }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.primaryRole as Role,
    status: user.status as AuthUser['status'],
    emailVerified: Boolean(user.emailVerifiedAt),
    institutionId: user.institutionId,
    avatarUrl: extras.avatarUrl ?? null,
    onboardingStep: extras.onboardingStep ?? 0,
    referralCode: extras.referralCode ?? null,
  };
}

export const authService = {
  async register(input: RegisterInput, ctx: AuditContext & { fingerprint?: string }) {
    const [emailTaken, phoneTaken] = await Promise.all([
      userRepository.findByEmail(input.email),
      userRepository.findByPhone(input.phone),
    ]);
    if (emailTaken) throw new ConflictError('An account with this email already exists');
    if (phoneTaken) {
      // The phone is a strong duplicate-account signal, so it is flagged rather than silently allowed.
      throw new ConflictError('An account with this phone number already exists');
    }

    const passwordHash = await hashPassword(input.password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          passwordHash,
          status: 'PENDING_VERIFICATION',
          primaryRole: 'USER',
          profile: { create: {} },
          notificationPref: { create: {} },
        },
      });

      await walletRepository.create(user.id, tx);
      await referralService.initialiseClosure(user.id, tx);
      const code = await referralService.issueCode(user.id, tx);

      await tx.termsAcceptance.create({
        data: { userId: user.id, version: input.termsVersion, ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null },
      });

      let referredBy: string | null = null;
      if (input.referralCode) {
        const attached = await referralService.attach(user.id, input.referralCode, tx);
        referredBy = attached.parentId;
        await referralService.awardSignupBonus(user.id, attached.parentId, tx);
      }

      return { user, code, referredBy };
    });

    const verificationToken = await authService.issueAuthToken(result.user.id, 'EMAIL_VERIFICATION', 60 * 24);

    await Promise.all([
      auditService.record({
        ...ctx, actorId: result.user.id, actorRole: 'USER',
        action: 'auth.register', entityType: 'User', entityId: result.user.id,
        after: { email: result.user.email, referredBy: result.referredBy },
      }),
      riskService.evaluateSignup(result.user.id, { ip: ctx.ip, fingerprint: ctx.fingerprint, phone: input.phone, referredBy: result.referredBy }),
      notificationService.create({
        userId: result.user.id,
        type: 'ANNOUNCEMENT',
        title: 'Welcome to EduRewards',
        body: 'Verify your email, complete onboarding and start sharing your referral link to earn points.',
        link: '/onboarding',
      }),
    ]);

    logger.info({ userId: result.user.id }, 'user registered');

    return {
      user: toAuthUser(result.user, { referralCode: result.code }),
      referralCode: result.code,
      referralLink: buildReferralLink(env.FRONTEND_URL, result.code),
      // Surfaced only outside production so the flow is testable without a mail server.
      verificationToken: env.NODE_ENV === 'production' ? undefined : verificationToken,
    };
  },

  async login(email: string, password: string, ctx: AuditContext) {
    const user = await userRepository.findByEmail(email);
    // Identical error for unknown email and bad password — no account enumeration.
    const genericError = new AuthenticationError('Email or password is incorrect');
    if (!user) throw genericError;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthenticationError('Too many failed attempts. Try again in a few minutes.');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      await userRepository.update(user.id, {
        failedLoginCount,
        lockedUntil: failedLoginCount >= MAX_FAILED_LOGINS ? minutesFromNow(LOCK_MINUTES) : null,
      });
      await auditService.record({ ...ctx, actorId: user.id, action: 'auth.login_failed', entityType: 'User', entityId: user.id });
      throw genericError;
    }

    if (user.status === 'SUSPENDED') throw new AuthenticationError('This account is suspended. Contact support.');
    if (user.status === 'DEACTIVATED') throw genericError;

    await userRepository.update(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() });

    const session = await authService.issueSession(user.id, user.primaryRole as Role, user.email, ctx);
    const full = await userRepository.findWithProfile(user.id);

    await auditService.record({
      ...ctx, actorId: user.id, actorRole: user.primaryRole,
      action: 'auth.login', entityType: 'User', entityId: user.id,
    });

    return {
      ...session,
      user: toAuthUser(user, {
        avatarUrl: full?.profile?.avatarUrl,
        onboardingStep: full?.profile?.onboardingStep ?? 0,
        referralCode: full?.referralCodes[0]?.code ?? null,
      }),
    };
  },

  async issueSession(userId: string, role: Role, email: string, ctx: AuditContext) {
    const accessToken = signAccessToken({ sub: userId, role, email, ver: 1 });
    const refreshToken = generateOpaqueToken();
    const family = generateOpaqueToken(16);

    await prisma.refreshToken.create({
      data: {
        userId, tokenHash: hashToken(refreshToken), family,
        userAgent: ctx.userAgent ?? null, ip: ctx.ip ?? null, expiresAt: refreshExpiryDate(),
      },
    });

    return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
  },

  /**
   * Rotating refresh flow. Reusing a already-rotated token is treated as theft:
   * the entire token family is revoked.
   */
  async refresh(refreshToken: string, ctx: AuditContext) {
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored) throw new AuthenticationError('Invalid session. Please sign in again.');

    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await auditService.record({
        ...ctx, actorId: stored.userId, action: 'auth.refresh_reuse_detected',
        entityType: 'RefreshToken', entityId: stored.id,
      });
      throw new AuthenticationError('Session expired. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) throw new AuthenticationError('Session expired. Please sign in again.');
    if (stored.user.status !== 'ACTIVE' && stored.user.status !== 'PENDING_VERIFICATION') {
      throw new AuthenticationError('This account is not active');
    }

    const nextToken = generateOpaqueToken();
    const nextHash = hashToken(nextToken);

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date(), replacedBy: nextHash } }),
      prisma.refreshToken.create({
        data: {
          userId: stored.userId, tokenHash: nextHash, family: stored.family,
          userAgent: ctx.userAgent ?? null, ip: ctx.ip ?? null, expiresAt: refreshExpiryDate(),
        },
      }),
    ]);

    return {
      accessToken: signAccessToken({
        sub: stored.userId, role: stored.user.primaryRole as Role, email: stored.user.email, ver: 1,
      }),
      refreshToken: nextToken,
      expiresIn: env.JWT_ACCESS_TTL,
    };
  },

  async logout(refreshToken: string | undefined, userId: string | undefined) {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: new Date() } });
    } else if (userId) {
      await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
  },

  async issueAuthToken(userId: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', ttlMinutes: number) {
    const token = generateOpaqueToken(32);
    await prisma.authToken.create({
      data: { userId, type, tokenHash: hashToken(token), expiresAt: minutesFromNow(ttlMinutes) },
    });
    return token;
  },

  async consumeAuthToken(token: string, type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET') {
    const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.type !== type) throw new BusinessRuleError('This link is invalid');
    if (record.usedAt) throw new BusinessRuleError('This link has already been used');
    if (record.expiresAt < new Date()) throw new BusinessRuleError('This link has expired. Request a new one.');
    await prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  },

  async verifyEmail(token: string, ctx: AuditContext) {
    const record = await authService.consumeAuthToken(token, 'EMAIL_VERIFICATION');
    const user = await prisma.user.update({
      where: { id: record.userId },
      data: {
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });
    await auditService.record({ ...ctx, actorId: user.id, action: 'auth.email_verified', entityType: 'User', entityId: user.id });
    return { verified: true };
  },

  async resendVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    if (user.emailVerifiedAt) throw new BusinessRuleError('This email is already verified');
    const token = await authService.issueAuthToken(userId, 'EMAIL_VERIFICATION', 60 * 24);
    return env.NODE_ENV === 'production' ? { sent: true } : { sent: true, token };
  },

  /** Always reports success so the endpoint cannot be used to discover accounts. */
  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) return { sent: true };
    const token = await authService.issueAuthToken(user.id, 'PASSWORD_RESET', 30);
    logger.info({ userId: user.id }, 'password reset requested');
    return env.NODE_ENV === 'production' ? { sent: true } : { sent: true, token };
  },

  async resetPassword(token: string, password: string, ctx: AuditContext) {
    const record = await authService.consumeAuthToken(token, 'PASSWORD_RESET');
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } }),
      // Every existing session dies when the password changes.
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await auditService.record({ ...ctx, actorId: record.userId, action: 'auth.password_reset', entityType: 'User', entityId: record.userId });
    return { reset: true };
  },

  async me(userId: string): Promise<AuthUser> {
    const user = await userRepository.findWithProfile(userId);
    if (!user) throw new NotFoundError('User');
    return toAuthUser(user, {
      avatarUrl: user.profile?.avatarUrl,
      onboardingStep: user.profile?.onboardingStep ?? 0,
      referralCode: user.referralCodes[0]?.code ?? null,
    });
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string, ctx: AuditContext) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new AuthenticationError('Your current password is incorrect');
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
    await auditService.record({ ...ctx, actorId: userId, action: 'auth.password_changed', entityType: 'User', entityId: userId });
    return { changed: true };
  },
};
