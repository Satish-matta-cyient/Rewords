import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import walletRoutes from './wallet.routes';
import referralRoutes from './referral.routes';
import campaignRoutes from './campaign.routes';
import submissionRoutes from './submission.routes';
import verificationRoutes from './verification.routes';
import rewardRoutes from './reward.routes';
import redemptionRoutes from './redemption.routes';
import voucherRoutes from './voucher.routes';
import {
  analyticsRouter, notificationRouter, auditRouter, riskRouter, gamificationRouter,
  supportRouter, settingsRouter, reportRouter, payoutRouter, announcementRouter, institutionRouter,
} from './misc.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/profiles', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/points', walletRoutes);
router.use('/referrals', referralRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/submissions', submissionRoutes);
router.use('/verifications', verificationRoutes);
router.use('/rewards', rewardRoutes);
router.use('/redemptions', redemptionRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/payouts', payoutRouter);
router.use('/kyc', payoutRouter);
router.use('/notifications', notificationRouter);
router.use('/analytics', analyticsRouter);
router.use('/audit', auditRouter);
router.use('/risk', riskRouter);
router.use('/gamification', gamificationRouter);
router.use('/support', supportRouter);
router.use('/settings', settingsRouter);
router.use('/reports', reportRouter);
router.use('/announcements', announcementRouter);
router.use('/institutions', institutionRouter);

export default router;
