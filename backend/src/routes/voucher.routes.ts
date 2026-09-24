import { Router } from 'express';
import { rewardController } from '../controllers/reward.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireMinRole('ADMIN'));

router.get('/', asyncHandler(rewardController.voucherOverview));
router.get('/:id', asyncHandler(rewardController.voucherInventory));
router.post('/:id/codes', requireMinRole('SUPER_ADMIN'), asyncHandler(rewardController.importVouchers));

export default router;
