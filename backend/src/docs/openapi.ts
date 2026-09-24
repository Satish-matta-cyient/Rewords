import { env } from '../config/env';

/**
 * Hand-maintained OpenAPI description of the public surface.
 * Served at /api/docs (Swagger UI) and /api/docs.json.
 */
const response = (schema: Record<string, unknown>) => ({
  content: { 'application/json': { schema } },
});

const envelope = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  properties: { success: { type: 'boolean' }, data: dataSchema, meta: { type: 'object' } },
});

const errorSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string' },
        details: { type: 'object' },
        requestId: { type: 'string' },
      },
    },
  },
};

const paginated = (item: Record<string, unknown>) => envelope({
  type: 'object',
  properties: {
    items: { type: 'array', items: item },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' },
        totalPages: { type: 'integer' }, hasNext: { type: 'boolean' }, hasPrev: { type: 'boolean' },
      },
    },
  },
});

const anyObject = { type: 'object', additionalProperties: true };

function op(tag: string, summary: string, opts: { auth?: boolean; body?: string; roles?: string } = {}) {
  return {
    tags: [tag],
    summary: opts.roles ? `${summary} (${opts.roles})` : summary,
    ...(opts.auth === false ? { security: [] } : {}),
    ...(opts.body ? { requestBody: { required: true, ...response({ $ref: `#/components/schemas/${opts.body}` }) } } : {}),
    responses: {
      200: { description: 'Success', ...response(envelope(anyObject)) },
      400: { description: 'Business rule violation', ...response(errorSchema) },
      401: { description: 'Authentication required', ...response(errorSchema) },
      403: { description: 'Insufficient permissions', ...response(errorSchema) },
      422: { description: 'Validation failed', ...response(errorSchema) },
    },
  };
}

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EduRewards API',
    version: env.APP_VERSION,
    description:
      'Ambassador Rewards & Referral Platform. All responses use a consistent envelope. '
      + 'Authenticate with `Authorization: Bearer <accessToken>` obtained from `/auth/login`.',
  },
  servers: [{ url: `${env.PUBLIC_BASE_URL}/api/v1` }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['fullName', 'email', 'phone', 'password', 'acceptedTerms'],
        properties: {
          fullName: { type: 'string' }, email: { type: 'string', format: 'email' },
          phone: { type: 'string' }, password: { type: 'string', minLength: 10 },
          referralCode: { type: 'string' }, acceptedTerms: { type: 'boolean' },
        },
      },
      LoginRequest: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      SubmissionRequest: {
        type: 'object', required: ['campaignId', 'platform', 'postUrl'],
        properties: {
          campaignId: { type: 'string', format: 'uuid' },
          platform: { type: 'string', enum: ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'YOUTUBE', 'TELEGRAM'] },
          postUrl: { type: 'string', format: 'uri' },
          caption: { type: 'string' }, notes: { type: 'string' },
        },
      },
      RedemptionRequest: {
        type: 'object', required: ['rewardId'],
        properties: { rewardId: { type: 'string', format: 'uuid' }, quantity: { type: 'integer', default: 1 } },
      },
      EconomicsRequest: {
        type: 'object',
        properties: {
          referralLevelPercentages: { type: 'array', items: { type: 'number' } },
          referralMaxDepth: { type: 'integer' }, referralSignupBonus: { type: 'integer' },
          campaignDefaultCredit: { type: 'integer' }, pointsToInr: { type: 'number' },
          minRedemptionPoints: { type: 'integer' }, dailySubmissionLimit: { type: 'integer' },
          pointsExpiryDays: { type: 'integer' }, monthlyEarnCap: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/auth/register': { post: op('Auth', 'Create an ambassador account', { auth: false, body: 'RegisterRequest' }) },
    '/auth/login': { post: op('Auth', 'Sign in', { auth: false, body: 'LoginRequest' }) },
    '/auth/refresh': { post: op('Auth', 'Rotate the refresh token', { auth: false }) },
    '/auth/logout': { post: op('Auth', 'Revoke the current session') },
    '/auth/me': { get: op('Auth', 'Current authenticated user') },
    '/auth/verify-email': { post: op('Auth', 'Verify an email address', { auth: false }) },
    '/auth/forgot-password': { post: op('Auth', 'Request a password reset link', { auth: false }) },
    '/auth/reset-password': { post: op('Auth', 'Complete a password reset', { auth: false }) },
    '/auth/referral/{code}': { get: op('Auth', 'Resolve a referral code', { auth: false }) },

    '/users': { get: { ...op('Users', 'List users', { roles: 'ADMIN+' }), responses: { 200: { description: 'OK', ...response(paginated(anyObject)) } } } },
    '/users/me': { get: op('Users', 'My full profile'), patch: op('Users', 'Update my profile') },
    '/users/{id}': { get: op('Users', 'User detail', { roles: 'ADMIN+' }) },
    '/users/{id}/status': { patch: op('Users', 'Activate or suspend a user', { roles: 'ADMIN+' }) },
    '/users/{id}/points': { post: op('Users', 'Manual point adjustment', { roles: 'ADMIN+' }) },
    '/users/{id}/role': { patch: op('Users', 'Change a role', { roles: 'SUPER_ADMIN' }) },
    '/users/staff': { get: op('Users', 'List staff', { roles: 'SUPER_ADMIN' }), post: op('Users', 'Create an admin', { roles: 'SUPER_ADMIN' }) },

    '/referrals/me': { get: op('Referrals', 'My referral code and level stats') },
    '/referrals/tree': { get: op('Referrals', 'My referral network tree') },
    '/referrals/{userId}': { get: op('Referrals', 'Subtree for a network member') },

    '/campaigns': { get: op('Campaigns', 'List campaigns'), post: op('Campaigns', 'Create a campaign', { roles: 'ADMIN+' }) },
    '/campaigns/{id}': { get: op('Campaigns', 'Campaign detail'), patch: op('Campaigns', 'Update a campaign', { roles: 'ADMIN+' }) },
    '/campaigns/{id}/status': { patch: op('Campaigns', 'Change campaign status', { roles: 'ADMIN+' }) },

    '/submissions': { post: op('Submissions', 'Submit a social post', { body: 'SubmissionRequest' }), get: op('Submissions', 'My submissions') },
    '/submissions/{id}': { get: op('Submissions', 'Submission detail') },

    '/verifications': { get: op('Verification', 'Review queue', { roles: 'ADMIN+' }) },
    '/verifications/stats': { get: op('Verification', 'Queue and SLA statistics', { roles: 'ADMIN+' }) },
    '/verifications/{id}/approve': { post: op('Verification', 'Approve and award points', { roles: 'ADMIN+' }) },
    '/verifications/{id}/reject': { post: op('Verification', 'Reject a submission', { roles: 'ADMIN+' }) },
    '/verifications/{id}/request-info': { post: op('Verification', 'Request more information', { roles: 'ADMIN+' }) },
    '/verifications/{id}/reverse': { post: op('Verification', 'Reverse an approved submission', { roles: 'SUPER_ADMIN' }) },
    '/verifications/bulk/approve': { post: op('Verification', 'Bulk approve', { roles: 'ADMIN+' }) },

    '/wallet': { get: op('Wallet', 'Wallet balances') },
    '/wallet/ledger': { get: op('Wallet', 'Points ledger') },
    '/wallet/trend': { get: op('Wallet', 'Daily earn/redeem series') },

    '/rewards': { get: op('Rewards', 'Reward catalogue'), post: op('Rewards', 'Create a reward', { roles: 'ADMIN+' }) },
    '/rewards/{id}': { get: op('Rewards', 'Reward detail') },
    '/redemptions': { post: op('Redemptions', 'Redeem a reward', { body: 'RedemptionRequest' }), get: op('Redemptions', 'My redemptions') },
    '/redemptions/{id}/approve': { post: op('Redemptions', 'Approve and assign a voucher', { roles: 'ADMIN+' }) },
    '/redemptions/{id}/voucher': { post: op('Redemptions', 'Reveal my voucher code') },
    '/vouchers': { get: op('Vouchers', 'Inventory overview', { roles: 'ADMIN+' }) },
    '/vouchers/{id}/codes': { post: op('Vouchers', 'Import voucher codes', { roles: 'SUPER_ADMIN' }) },

    '/payouts/profile': { get: op('Payouts', 'Masked payout profile'), put: op('Payouts', 'Save payout details') },
    '/payouts/kyc': { post: op('Payouts', 'Submit KYC document') },
    '/payouts/requests': { post: op('Payouts', 'Request a cash payout'), get: op('Payouts', 'My payout requests') },

    '/notifications': { get: op('Notifications', 'My notifications') },
    '/notifications/{id}/read': { patch: op('Notifications', 'Mark as read') },
    '/notifications/read-all': { patch: op('Notifications', 'Mark all as read') },

    '/analytics/dashboard': { get: op('Analytics', 'Ambassador dashboard') },
    '/analytics/admin': { get: op('Analytics', 'Admin dashboard', { roles: 'ADMIN+' }) },
    '/analytics/super-admin': { get: op('Analytics', 'Platform and liability dashboard', { roles: 'SUPER_ADMIN' }) },

    '/audit': { get: op('Audit', 'Immutable audit log', { roles: 'SUPER_ADMIN' }) },
    '/risk': { get: op('Risk', 'Risk flag queue', { roles: 'ADMIN+' }) },
    '/risk/{id}/resolve': { post: op('Risk', 'Dismiss or action a flag', { roles: 'ADMIN+' }) },
    '/gamification/profile': { get: op('Gamification', 'Tier, badges and streak') },
    '/gamification/leaderboard': { get: op('Gamification', 'Leaderboard') },
    '/support': { post: op('Support', 'Raise a ticket'), get: op('Support', 'My tickets') },
    '/support/inbox': { get: op('Support', 'Ticket inbox', { roles: 'ADMIN+' }) },
    '/settings/economics': {
      get: op('Settings', 'Current economics'),
      patch: op('Settings', 'Update economics', { roles: 'SUPER_ADMIN', body: 'EconomicsRequest' }),
    },
    '/reports': { get: op('Reports', 'Available reports', { roles: 'ADMIN+' }) },
    '/reports/{key}/export': { get: op('Reports', 'Export a report as CSV', { roles: 'ADMIN+' }) },
    '/institutions': { get: op('Institutions', 'List institutions', { roles: 'ADMIN+' }) },
  },
};
