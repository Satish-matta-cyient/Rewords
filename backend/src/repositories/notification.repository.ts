import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../config/prisma';
import { toSkipTake } from '../utils/pagination';

export const notificationRepository = {
  create(data: Prisma.NotificationUncheckedCreateInput, db: Tx | typeof prisma = prisma) {
    return db.notification.create({ data });
  },

  createMany(data: Prisma.NotificationUncheckedCreateInput[], db: Tx | typeof prisma = prisma) {
    return db.notification.createMany({ data });
  },

  async list(userId: string, filters: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const { page, pageSize, skip, take } = toSkipTake(filters);
    const where: Prisma.NotificationWhereInput = { userId, ...(filters.unreadOnly ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, page, pageSize, unread };
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  },

  unreadCount(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  preferences(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  },

  upsertPreferences(userId: string, data: Prisma.NotificationPreferenceUncheckedUpdateInput) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...(data as Prisma.NotificationPreferenceUncheckedCreateInput) },
      update: data,
    });
  },
};
