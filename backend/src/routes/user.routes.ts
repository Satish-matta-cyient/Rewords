import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  userListQuerySchema, profileUpdateSchema, statusChangeSchema,
  manualAdjustmentSchema, roleChangeSchema, adminCreateSchema, reasonSchema,
} from '../validators';

const router = Router();
router.use(authenticate);

router.get('/me', asyncHandler(userController.myProfile));
router.patch('/me', validate(profileUpdateSchema), asyncHandler(userController.updateMyProfile));
router.post('/me/onboarding', asyncHandler(userController.advanceOnboarding));

router.get('/', requireMinRole('ADMIN'), validate(userListQuerySchema, 'query'), asyncHandler(userController.list));
router.get('/staff', requireMinRole('SUPER_ADMIN'), asyncHandler(userController.listStaff));
router.post('/staff', requireMinRole('SUPER_ADMIN'), validate(adminCreateSchema), asyncHandler(userController.createStaff));

router.get('/:id', requireMinRole('ADMIN'), asyncHandler(userController.detail));
router.patch('/:id/status', requireMinRole('ADMIN'), validate(statusChangeSchema), asyncHandler(userController.setStatus));
router.post('/:id/points', requireMinRole('ADMIN'), validate(manualAdjustmentSchema), asyncHandler(userController.adjustPoints));
router.patch('/:id/role', requireMinRole('SUPER_ADMIN'), validate(roleChangeSchema), asyncHandler(userController.changeRole));
router.delete('/:id', requireMinRole('SUPER_ADMIN'), validate(reasonSchema), asyncHandler(userController.remove));

export default router;
