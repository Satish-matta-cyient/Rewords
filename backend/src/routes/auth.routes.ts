import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  verifyEmailSchema, changePasswordSchema,
} from '../validators';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/verify-email', validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));
router.post('/resend-verification', authenticate, authLimiter, asyncHandler(authController.resendVerification));
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(authController.changePassword));
router.get('/referral/:code', asyncHandler(authController.resolveReferral));

export default router;
