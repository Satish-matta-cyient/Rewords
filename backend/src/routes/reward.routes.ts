import { Router } from 'express';
import { rewardController } from '../controllers/reward.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { rewardQuerySchema, rewardSchema } from '../validators';

const router = Router();
router.use(authenticate);

router.get('/', validate(rewardQuerySchema, 'query'), asyncHandler(rewardController.list));
router.get('/categories', asyncHandler(rewardController.categories));
router.get('/:id', asyncHandler(rewardController.detail));

router.post('/', requireMinRole('ADMIN'), validate(rewardSchema), asyncHandler(rewardController.create));
router.patch('/:id', requireMinRole('ADMIN'), asyncHandler(rewardController.update));
router.delete('/:id', requireMinRole('SUPER_ADMIN'), asyncHandler(rewardController.archive));

export default router;
