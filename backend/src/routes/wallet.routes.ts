import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ledgerQuerySchema } from '../validators';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(userController.wallet));
router.get('/ledger', validate(ledgerQuerySchema, 'query'), asyncHandler(userController.ledger));
router.get('/trend', asyncHandler(userController.walletTrend));

export default router;
