import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetDatabase, registerUser, activateAndLogin, createStaff, auth } from './helpers';
import { prisma } from '../src/config/prisma';
import { pointsService } from '../src/services/points.service';

async function fundedUser(points: number) {
  const { body } = await registerUser();
  const session = await activateAndLogin(body.email);
  await prisma.$transaction((tx) => pointsService.award({
    userId: session.user.id, points, transactionType: 'MANUAL_CREDIT',
    sourceType: 'ADMIN', sourceId: `seed-${session.user.id}`, description: 'Test balance',
  }, tx));
  return session;
}

async function makeReward(pointsCost: number, codeCount: number) {
  const category = await prisma.rewardCategory.upsert({
    where: { key: 'SHOPPING' }, create: { key: 'SHOPPING', name: 'Shopping' }, update: {},
  });
  const reward = await prisma.reward.create({
    data: {
      title: 'Test Voucher', description: 'A voucher used in automated tests.',
      categoryId: category.id, pointsCost, cashValue: pointsCost * 0.1,
      stock: codeCount, deliveryType: 'VOUCHER_CODE',
    },
  });
  if (codeCount > 0) {
    await prisma.voucherCode.createMany({
      data: Array.from({ length: codeCount }, (_, i) => ({ rewardId: reward.id, code: `TEST-CODE-${i}` })),
    });
  }
  return reward;
}

describe('Redemption workflow', () => {
  beforeEach(resetDatabase);

  it('locks points on request and debits them on approval', async () => {
    const user = await fundedUser(5000);
    const admin = await createStaff('ADMIN');
    const reward = await makeReward(2000, 3);

    const created = await request(app).post('/api/v1/redemptions').set(auth(user.token)).send({ rewardId: reward.id });
    expect(created.status).toBe(201);

    const locked = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(locked.availablePoints).toBe(3000);
    expect(locked.lockedPoints).toBe(2000);

    const approved = await request(app).post(`/api/v1/redemptions/${created.body.data.id}/approve`).set(auth(admin.token));
    expect(approved.status).toBe(200);

    const settled = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(settled.availablePoints).toBe(3000);
    expect(settled.lockedPoints).toBe(0);
    expect(settled.redeemedPoints).toBe(2000);
  });

  it('refuses to redeem more points than are available', async () => {
    const user = await fundedUser(1000);
    const reward = await makeReward(5000, 3);

    const response = await request(app).post('/api/v1/redemptions').set(auth(user.token)).send({ rewardId: reward.id });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/enough available points/i);
  });

  it('returns locked points in full when a redemption is rejected', async () => {
    const user = await fundedUser(5000);
    const admin = await createStaff('ADMIN');
    const reward = await makeReward(2000, 3);

    const created = await request(app).post('/api/v1/redemptions').set(auth(user.token)).send({ rewardId: reward.id });
    await request(app).post(`/api/v1/redemptions/${created.body.data.id}/reject`).set(auth(admin.token))
      .send({ reason: 'Account under review' });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } });
    expect(wallet.availablePoints).toBe(5000);
    expect(wallet.lockedPoints).toBe(0);
  });

  it('never assigns the same voucher code twice', async () => {
    const admin = await createStaff('ADMIN');
    const reward = await makeReward(1000, 2);

    const userA = await fundedUser(5000);
    const userB = await fundedUser(5000);
    const userC = await fundedUser(5000);

    const redemptions = [];
    for (const user of [userA, userB, userC]) {
      const created = await request(app).post('/api/v1/redemptions').set(auth(user.token)).send({ rewardId: reward.id });
      redemptions.push(created.body.data.id as string);
    }

    const results = [];
    for (const id of redemptions) {
      results.push(await request(app).post(`/api/v1/redemptions/${id}/approve`).set(auth(admin.token)));
    }

    // Only two codes exist, so the third approval must fail cleanly.
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.status === 400)).toHaveLength(1);

    const assigned = await prisma.voucherCode.findMany({ where: { rewardId: reward.id, status: { not: 'UNUSED' } } });
    expect(assigned).toHaveLength(2);
    expect(new Set(assigned.map((v) => v.redemptionId)).size).toBe(2);
  });

  it('only reveals a voucher code to its owner', async () => {
    const user = await fundedUser(5000);
    const other = await fundedUser(5000);
    const admin = await createStaff('ADMIN');
    const reward = await makeReward(1000, 2);

    const created = await request(app).post('/api/v1/redemptions').set(auth(user.token)).send({ rewardId: reward.id });
    await request(app).post(`/api/v1/redemptions/${created.body.data.id}/approve`).set(auth(admin.token));

    const owner = await request(app).post(`/api/v1/redemptions/${created.body.data.id}/voucher`).set(auth(user.token));
    const stranger = await request(app).post(`/api/v1/redemptions/${created.body.data.id}/voucher`).set(auth(other.token));

    expect(owner.status).toBe(200);
    expect(owner.body.data.code).toMatch(/^TEST-CODE-/);
    expect(stranger.status).toBe(404);
  });
});

