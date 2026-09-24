import { Router } from 'express';
import { submissionController } from '../controllers/submission.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  submissionQuerySchema, submissionDecisionSchema, submissionRejectSchema,
  bulkDecisionSchema, reasonSchema,
} from '../validators';

const router = Router();
router.use(authenticate, requireMinRole('ADMIN'));

router.get('/', validate(submissionQuerySchema, 'query'), asyncHandler(submissionController.queue));
router.get('/stats', asyncHandler(submissionController.queueStats));
router.post('/bulk/approve', validate(bulkDecisionSchema), asyncHandler(submissionController.bulkApprove));
router.post('/bulk/reject', validate(bulkDecisionSchema), asyncHandler(submissionController.bulkReject));

router.get('/:id', asyncHandler(submissionController.detail));
router.post('/:id/claim', asyncHandler(submissionController.claim));
router.post('/:id/approve', validate(submissionDecisionSchema), asyncHandler(submissionController.approve));
router.post('/:id/reject', validate(submissionRejectSchema), asyncHandler(submissionController.reject));
router.post('/:id/request-info', validate(reasonSchema), asyncHandler(submissionController.requestInfo));
router.post('/:id/reverse', requireMinRole('SUPER_ADMIN'), validate(reasonSchema), asyncHandler(submissionController.reverse));

export default router;
