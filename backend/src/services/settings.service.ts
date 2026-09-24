import { settingsRepository } from '../repositories/settings.repository';
import { SETTING_KEYS } from '../../../shared/constants';
import type { Tx } from '../config/prisma';
import { prisma } from '../config/prisma';

export interface Economics {
  referralLevelPercentages: number[];
  referralMaxDepth: number;
  referralSignupBonus: number;
  campaignDefaultCredit: number;
  pointsToInr: number;
  pointsExpiryDays: number;
  minRedemptionPoints: number;
  dailySubmissionLimit: number;
  monthlyEarnCap: number;
  payoutMinAmount: number;
  payoutTdsPercent: number;
  livenessFailureThreshold: number;
  voucherLowStockThreshold: number;
}

const DEFAULTS: Economics = {
  referralLevelPercentages: [20, 10, 5, 2.5],
  referralMaxDepth: 4,
  referralSignupBonus: 1000,
  campaignDefaultCredit: 500,
  pointsToInr: 0.1,
  pointsExpiryDays: 365,
  minRedemptionPoints: 1000,
  dailySubmissionLimit: 5,
  monthlyEarnCap: 100_000,
  payoutMinAmount: 500,
  payoutTdsPercent: 0,
  livenessFailureThreshold: 3,
  voucherLowStockThreshold: 5,
};

const KEY_MAP: Record<keyof Economics, string> = {
  referralLevelPercentages: SETTING_KEYS.REFERRAL_LEVEL_PERCENTAGES,
  referralMaxDepth: SETTING_KEYS.REFERRAL_MAX_DEPTH,
  referralSignupBonus: SETTING_KEYS.REFERRAL_SIGNUP_BONUS,
  campaignDefaultCredit: SETTING_KEYS.CAMPAIGN_DEFAULT_CREDIT,
  pointsToInr: SETTING_KEYS.POINTS_TO_INR,
  pointsExpiryDays: SETTING_KEYS.POINTS_EXPIRY_DAYS,
  minRedemptionPoints: SETTING_KEYS.MIN_REDEMPTION_POINTS,
  dailySubmissionLimit: SETTING_KEYS.DAILY_SUBMISSION_LIMIT,
  monthlyEarnCap: SETTING_KEYS.PER_USER_MONTHLY_EARN_CAP,
  payoutMinAmount: SETTING_KEYS.PAYOUT_MIN_AMOUNT,
  payoutTdsPercent: SETTING_KEYS.PAYOUT_TDS_PERCENT,
  livenessFailureThreshold: SETTING_KEYS.LIVENESS_FAILURE_THRESHOLD,
  voucherLowStockThreshold: SETTING_KEYS.VOUCHER_LOW_STOCK_THRESHOLD,
};

const LABELS: Record<string, { label: string; group: string; valueType: string }> = {
  [SETTING_KEYS.REFERRAL_LEVEL_PERCENTAGES]: { label: 'Referral level percentages', group: 'ECONOMICS', valueType: 'JSON' },
  [SETTING_KEYS.REFERRAL_MAX_DEPTH]: { label: 'Maximum referral depth', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.REFERRAL_SIGNUP_BONUS]: { label: 'Referral signup bonus', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.CAMPAIGN_DEFAULT_CREDIT]: { label: 'Default campaign credit', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.POINTS_TO_INR]: { label: 'Points to INR conversion', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.POINTS_EXPIRY_DAYS]: { label: 'Points expiry (days)', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.MIN_REDEMPTION_POINTS]: { label: 'Minimum redemption points', group: 'ECONOMICS', valueType: 'NUMBER' },
  [SETTING_KEYS.DAILY_SUBMISSION_LIMIT]: { label: 'Daily submission limit', group: 'LIMITS', valueType: 'NUMBER' },
  [SETTING_KEYS.PER_USER_MONTHLY_EARN_CAP]: { label: 'Monthly earning cap per user', group: 'LIMITS', valueType: 'NUMBER' },
  [SETTING_KEYS.PAYOUT_MIN_AMOUNT]: { label: 'Minimum payout amount (INR)', group: 'PAYOUTS', valueType: 'NUMBER' },
  [SETTING_KEYS.PAYOUT_TDS_PERCENT]: { label: 'TDS percentage', group: 'PAYOUTS', valueType: 'NUMBER' },
  [SETTING_KEYS.LIVENESS_FAILURE_THRESHOLD]: { label: 'Liveness failures before reversal', group: 'RISK', valueType: 'NUMBER' },
  [SETTING_KEYS.VOUCHER_LOW_STOCK_THRESHOLD]: { label: 'Voucher low-stock threshold', group: 'INVENTORY', valueType: 'NUMBER' },
};

// Economics are read on nearly every point operation, so they are cached briefly.
// The TTL is short enough that a Super Admin change takes effect almost immediately.
const CACHE_TTL_MS = 15_000;
let cache: { value: Economics; expiresAt: number } | null = null;

function parseValue(raw: string, fallback: unknown): unknown {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export const settingsService = {
  async getEconomics(db: Tx | typeof prisma = prisma, skipCache = false): Promise<Economics> {
    if (!skipCache && cache && cache.expiresAt > Date.now()) return cache.value;

    const rows = await db.appSetting.findMany({ where: { key: { in: Object.values(KEY_MAP) } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const economics = Object.entries(KEY_MAP).reduce((acc, [field, key]) => {
      const raw = byKey.get(key);
      const fallback = DEFAULTS[field as keyof Economics];
      (acc as unknown as Record<string, unknown>)[field] = raw === undefined ? fallback : parseValue(raw, fallback);
      return acc;
    }, {} as Economics);

    cache = { value: economics, expiresAt: Date.now() + CACHE_TTL_MS };
    return economics;
  },

  invalidate() { cache = null; },

  async updateEconomics(patch: Partial<Economics>, updatedById: string) {
    const before = await settingsService.getEconomics(prisma, true);
    for (const [field, value] of Object.entries(patch)) {
      const key = KEY_MAP[field as keyof Economics];
      if (!key) continue;
      const meta = LABELS[key];
      await settingsRepository.upsert(key, JSON.stringify(value), { ...meta, updatedById });
    }
    settingsService.invalidate();
    const after = await settingsService.getEconomics(prisma, true);
    return { before, after };
  },

  async listAll() { return settingsRepository.all(); },

  async setGeneral(key: string, value: unknown, updatedById: string) {
    const meta = LABELS[key] ?? { label: key, group: 'GENERAL', valueType: 'JSON' };
    const result = await settingsRepository.upsert(key, JSON.stringify(value), { ...meta, updatedById });
    settingsService.invalidate();
    return result;
  },

  flags: () => settingsRepository.flags(),
  setFlag: (key: string, enabled: boolean) => settingsRepository.setFlag(key, enabled),

  pointsToInr(points: number, economics: Economics): number {
    return Number((points * economics.pointsToInr).toFixed(2));
  },
};
