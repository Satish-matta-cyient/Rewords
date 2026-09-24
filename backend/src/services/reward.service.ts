import { rewardRepository, type RewardFilters } from '../repositories/reward.repository';
import { voucherRepository } from '../repositories/voucher.repository';
import { walletRepository } from '../repositories/wallet.repository';
import { settingsService } from './settings.service';
import { auditService, type AuditContext } from './audit.service';
import { NotFoundError, ConflictError } from '../errors';
import { paginate } from '../utils/pagination';
import { prisma } from '../config/prisma';

export const rewardService = {
  async list(filters: RewardFilters, viewerId?: string) {
    const [{ items, total, page, pageSize }, wallet] = await Promise.all([
      rewardRepository.list(filters),
      viewerId ? walletRepository.ensure(viewerId) : Promise.resolve(null),
    ]);

    return paginate(
      items.map((r) => {
        const available = r.deliveryType === 'VOUCHER_CODE' ? r._count.voucherCodes : r.stock;
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category.key,
          categoryName: r.category.name,
          imageUrl: r.imageUrl,
          pointsCost: r.pointsCost,
          cashValue: r.cashValue,
          stock: available,
          inStock: available > 0,
          badge: r.badge,
          featured: r.featured,
          deliveryType: r.deliveryType,
          active: r.active,
          affordable: wallet ? wallet.availablePoints >= r.pointsCost : false,
          balanceAfter: wallet ? wallet.availablePoints - r.pointsCost : null,
        };
      }),
      total, page, pageSize,
    );
  },

  async detail(id: string, viewerId?: string) {
    const reward = await rewardRepository.findById(id);
    if (!reward) throw new NotFoundError('Reward');
    const [available, wallet, economics] = await Promise.all([
      reward.deliveryType === 'VOUCHER_CODE' ? voucherRepository.availableCount(id) : Promise.resolve(reward.stock),
      viewerId ? walletRepository.ensure(viewerId) : Promise.resolve(null),
      settingsService.getEconomics(),
    ]);

    return {
      ...reward,
      category: reward.category.key,
      categoryName: reward.category.name,
      stock: available,
      inStock: available > 0,
      affordable: wallet ? wallet.availablePoints >= reward.pointsCost : false,
      balanceAfter: wallet ? wallet.availablePoints - reward.pointsCost : null,
      minRedemptionPoints: economics.minRedemptionPoints,
    };
  },

  categories: () => rewardRepository.categories(),

  async create(input: Record<string, unknown> & { categoryKey: string }, ctx: AuditContext) {
    const category = await prisma.rewardCategory.findUnique({ where: { key: input.categoryKey } });
    if (!category) throw new NotFoundError('Reward category');
    const { categoryKey, ...rest } = input;
    const reward = await rewardRepository.create({ ...(rest as never), categoryId: category.id });
    await auditService.record({ ...ctx, action: 'reward.created', entityType: 'Reward', entityId: reward.id, after: reward });
    return reward;
  },

  async update(id: string, patch: Record<string, unknown> & { categoryKey?: string }, ctx: AuditContext) {
    const before = await rewardRepository.findById(id);
    if (!before) throw new NotFoundError('Reward');
    const { categoryKey, ...rest } = patch;
    let categoryId: string | undefined;
    if (categoryKey) {
      const category = await prisma.rewardCategory.findUnique({ where: { key: categoryKey } });
      if (!category) throw new NotFoundError('Reward category');
      categoryId = category.id;
    }
    const updated = await rewardRepository.update(id, { ...(rest as never), ...(categoryId ? { categoryId } : {}) });
    await auditService.record({ ...ctx, action: 'reward.updated', entityType: 'Reward', entityId: id, before, after: updated });
    return updated;
  },

  async archive(id: string, ctx: AuditContext) {
    const before = await rewardRepository.findById(id);
    if (!before) throw new NotFoundError('Reward');
    const pending = await prisma.redemption.count({
      where: { rewardId: id, status: { in: ['REQUESTED', 'POINTS_LOCKED', 'UNDER_REVIEW', 'APPROVED'] } },
    });
    if (pending > 0) throw new ConflictError(`${pending} redemption(s) are still open for this reward`);

    const updated = await rewardRepository.update(id, { active: false, deletedAt: new Date() });
    await auditService.record({ ...ctx, action: 'reward.archived', entityType: 'Reward', entityId: id, before });
    return updated;
  },

  async recommendations(userId: string, take = 3) {
    const wallet = await walletRepository.ensure(userId);
    const { items } = await rewardRepository.list({ pageSize: 20 });
    return items
      .map((r) => ({
        id: r.id, title: r.title, pointsCost: r.pointsCost, cashValue: r.cashValue,
        imageUrl: r.imageUrl, category: r.category.key,
        affordable: wallet.availablePoints >= r.pointsCost,
      }))
      // Closest affordable first, then the nearest stretch goal.
      .sort((a, b) => Number(b.affordable) - Number(a.affordable) || a.pointsCost - b.pointsCost)
      .slice(0, take);
  },
};
