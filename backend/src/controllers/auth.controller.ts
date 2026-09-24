import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { referralService } from '../services/referral.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import { env, isProd } from '../config/env';
import { AuthenticationError } from '../errors';

function auditCtx(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') ?? null };
}

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProd,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 86_400_000,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export const authController = {
  async register(req: Request, res: Response) {
    const body = validated<{ fullName: string; email: string; phone: string; password: string; referralCode?: string; termsVersion: string }>(req);
    const result = await authService.register(
      { ...body, referralCode: body.referralCode || undefined },
      { ...auditCtx(req), fingerprint: req.get('x-device-fingerprint') ?? undefined },
    );
    return created(res, result);
  },

  async login(req: Request, res: Response) {
    const { email, password } = validated<{ email: string; password: string }>(req);
    const result = await authService.login(email, password, auditCtx(req));
    setRefreshCookie(res, result.refreshToken);
    return ok(res, { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn });
  },

  async refresh(req: Request, res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
    if (!token) throw new AuthenticationError('No session to refresh');
    const result = await authService.refresh(token, auditCtx(req));
    setRefreshCookie(res, result.refreshToken);
    return ok(res, { accessToken: result.accessToken, expiresIn: result.expiresIn });
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.cookies?.[REFRESH_COOKIE], req.auth?.userId);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return ok(res, { loggedOut: true });
  },

  async me(req: Request, res: Response) {
    return ok(res, await authService.me(req.auth!.userId));
  },

  async verifyEmail(req: Request, res: Response) {
    const { token } = validated<{ token: string }>(req);
    return ok(res, await authService.verifyEmail(token, auditCtx(req)));
  },

  async resendVerification(req: Request, res: Response) {
    return ok(res, await authService.resendVerification(req.auth!.userId));
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = validated<{ email: string }>(req);
    return ok(res, await authService.forgotPassword(email));
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = validated<{ token: string; password: string }>(req);
    return ok(res, await authService.resetPassword(token, password, auditCtx(req)));
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, password } = req.body as { currentPassword: string; password: string };
    return ok(res, await authService.changePassword(req.auth!.userId, currentPassword, password, auditCtx(req)));
  },

  /** Public endpoint used by the signup page to preview who invited you. */
  async resolveReferral(req: Request, res: Response) {
    const code = String(req.params.code);
    const record = await referralService.resolveCode(code);
    await referralService.trackClick(code);
    return ok(res, { code: record.code, referrerName: record.user.fullName.split(' ')[0], valid: true });
  },
};
