import { auditRepository, type AuditFilters } from '../repositories/audit.repository';
import { prisma, type Tx } from '../config/prisma';
import { paginate } from '../utils/pagination';
import { logger } from '../config/logger';

export interface AuditContext {
  actorId?: string | null;
  actorRole?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditInput extends AuditContext {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/** Fields that must never be persisted into an audit snapshot. */
const SENSITIVE = new Set([
  'passwordHash', 'password', 'tokenHash', 'token', 'refreshToken',
  'accountNumber', 'panNumber', 'upiId', 'documentUrl',
]);

function sanitise(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitise);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.has(k) ? '[redacted]' : sanitise(v)]),
    );
  }
  return value;
}

function encode(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try { return JSON.stringify(sanitise(value)); } catch { return undefined; }
}

export const auditService = {
  /** Audit writes participate in the caller's transaction when one is supplied. */
  async record(input: AuditInput, db: Tx | typeof prisma = prisma) {
    try {
      return await auditRepository.create({
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        beforeJson: encode(input.before) ?? null,
        afterJson: encode(input.after) ?? null,
        metadata: encode(input.metadata) ?? null,
      }, db);
    } catch (error) {
      // Auditing must never break the primary operation, but the failure is loud.
      logger.error({ error, action: input.action }, 'failed to write audit log');
      return null;
    }
  },

  async list(filters: AuditFilters) {
    const { items, total, page, pageSize } = await auditRepository.list(filters);
    return paginate(
      items.map((row) => ({
        id: row.id,
        actor: row.actor ? { id: row.actor.id, name: row.actor.fullName, email: row.actor.email } : null,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        ip: row.ip,
        before: row.beforeJson ? JSON.parse(row.beforeJson) : null,
        after: row.afterJson ? JSON.parse(row.afterJson) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        createdAt: row.createdAt,
      })),
      total, page, pageSize,
    );
  },

  actions: () => auditRepository.distinctActions().then((rows) => rows.map((r) => r.action)),
};
