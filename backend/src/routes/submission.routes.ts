import { Router } from 'express';
import { submissionController } from '../controllers/submission.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireVerifiedEmail } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { screenshotUpload } from '../middleware/upload';
import { writeLimiter } from '../middleware/rateLimit';
import { submissionQuerySchema, submissionCreateSchema } from '../validators';

const router = Router();
router.use(authenticate);

router.post(
  '/',
  writeLimiter,
  requireVerifiedEmail(),
  screenshotUpload.single('screenshot'),
  validate(submissionCreateSchema),
  asyncHandler(submissionController.create),
);
router.get('/', validate(submissionQuerySchema, 'query'), asyncHandler(submissionController.mine));
router.get('/:id', asyncHandler(submissionController.detail));

export default router;
