import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '../errors';
import { logger } from '../config/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
}

function translatePrismaError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return new AppError(`A record with this ${target} already exists`, 409, 'CONFLICT', { target });
    }
    if (error.code === 'P2025') return new AppError('The requested record does not exist', 404, 'NOT_FOUND');
    if (error.code === 'P2003') return new AppError('Related record is missing or in use', 409, 'CONFLICT');
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const appError = err instanceof AppError ? err : translatePrismaError(err);

  if (appError) {
    if (appError.statusCode >= 500) logger.error({ err, requestId: req.id }, appError.message);
    return res.status(appError.statusCode).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
        requestId: req.id,
      },
    });
  }

  logger.error({ err, requestId: req.id }, 'unhandled error');
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. The team has been notified.',
      requestId: req.id,
      // Stack traces are never exposed in production.
      ...(isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
}
