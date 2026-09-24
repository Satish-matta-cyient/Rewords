import { Router } from 'express';
import {
  analyticsController, notificationController, auditController, riskController,
  gamificationController, supportController, settingsController, reportController,
  payoutController, announcementController, institutionController,
} from '../controllers/misc.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { kycUpload } from '../middleware/upload';
import {
  auditQuerySchema, riskQuerySchema, riskResolveSchema, ticketQuerySchema,
  ticketCreateSchema, ticketReplySchema, ticketUpdateSchema, economicsSchema,
  payoutProfileSchema, payoutRequestSchema, payoutDecisionSchema, kycDecisionSchema,
  announcementSchema,
} from '../validators';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get('/dashboard', asyncHandler(analyticsController.user));
analyticsRouter.get('/user', asyncHandler(analyticsController.user));
analyticsRouter.get('/referrals', asyncHandler(analyticsController.referrals));
analyticsRouter.get('/admin', requireMinRole('ADMIN'), asyncHandler(analyticsController.admin));
analyticsRouter.get('/super-admin', requireMinRole('SUPER_ADMIN'), asyncHandler(analyticsController.superAdmin));
analyticsRouter.get('/campaigns', requireMinRole('ADMIN'), asyncHandler(analyticsController.campaigns));
analyticsRouter.get('/points', requireMinRole('ADMIN'), asyncHandler(analyticsController.points));

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', asyncHandler(notificationController.list));
notificationRouter.get('/unread-count', asyncHandler(notificationController.unreadCount));
notificationRouter.get('/preferences', asyncHandler(notificationController.preferences));
notificationRouter.patch('/preferences', asyncHandler(notificationController.updatePreferences));
notificationRouter.patch('/read-all', asyncHandler(notificationController.markAllRead));
notificationRouter.patch('/:id/read', asyncHandler(notificationController.markRead));

export const auditRouter = Router();
auditRouter.use(authenticate, requireMinRole('SUPER_ADMIN'));
auditRouter.get('/', validate(auditQuerySchema, 'query'), asyncHandler(auditController.list));
auditRouter.get('/actions', asyncHandler(auditController.actions));

export const riskRouter = Router();
riskRouter.use(authenticate, requireMinRole('ADMIN'));
riskRouter.get('/', validate(riskQuerySchema, 'query'), asyncHandler(riskController.list));
riskRouter.get('/:id', asyncHandler(riskController.detail));
riskRouter.post('/:id/resolve', validate(riskResolveSchema), asyncHandler(riskController.resolve));

export const gamificationRouter = Router();
gamificationRouter.use(authenticate);
gamificationRouter.get('/profile', asyncHandler(gamificationController.profile));
gamificationRouter.get('/leaderboard', asyncHandler(gamificationController.leaderboard));

export const supportRouter = Router();
supportRouter.use(authenticate);
supportRouter.post('/', validate(ticketCreateSchema), asyncHandler(supportController.create));
supportRouter.get('/', validate(ticketQuerySchema, 'query'), asyncHandler(supportController.mine));
supportRouter.get('/inbox', requireMinRole('ADMIN'), validate(ticketQuerySchema, 'query'), asyncHandler(supportController.inbox));
supportRouter.get('/:id', asyncHandler(supportController.detail));
supportRouter.post('/:id/reply', validate(ticketReplySchema), asyncHandler(supportController.reply));
supportRouter.patch('/:id', requireMinRole('ADMIN'), validate(ticketUpdateSchema), asyncHandler(supportController.update));

export const settingsRouter = Router();
settingsRouter.use(authenticate);
settingsRouter.get('/economics', asyncHandler(settingsController.economics));
settingsRouter.patch('/economics', requireMinRole('SUPER_ADMIN'), validate(economicsSchema), asyncHandler(settingsController.updateEconomics));
settingsRouter.get('/', requireMinRole('SUPER_ADMIN'), asyncHandler(settingsController.all));
settingsRouter.patch('/', requireMinRole('SUPER_ADMIN'), asyncHandler(settingsController.setGeneral));
settingsRouter.get('/flags', requireMinRole('ADMIN'), asyncHandler(settingsController.flags));
settingsRouter.patch('/flags', requireMinRole('SUPER_ADMIN'), asyncHandler(settingsController.setFlag));

export const reportRouter = Router();
reportRouter.use(authenticate, requireMinRole('ADMIN'));
reportRouter.get('/', asyncHandler(reportController.catalogue));
reportRouter.get('/:key', asyncHandler(reportController.run));
reportRouter.get('/:key/export', asyncHandler(reportController.export));

export const payoutRouter = Router();
payoutRouter.use(authenticate);
payoutRouter.get('/profile', asyncHandler(payoutController.profile));
payoutRouter.put('/profile', validate(payoutProfileSchema), asyncHandler(payoutController.saveProfile));
payoutRouter.post('/kyc', kycUpload.single('document'), asyncHandler(payoutController.submitKyc));
payoutRouter.post('/requests', validate(payoutRequestSchema), asyncHandler(payoutController.request));
payoutRouter.get('/requests', asyncHandler(payoutController.myRequests));
payoutRouter.get('/admin/requests', requireMinRole('ADMIN'), asyncHandler(payoutController.adminList));
payoutRouter.post('/admin/requests/:id/decide', requireMinRole('ADMIN'), validate(payoutDecisionSchema), asyncHandler(payoutController.decide));
payoutRouter.post('/admin/requests/:id/processed', requireMinRole('ADMIN'), asyncHandler(payoutController.markProcessed));
payoutRouter.get('/admin/kyc', requireMinRole('ADMIN'), asyncHandler(payoutController.kycQueue));
payoutRouter.post('/admin/kyc/:id/review', requireMinRole('ADMIN'), validate(kycDecisionSchema), asyncHandler(payoutController.reviewKyc));

export const announcementRouter = Router();
announcementRouter.use(authenticate);
announcementRouter.get('/active', asyncHandler(announcementController.active));
announcementRouter.get('/', requireMinRole('ADMIN'), asyncHandler(announcementController.list));
announcementRouter.post('/', requireMinRole('ADMIN'), validate(announcementSchema), asyncHandler(announcementController.create));

export const institutionRouter = Router();
institutionRouter.use(authenticate, requireMinRole('ADMIN'));
institutionRouter.get('/', asyncHandler(institutionController.list));
institutionRouter.get('/:id', asyncHandler(institutionController.detail));
institutionRouter.post('/', requireMinRole('SUPER_ADMIN'), asyncHandler(institutionController.create));
institutionRouter.post('/:id/users', requireMinRole('SUPER_ADMIN'), asyncHandler(institutionController.assign));
