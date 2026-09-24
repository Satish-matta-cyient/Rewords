import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

export function requestContext(req: Request, res: Response, next: NextFunction) {
  req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const payload = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: req.auth?.userId,
    };
    if (res.statusCode >= 500) logger.error(payload, 'request failed');
    else if (res.statusCode >= 400) logger.warn(payload, 'request rejected');
    else logger.info(payload, 'request completed');
  });

  next();
}
