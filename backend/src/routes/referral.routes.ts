import { Router } from 'express';
import { referralController } from '../controllers/referral.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/me', asyncHandler(referralController.me));
router.get('/tree', asyncHandler(referralController.tree));
router.get('/analytics', asyncHandler(referralController.analytics));
router.get('/:userId', asyncHandler(referralController.treeFor));

export default router;
