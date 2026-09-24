import { prisma } from '../config/prisma';
import { ledgerRepository } from '../repositories/ledger.repository';
import { pointsService } from '../services/points.service';
import { notificationService } from '../services/notification.service';
import { settingsService } from '../services/settings.service';
import { logger } from '../config/logger';

/** Expires credits whose expiry date has passed, capped by the wallet balance. */
export async function pointsExpiryJob() {
  const economics = await settingsService.getEconomics();
  if (economics.pointsExpiryDays <= 0) return { skipped: 'expiry disabled' };

  const due = await ledgerRepository.expiring(new Date(), 200);
  let expired = 0;
  let totalPoints = 0;

  for (const entry of due) {
    // Skip anything already reversed or expired.
    const alreadyHandled = await prisma.pointsLedger.findFirst({
      where: { transactionType: 'EXPIRY', sourceType: entry.sourceType, sourceId: `${entry.sourceId}:expiry`, userId: entry.userId },
    });
    if (alreadyHandled) continue;

    const wallet = await prisma.wallet.findUnique({ where: { userId: entry.userId } });
    const amount = Math.min(entry.points, wallet?.availablePoints ?? 0);
    if (amount <= 0) {
      await prisma.pointsLedger.update({ where: { id: entry.id }, data: { expiresAt: null } });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await pointsService.award({
          userId: entry.userId,
          points: -amount,
          transactionType: 'EXPIRY',
          sourceType: entry.sourceType as never,
          sourceId: `${entry.sourceId}:expiry`,
          description: `${amount.toLocaleString()} points expired`,
        }, tx);
        await tx.pointsLedger.update({ where: { id: entry.id }, data: { expiresAt: null } });
      });

      await notificationService.create({
        userId: entry.userId,
        type: 'ANNOUNCEMENT',
        title: 'Some points have expired',
        body: `${amount.toLocaleString()} points reached their ${economics.pointsExpiryDays}-day expiry.`,
        link: '/wallet',
      });

      expired += 1;
      totalPoints += amount;
    } catch (error) {
      logger.error({ error, ledgerId: entry.id }, 'points expiry failed');
    }
  }

  return { expired, totalPoints };
}
