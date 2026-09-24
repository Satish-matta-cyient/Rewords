import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from '../errors';

type Source = 'body' | 'query' | 'params';

function formatIssues(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((acc, issue) => {
    acc[issue.path.join('.') || '_'] = issue.message;
    return acc;
  }, {});
}

/**
 * Parses and REPLACES the request payload with the validated/coerced result,
 * so downstream code can never accidentally read the raw client input.
 */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new ValidationError('The request could not be processed', formatIssues(result.error)));
    }
    req.validated = { ...(req.validated ?? {}), [source]: result.data };
    if (source === 'body') req.body = result.data;
    return next();
  };
}

export function validated<T>(req: Request, source: Source = 'body'): T {
  return (req.validated?.[source] ?? req[source]) as T;
}
