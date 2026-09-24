import type { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { notificationService } from '../services/notification.service';
import { auditService } from '../services/audit.service';
import { riskService } from '../services/risk.service';
import { gamificationService } from '../services/gamification.service';
import { supportService } from '../services/support.service';
import { settingsService } from '../services/settings.service';
import { reportService } from '../services/report.service';
import { payoutService } from '../services/payout.service';
import { announcementService } from '../services/announcement.service';
import { institutionService } from '../services/institution.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import { publicUrlFor } from '../middleware/upload';
import { monthKey } from '../utils/date';

function ctx(req: Request) {
  return { actorId: req.auth?.userId, actorRole: req.auth?.role, ip: req.ip, userAgent: req.get('user-agent') ?? null };
}
function dateRange(req: Request) {
  return {
    from: req.query.from ? new Date(String(req.query.from)) : undefined,
    to: req.query.to ? new Date(String(req.query.to)) : undefined,
  };
}

export const analyticsController = {
  user: async (req: Request, res: Response) => ok(res, await analyticsService.userDashboard(req.auth!.userId)),
  admin: async (req: Request, res: Response) => ok(res, await analyticsService.adminDashboard(dateRange(req))),
  superAdmin: async (req: Request, res: Response) => ok(res, await analyticsService.superAdminDashboard(dateRange(req))),
  referrals: async (req: Request, res: Response) => ok(res, await analyticsService.referralAnalytics(req.auth!.userId)),
  campaigns: async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    return ok(res, await analyticsService.campaignRoi(from ?? new Date(Date.now() - 30 * 86400000), to ?? new Date()));
  },
  points: async (req: Request, res: Response) => {
    const { from, to } = dateRange(req);
    return ok(res, await analyticsService.pointsSeries(from ?? new Date(Date.now() - 30 * 86400000), to ?? new Date()));
  },
};

export const notificationController = {
  list: async (req: Request, res: Response) => ok(res, await notificationService.list(req.auth!.userId, {
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 25,
    unreadOnly: req.query.unreadOnly === 'true',
  })),
  unreadCount: async (req: Request, res: Response) => ok(res, { count: await notificationService.unreadCount(req.auth!.userId) }),
  markRead: async (req: Request, res: Response) => ok(res, await notificationService.markRead(req.params.id, req.auth!.userId)),
  markAllRead: async (req: Request, res: Response) => ok(res, await notificationService.markAllRead(req.auth!.userId)),
  preferences: async (req: Request, res: Response) => ok(res, await notificationService.preferences(req.auth!.userId)),
  updatePreferences: async (req: Request, res: Response) => ok(res, await notificationService.updatePreferences(req.auth!.userId, req.body)),
};

export const auditController = {
  list: async (req: Request, res: Response) => ok(res, await auditService.list({ ...validated(req, 'query'), ...dateRange(req) })),
  actions: async (_req: Request, res: Response) => ok(res, await auditService.actions()),
};

export const riskController = {
  list: async (req: Request, res: Response) => ok(res, await riskService.list(validated(req, 'query'))),
  detail: async (req: Request, res: Response) => ok(res, await riskService.detail(req.params.id)),
  resolve: async (req: Request, res: Response) => {
    const { decision, note } = req.body as { decision: 'DISMISSED' | 'ACTIONED'; note: string };
    return ok(res, await riskService.resolve(req.params.id, decision, note, ctx(req)));
  },
};

export const gamificationController = {
  profile: async (req: Request, res: Response) => ok(res, await gamificationService.profile(req.auth!.userId)),
  leaderboard: async (req: Request, res: Response) => ok(res, await gamificationService.leaderboard(
    (req.query.scope as 'POINTS' | 'NETWORK' | 'APPROVED_POSTS') ?? 'POINTS',
    (req.query.period as string) ?? monthKey(),
    req.auth!.userId,
  )),
};

export const supportController = {
  create: async (req: Request, res: Response) => created(res, await supportService.create(req.auth!.userId, validated(req), ctx(req))),
  mine: async (req: Request, res: Response) => ok(res, await supportService.list({ ...validated(req, 'query'), userId: req.auth!.userId })),
  inbox: async (req: Request, res: Response) => ok(res, await supportService.list(validated(req, 'query'))),
  detail: async (req: Request, res: Response) => ok(res, await supportService.detail(req.params.id, { userId: req.auth!.userId, role: req.auth!.role })),
  reply: async (req: Request, res: Response) => created(res, await supportService.reply(req.params.id, req.auth!.userId, validated(req), req.auth!.role, ctx(req))),
  update: async (req: Request, res: Response) => ok(res, await supportService.update(req.params.id, req.body, ctx(req))),
};

