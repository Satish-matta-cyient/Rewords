import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/config/prisma';
import { createApp } from '../src/app';

export const app: Express = createApp();

const TABLES = [
  'PostReview', 'PostMedia', 'PostSubmission', 'RedemptionItem', 'VoucherCode', 'Redemption',
  'Reward', 'RewardCategory', 'PointsReversal', 'PointsAdjustment', 'PointsDistribution',
  'PointsLedger', 'Wallet', 'ReferralClosure', 'ReferralRelation', 'ReferralCode',
  'CampaignRule', 'CampaignPlatform', 'Campaign', 'AuditLog', 'RiskEvent', 'RiskFlag',
  'Notification', 'NotificationPreference', 'TermsAcceptance', 'AuthToken', 'RefreshToken',
  'Profile', 'AppSetting', 'User',
];

export async function resetDatabase() {
  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`).catch(() => undefined);
  }
  await seedEconomics();
}

export async function seedEconomics() {
  const values: [string, string][] = [
    ['referral.levelPercentages', '[20,10,5,2.5]'],
    ['referral.maxDepth', '4'],
    ['referral.signupBonus', '1000'],
    ['points.inrConversion', '0.1'],
    ['points.expiryDays', '365'],
    ['redemption.minimumPoints', '100'],
    ['submission.dailyLimit', '5'],
    ['points.monthlyEarnCap', '1000000'],
  ];
  for (const [key, value] of values) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, label: key, group: 'ECONOMICS', valueType: 'JSON' },
      update: { value },
    });
  }
}

export const PASSWORD = 'TestPassword123';

export async function registerUser(overrides: Partial<{ fullName: string; email: string; phone: string; referralCode: string }> = {}) {
  const unique = Math.random().toString(36).slice(2, 8);
  const body = {
    fullName: overrides.fullName ?? `Test User ${unique}`,
    email: overrides.email ?? `user_${unique}@test.local`,
    phone: overrides.phone ?? `+9199${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
    password: PASSWORD,
    acceptedTerms: true,
    termsVersion: 'v1',
    ...(overrides.referralCode ? { referralCode: overrides.referralCode } : {}),
  };
  const response = await request(app).post('/api/v1/auth/register').send(body);
  return { response, body };
}

export async function activateAndLogin(email: string) {
  await prisma.user.update({ where: { email }, data: { status: 'ACTIVE', emailVerifiedAt: new Date() } });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { token: login.body.data.accessToken as string, user: login.body.data.user };
}

export async function createStaff(role: 'ADMIN' | 'SUPER_ADMIN') {
  const unique = Math.random().toString(36).slice(2, 8);
  const email = `${role.toLowerCase()}_${unique}@test.local`;
  const { hashPassword } = await import('../src/utils/password');
  const user = await prisma.user.create({
    data: {
      fullName: `${role} ${unique}`, email, phone: `+9188${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      passwordHash: await hashPassword(PASSWORD), primaryRole: role, status: 'ACTIVE',
      emailVerifiedAt: new Date(), wallet: { create: {} }, profile: { create: {} },
    },
  });
  await prisma.referralClosure.create({ data: { ancestorId: user.id, descendantId: user.id, depth: 0 } });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { user, token: login.body.data.accessToken as string };
}

export async function createCampaign(overrides: Partial<{ creditValue: number; budgetPoints: number | null; perUserLimit: number }> = {}) {
  const unique = Math.random().toString(36).slice(2, 8);
  return prisma.campaign.create({
    data: {
      name: `Campaign ${unique}`, slug: `campaign-${unique}`,
      description: 'A test campaign for automated verification of the points engine.',
      category: 'TEST',
      creditValue: overrides.creditValue ?? 1000,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 30 * 86_400_000),
      status: 'ACTIVE',
      budgetPoints: overrides.budgetPoints === undefined ? null : overrides.budgetPoints,
      perUserLimit: overrides.perUserLimit ?? 3,
      platforms: { create: [{ platform: 'INSTAGRAM' }] },
    },
  });
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function uniqueUrl() {
  return `https://www.instagram.com/p/${Math.random().toString(36).slice(2, 12)}`;
}
