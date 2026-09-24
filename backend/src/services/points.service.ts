import { ledgerRepository } from '../repositories/ledger.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { prisma, type Tx } from '../config/prisma';
import { BusinessRuleError, ConflictError } from '../errors';
import { settingsService } from './settings.service';
import { addDays } from '../utils/date';
import { logger } from '../config/logger';
import type { SourceType, TransactionType } from '../../../shared/constants';

export interface AwardInput {
  userId: string;
  points: number;              // signed; positive credits, negative debits
  transactionType: TransactionType;
  sourceType: SourceType;
  sourceId: string;
  description: string;
  level?: number;
  originUserId?: string;
  metadata?: Record<string, unknown>;
  /** Bucket the movement affects. Defaults are derived from the transaction type. */
  bucket?: 'AVAILABLE' | 'LOCKED' | 'PENDING';
}

type WalletDelta = Partial<Record<
  'availablePoints' | 'pendingPoints' | 'lockedPoints' | 'redeemedPoints' | 'expiredPoints' | 'lifetimeEarned',
  number
>>;

/**
 * Translates a transaction into wallet bucket movements.
 * Keeping this in one place is what makes the derived wallet trustworthy.
 */
function walletDeltaFor(input: AwardInput): WalletDelta {
  const { transactionType, points } = input;
  switch (transactionType) {
    case 'REFERRAL_BONUS':
    case 'POST_REWARD':
    case 'LEVEL_BONUS':
    case 'MANUAL_CREDIT':
    case 'REFUND':
      return { availablePoints: points, lifetimeEarned: Math.max(0, points) };
    case 'MANUAL_DEBIT':
      return { availablePoints: points };
    case 'REDEMPTION_LOCK':
      // points is negative: move out of available, into locked.
      return { availablePoints: points, lockedPoints: -points };
    case 'REDEMPTION_DEBIT':
      // Consumes previously locked points.
      return { lockedPoints: points, redeemedPoints: -points };
    case 'REVERSAL':
      return { availablePoints: points, lifetimeEarned: Math.min(0, points) };
    case 'EXPIRY':
      return { availablePoints: points, expiredPoints: -points };
    default:
      return { availablePoints: points };
  }
}

async function applyDelta(userId: string, delta: WalletDelta, db: Tx) {
  const wallet = await walletRepository.ensure(userId, db);
  const next = {
    availablePoints: wallet.availablePoints + (delta.availablePoints ?? 0),
    pendingPoints: wallet.pendingPoints + (delta.pendingPoints ?? 0),
    lockedPoints: wallet.lockedPoints + (delta.lockedPoints ?? 0),
    redeemedPoints: wallet.redeemedPoints + (delta.redeemedPoints ?? 0),
    expiredPoints: wallet.expiredPoints + (delta.expiredPoints ?? 0),
    lifetimeEarned: wallet.lifetimeEarned + (delta.lifetimeEarned ?? 0),
  };

  // Hard invariant: no bucket may ever go negative.
  for (const [bucket, value] of Object.entries(next)) {
    if (value < 0) {
      throw new BusinessRuleError(
        `This operation would leave a negative ${bucket.replace('Points', '')} balance`,
        { bucket, attempted: value },
      );
    }
  }

  await walletRepository.update(userId, { ...next, version: { increment: 1 } }, db);
  return next;
}