export const settingsController = {
  economics: async (_req: Request, res: Response) => ok(res, await settingsService.getEconomics()),
  updateEconomics: async (req: Request, res: Response) => {
    const patch = validated<Record<string, unknown>>(req);
    const result = await settingsService.updateEconomics(patch, req.auth!.userId);
    await auditService.record({ ...ctx(req), action: 'settings.economics_changed', entityType: 'AppSetting', before: result.before, after: result.after });
    return ok(res, result.after);
  },
  all: async (_req: Request, res: Response) => ok(res, await settingsService.listAll()),
  setGeneral: async (req: Request, res: Response) => {
    const { key, value } = req.body as { key: string; value: unknown };
    const result = await settingsService.setGeneral(key, value, req.auth!.userId);
    await auditService.record({ ...ctx(req), action: 'settings.updated', entityType: 'AppSetting', entityId: key, after: { key, value } });
    return ok(res, result);
  },
  flags: async (_req: Request, res: Response) => ok(res, await settingsService.flags()),
  setFlag: async (req: Request, res: Response) => {
    const { key, enabled } = req.body as { key: string; enabled: boolean };
    await auditService.record({ ...ctx(req), action: 'settings.flag_changed', entityType: 'FeatureFlag', entityId: key, after: { enabled } });
    return ok(res, await settingsService.setFlag(key, enabled));
  },
};

export const reportController = {
  catalogue: async (_req: Request, res: Response) => ok(res, reportService.catalogue()),
  run: async (req: Request, res: Response) => ok(res, await reportService.run(req.params.key, dateRange(req))),
  export: async (req: Request, res: Response) => {
    const { filename, content } = await reportService.toCsv(req.params.key, dateRange(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(content);
  },
};

export const payoutController = {
  profile: async (req: Request, res: Response) => ok(res, await payoutService.maskedProfile(req.auth!.userId)),
  saveProfile: async (req: Request, res: Response) => ok(res, await payoutService.saveProfile(req.auth!.userId, validated(req), ctx(req))),
  submitKyc: async (req: Request, res: Response) => {
    const file = req.file as Express.Multer.File;
    return created(res, await payoutService.submitKyc(req.auth!.userId, {
      documentType: (req.body.documentType as string) ?? 'PAN',
      documentUrl: publicUrlFor('kyc', file.filename),
    }, ctx(req)));
  },
  request: async (req: Request, res: Response) => {
    const { points } = validated<{ points: number }>(req);
    return created(res, await payoutService.requestPayout(req.auth!.userId, points, ctx(req)));
  },
  myRequests: async (req: Request, res: Response) => ok(res, await payoutService.listRequests({ userId: req.auth!.userId })),
  adminList: async (req: Request, res: Response) => ok(res, await payoutService.listRequests({ status: req.query.status as string })),
  decide: async (req: Request, res: Response) => {
    const { decision, reason } = req.body as { decision: 'APPROVED' | 'REJECTED'; reason?: string };
    return ok(res, await payoutService.decide(req.params.id, decision, req.auth!.userId, reason, ctx(req)));
  },
  markProcessed: async (req: Request, res: Response) => {
    const { utrNumber } = req.body as { utrNumber: string };
    return ok(res, await payoutService.markProcessed(req.params.id, utrNumber, ctx(req)));
  },
  kycQueue: async (req: Request, res: Response) => ok(res, await payoutService.listKyc(req.query.status as string)),
  reviewKyc: async (req: Request, res: Response) => {
    const { decision, reason } = req.body as { decision: 'VERIFIED' | 'REJECTED'; reason?: string };
    return ok(res, await payoutService.reviewKyc(req.params.id, decision, req.auth!.userId, reason, ctx(req)));
  },
};

export const announcementController = {
  list: async (_req: Request, res: Response) => ok(res, await announcementService.list()),
  active: async (_req: Request, res: Response) => ok(res, await announcementService.active()),
  create: async (req: Request, res: Response) => created(res, await announcementService.create(validated(req), ctx(req))),
};

export const institutionController = {
  list: async (_req: Request, res: Response) => ok(res, await institutionService.list()),
  detail: async (req: Request, res: Response) => ok(res, await institutionService.detail(req.params.id)),
  create: async (req: Request, res: Response) => created(res, await institutionService.create(req.body, ctx(req))),
  assign: async (req: Request, res: Response) => ok(res, await institutionService.assignUser(req.params.id, req.body.userId, ctx(req))),
};
