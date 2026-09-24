import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, requireMinRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { creativeUpload } from '../middleware/upload';
import { campaignQuerySchema, campaignCreateSchema, campaignUpdateSchema, campaignStatusSchema } from '../validators';

const router = Router();
router.use(authenticate);

router.get('/', validate(campaignQuerySchema, 'query'), asyncHandler(campaignController.list));
router.get('/:id', asyncHandler(campaignController.detail));
router.post('/:id/creatives/:creativeId/download', asyncHandler(campaignController.downloadCreative));

router.post('/', requireMinRole('ADMIN'), validate(campaignCreateSchema), asyncHandler(campaignController.create));
router.patch('/:id', requireMinRole('ADMIN'), validate(campaignUpdateSchema), asyncHandler(campaignController.update));
router.patch('/:id/status', requireMinRole('ADMIN'), validate(campaignStatusSchema), asyncHandler(campaignController.changeStatus));
router.post('/:id/creatives', requireMinRole('ADMIN'), creativeUpload.single('file'), asyncHandler(campaignController.uploadCreative));

export default router;