describe('End-to-end business journey', () => {
  beforeEach(resetDatabase);

  it('runs signup → referral → submission → approval → points → redemption → voucher', async () => {
    // 1. User A registers and gets a referral code.
    const regA = await registerUser();
    const a = await activateAndLogin(regA.body.email);
    const codeA = regA.response.body.data.referralCode as string;

    // 2. User B registers using A's code.
    const regB = await registerUser({ referralCode: codeA });
    const b = await activateAndLogin(regB.body.email);

    // 3. The referral tree is created.
    const relation = await prisma.referralRelation.findUniqueOrThrow({ where: { childId: b.user.id } });
    expect(relation.parentId).toBe(a.user.id);

    // 4. B submits a post; an admin approves it.
    const admin = await createStaff('ADMIN');
    const campaign = await prisma.campaign.create({
      data: {
        name: 'Journey Campaign', slug: 'journey-campaign',
        description: 'End-to-end verification of the complete business flow.',
        creditValue: 5000, startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 86_400_000), status: 'ACTIVE', perUserLimit: 1,
        platforms: { create: [{ platform: 'INSTAGRAM' }] },
      },
    });

    const submission = await request(app).post('/api/v1/submissions').set(auth(b.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: 'https://www.instagram.com/p/journey123' });

    const approval = await request(app).post(`/api/v1/verifications/${submission.body.data.id}/approve`)
      .set(auth(admin.token)).send({});
    expect(approval.status).toBe(200);

    // 5. B receives points and A receives the level-1 bonus.
    const walletB = await prisma.wallet.findUniqueOrThrow({ where: { userId: b.user.id } });
    const walletA = await prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } });
    expect(walletB.availablePoints).toBe(5000);
    expect(walletA.availablePoints).toBe(1000 + 1000); // signup bonus + 20% of 5,000

    // 6. Every movement is in the ledger and the wallet reconciles with it.
    const ledger = await prisma.pointsLedger.findMany({ where: { userId: b.user.id } });
    expect(ledger.reduce((sum, row) => sum + row.points, 0)).toBe(walletB.availablePoints);

    // 7. B redeems a reward.
    const reward = await makeReward(4000, 1);
    const redemption = await request(app).post('/api/v1/redemptions').set(auth(b.token)).send({ rewardId: reward.id });
    expect(redemption.status).toBe(201);

    // 8. Admin approves; a voucher is assigned and cannot be reused.
    await request(app).post(`/api/v1/redemptions/${redemption.body.data.id}/approve`).set(auth(admin.token));
    const voucher = await prisma.voucherCode.findFirstOrThrow({ where: { rewardId: reward.id } });
    expect(voucher.redemptionId).toBe(redemption.body.data.id);
    expect(await prisma.voucherCode.count({ where: { rewardId: reward.id, status: 'UNUSED' } })).toBe(0);

    // 9. The user is notified and the whole operation is audited.
    const notifications = await prisma.notification.count({ where: { userId: b.user.id } });
    expect(notifications).toBeGreaterThan(0);
    const audits = await prisma.auditLog.count({ where: { action: { in: ['submission.approved', 'redemption.approved'] } } });
    expect(audits).toBeGreaterThanOrEqual(2);
  });
});