export const pointsService = {
  /**
   * Appends a ledger entry and moves the wallet in the same transaction.
   * Idempotent by (userId, transactionType, sourceType, sourceId).
   */
  async award(input: AwardInput, db: Tx): Promise<{ ledgerId: string; balanceAfter: number; duplicate: boolean }> {
    if (!Number.isInteger(input.points)) throw new BusinessRuleError('Point values must be whole numbers');
    if (input.points === 0) throw new BusinessRuleError('Point movement cannot be zero');

    const existing = await ledgerRepository.findExisting(
      input.userId, input.transactionType, input.sourceType, input.sourceId, db,
    );
    if (existing) {
      logger.warn(
        { userId: input.userId, type: input.transactionType, sourceId: input.sourceId },
        'duplicate point award suppressed',
      );
      return { ledgerId: existing.id, balanceAfter: existing.balanceAfter, duplicate: true };
    }

    const next = await applyDelta(input.userId, walletDeltaFor(input), db);
    const economics = await settingsService.getEconomics(db);
    const expiresAt =
      input.points > 0 && economics.pointsExpiryDays > 0 ? addDays(new Date(), economics.pointsExpiryDays) : null;

    const entry = await ledgerRepository.create({
      userId: input.userId,
      transactionType: input.transactionType,
      points: input.points,
      balanceAfter: next.availablePoints,
      level: input.level ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      originUserId: input.originUserId ?? null,
      description: input.description,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      expiresAt,
    }, db);

    return { ledgerId: entry.id, balanceAfter: next.availablePoints, duplicate: false };
  },

  /** Creates a compensating REVERSAL entry. The original row is never modified. */
  async reverse(
    originalLedgerId: string,
    reason: string,
    actorId: string | null,
    db: Tx,
  ) {
    const original = await db.pointsLedger.findUnique({ where: { id: originalLedgerId } });
    if (!original) throw new ConflictError('Original ledger entry not found');

    const already = await db.pointsReversal.findUnique({ where: { originalLedgerId } });
    if (already) return { reversed: false, reason: 'already-reversed' as const };

    const result = await pointsService.award({
      userId: original.userId,
      points: -original.points,
      transactionType: 'REVERSAL',
      sourceType: original.sourceType as SourceType,
      sourceId: `${original.sourceId}:reversal`,
      description: `Reversal — ${reason}`,
      level: original.level ?? undefined,
      metadata: { originalLedgerId, reason },
    }, db);

    await db.pointsReversal.create({
      data: { originalLedgerId, reversalLedgerId: result.ledgerId, reason, actorId },
    });

    return { reversed: true, ledgerId: result.ledgerId };
  },

  /** Reverses every ledger row generated by a given source (e.g. a submission). */
  async reverseBySource(sourceType: SourceType, sourceId: string, reason: string, actorId: string | null, db: Tx) {
    const entries = await ledgerRepository.bySource(sourceType, sourceId, db);
    let reversedCount = 0;
    let reversedPoints = 0;
    for (const entry of entries) {
      if (entry.transactionType === 'REVERSAL') continue;
      const result = await pointsService.reverse(entry.id, reason, actorId, db);
      if (result.reversed) { reversedCount += 1; reversedPoints += entry.points; }
    }
    return { reversedCount, reversedPoints };
  },

  async manualAdjustment(params: { userId: string; adminId: string; points: number; reason: string }, db: Tx) {
    const type: TransactionType = params.points > 0 ? 'MANUAL_CREDIT' : 'MANUAL_DEBIT';
    const result = await pointsService.award({
      userId: params.userId,
      points: params.points,
      transactionType: type,
      sourceType: 'ADMIN',
      sourceId: `${params.adminId}:${Date.now()}`,
      description: params.reason,
      metadata: { adminId: params.adminId },
    }, db);

    await db.pointsAdjustment.create({
      data: { userId: params.userId, adminId: params.adminId, points: params.points, reason: params.reason, ledgerId: result.ledgerId },
    });
    return result;
  },

  /** Enforces the configurable monthly earning cap. */
  async assertWithinEarningCap(userId: string, incoming: number, db: Tx | typeof prisma = prisma) {
    const economics = await settingsService.getEconomics(db);
    if (economics.monthlyEarnCap <= 0) return;
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const agg = await db.pointsLedger.aggregate({
      where: { userId, points: { gt: 0 }, createdAt: { gte: monthStart } },
      _sum: { points: true },
    });
    const earned = agg._sum.points ?? 0;
    if (earned + incoming > economics.monthlyEarnCap) {
      throw new BusinessRuleError(
        `This award would exceed the monthly earning cap of ${economics.monthlyEarnCap.toLocaleString()} points`,
        { earned, cap: economics.monthlyEarnCap },
      );
    }
  },
};
