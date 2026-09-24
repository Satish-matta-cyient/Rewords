import { Router } from 'express';
import { rewardController } from '../controllers/reward.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole, requireVerifiedEmail } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/rateLimit';
import { redemptionQuerySchema, redemptionCreateSchema, reasonSchema } from '../validators';

const router = Router();
router.use(authenticate);

router.post('/', writeLimiter, requireVerifiedEmail(), validate(redemptionCreateSchema), asyncHandler(rewardController.createRedemption));
router.get('/', validate(redemptionQuerySchema, 'query'), asyncHandler(rewardController.myRedemptions));
router.get('/admin', requireMinRole('ADMIN'), validate(redemptionQuerySchema, 'query'), asyncHandler(rewardController.adminRedemptions));
router.get('/:id', asyncHandler(rewardController.redemptionDetail));
router.post('/:id/voucher', asyncHandler(rewardController.revealVoucher));

router.post('/:id/approve', requireMinRole('ADMIN'), asyncHandler(rewardController.approveRedemption));
router.post('/:id/reject', requireMinRole('ADMIN'), validate(reasonSchema), asyncHandler(rewardController.rejectRedemption));
router.post('/:id/fulfil', requireMinRole('ADMIN'), asyncHandler(rewardController.fulfilRedemption));

export default router;
