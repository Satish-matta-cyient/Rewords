export type ErrorCode =
  | 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND' | 'CONFLICT' | 'BUSINESS_RULE_ERROR' | 'RATE_LIMIT'
  | 'EXTERNAL_SERVICE_ERROR' | 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = statusCode < 500;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details?: unknown) { super(message, 422, 'VALIDATION_ERROR', details); }
}
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) { super(message, 401, 'AUTHENTICATION_ERROR', details); }
}
export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action') { super(message, 403, 'AUTHORIZATION_ERROR'); }
}
export class NotFoundError extends AppError {
  constructor(entity = 'Resource') { super(`${entity} not found`, 404, 'NOT_FOUND'); }
}
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details?: unknown) { super(message, 409, 'CONFLICT', details); }
}
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) { super(message, 400, 'BUSINESS_RULE_ERROR', details); }
}
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again shortly.') { super(message, 429, 'RATE_LIMIT'); }
}
export class ExternalServiceError extends AppError {
  constructor(message = 'An upstream service failed', details?: unknown) { super(message, 502, 'EXTERNAL_SERVICE_ERROR', details); }
}
