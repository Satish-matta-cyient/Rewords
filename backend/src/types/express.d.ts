import type { Role } from '../../../shared/constants';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: { userId: string; role: Role; email: string };
      validated?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
