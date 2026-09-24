import { notificationRepository } from '../repositories/notification.repository';
import { prisma, type Tx } from '../config/prisma';
import { paginate } from '../utils/pagination';
import { logger } from '../config/logger';
import { env } from '../config/env';
import type { NotificationType } from '../../../shared/constants';

export interface NotificationChannel {
  readonly key: string;
  send(payload: { to: string; title: string; body: string; type: NotificationType }): Promise<void>;
}

/** Development channel. Swap for SMTP/WhatsApp/SMS providers without touching callers. */
const consoleChannel: NotificationChannel = {
  key: 'console',
  async send(payload) {
    if (env.EMAIL_PROVIDER === 'none') return;
    logger.debug({ channel: 'console', ...payload }, 'notification dispatched');
  },
};

const channels: NotificationChannel[] = [consoleChannel];

export function registerChannel(channel: NotificationChannel) { channels.push(channel); }

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export const notificationService = {
  async create(input: CreateNotificationInput, db: Tx | typeof prisma = prisma) {
    const preference = await db.notificationPreference.findUnique({ where: { userId: input.userId } });
    const muted: string[] = preference?.mutedTypes ? JSON.parse(preference.mutedTypes) : [];
    if (muted.includes(input.type)) return null;

    const notification = await notificationRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    }, db);

    // Out-of-band channels are fire-and-forget; an email failure must not roll back points.
    if (preference?.email !== false) {
      void Promise.all(channels.map((c) => c.send({ to: input.userId, title: input.title, body: input.body, type: input.type })))
        .catch((error) => logger.warn({ error }, 'notification channel failed'));
    }
    return notification;
  },

  async createMany(inputs: CreateNotificationInput[], db: Tx | typeof prisma = prisma) {
    if (inputs.length === 0) return 0;
    const result = await notificationRepository.createMany(
      inputs.map((i) => ({
        userId: i.userId, type: i.type, title: i.title, body: i.body,
        link: i.link ?? null, metadata: i.metadata ? JSON.stringify(i.metadata) : null,
      })),
      db,
    );
    return result.count;
  },

  async list(userId: string, filters: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    const { items, total, page, pageSize, unread } = await notificationRepository.list(userId, filters);
    const result = paginate(items, total, page, pageSize);
    return { ...result, unread };
  },

  markRead: (id: string, userId: string) => notificationRepository.markRead(id, userId),
  markAllRead: (userId: string) => notificationRepository.markAllRead(userId),
  unreadCount: (userId: string) => notificationRepository.unreadCount(userId),
  preferences: (userId: string) => notificationRepository.preferences(userId),

  updatePreferences(userId: string, data: { inApp?: boolean; email?: boolean; whatsapp?: boolean; sms?: boolean; mutedTypes?: string[] }) {
    return notificationRepository.upsertPreferences(userId, {
      ...(data.inApp !== undefined ? { inApp: data.inApp } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.whatsapp !== undefined ? { whatsapp: data.whatsapp } : {}),
      ...(data.sms !== undefined ? { sms: data.sms } : {}),
      ...(data.mutedTypes ? { mutedTypes: JSON.stringify(data.mutedTypes) } : {}),
    });
  },
};
