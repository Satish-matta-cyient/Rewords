import { prisma } from '../config/prisma';
import { voucherService } from '../services/voucher.service';
import { notificationService } from '../services/notification.service';

/** Alerts staff when a voucher pool drops below its threshold. */
export async function voucherStockJob() {
  const low = await voucherService.lowStock();
  if (low.length === 0) return { alerts: 0 };

  const staff = await prisma.user.findMany({
    where: { primaryRole: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  const body = low.map((r) => `${r.title}: ${r.available} left`).join(' · ');
  await notificationService.createMany(
    staff.map((s) => ({
      userId: s.id,
      type: 'RISK_ALERT' as const,
      title: `${low.length} reward(s) running low on voucher codes`,
      body,
      link: '/super-admin/vouchers',
    })),
  );

  return { alerts: low.length, notified: staff.length };
}
