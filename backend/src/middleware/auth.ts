import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { AuthenticationError, AuthorizationError } from '../errors';
import { prisma } from '../config/prisma';
import { ROLE_RANK, type Role } from '../../../shared/constants';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.accessToken;
  return cookie ?? null;
}

/** Verifies the access token and confirms the account is still usable. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw new AuthenticationError('You must be signed in to continue');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AuthenticationError('Your session has expired. Please sign in again.');
    }

    // Role and status are re-read from the database on every request: a token
    // minted before a demotion or suspension must never keep working.
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, primaryRole: true, status: true },
    });
    if (!user) throw new AuthenticationError('Account no longer exists');
    if (user.status === 'SUSPENDED') throw new AuthorizationError('This account is suspended. Contact support.');
    if (user.status === 'DEACTIVATED') throw new AuthenticationError('This account has been deactivated');

    req.auth = { userId: user.id, role: user.primaryRole as Role, email: user.email };
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Requires the caller to hold at least the given role. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());
    if (!roles.includes(req.auth.role)) return next(new AuthorizationError());
    return next();
  };
}

/** Requires the caller to be at or above a role in the hierarchy. */
export function requireMinRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());
    if (ROLE_RANK[req.auth.role] < ROLE_RANK[role]) return next(new AuthorizationError());
    return next();
  };
}

/** Allows access when the caller owns the resource or is staff. */
export function requireSelfOrStaff(paramName = 'userId') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());
    const isStaff = ROLE_RANK[req.auth.role] >= ROLE_RANK.ADMIN;
    if (isStaff || req.params[paramName] === req.auth.userId) return next();
    return next(new AuthorizationError());
  };
}

export function requireVerifiedEmail() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) return next(new AuthorizationError('Verify your email address to continue'));
    return next();
  };
}
