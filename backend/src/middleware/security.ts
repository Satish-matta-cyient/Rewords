import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { env, isProd } from '../config/env';
import { AuthorizationError } from '../errors';

const allowedOrigins = new Set([env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new AuthorizationError('Origin not allowed by CORS policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-csrf-token'],
  exposedHeaders: ['x-request-id'],
});

export const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: isProd ? undefined : false,
});

/**
 * Double-submit CSRF check. Only enforced for cookie-authenticated mutations —
 * requests carrying an Authorization header are immune to CSRF by construction.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const usesCookieAuth = !req.headers.authorization && Boolean((req as never as { cookies?: Record<string, string> }).cookies?.accessToken);
  if (!isMutation || !usesCookieAuth) return next();

  const cookieToken = (req as never as { cookies: Record<string, string> }).cookies.csrfToken;
  const headerToken = req.headers['x-csrf-token'];
  if (cookieToken && headerToken && cookieToken === headerToken) return next();
  return next(new AuthorizationError('CSRF validation failed'));
};
