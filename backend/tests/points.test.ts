import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app, resetDatabase, registerUser, activateAndLogin, createStaff,
  createCampaign, auth, uniqueUrl,
} from './helpers';
import { prisma } from '../src/config/prisma';
import { pointsService } from '../src/services/points.service';

async function makeChain() {
  const rootReg = await registerUser();
  const root = await activateAndLogin(rootReg.body.email);
  const rootCode = rootReg.response.body.data.referralCode as string;

  const childReg = await registerUser({ referralCode: rootCode });
  const child = await activateAndLogin(childReg.body.email);

  return { root, child };
}

describe('Points engine', () => {
  beforeEach(resetDatabase);

  it('awards points and distributes the referral ladder on approval', async () => {
    const { root, child } = await makeChain();
    const admin = await createStaff('ADMIN');
    const campaign = await createCampaign({ creditValue: 1000 });

    const submission = await request(app)
      .post('/api/v1/submissions')
      .set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });
    expect(submission.status).toBe(201);

    const approval = await request(app)
      .post(`/api/v1/verifications/${submission.body.data.id}/approve`)
      .set(auth(admin.token))
      .send({});

    expect(approval.status).toBe(200);
    expect(approval.body.data.pointsAwarded).toBe(1000);
    // Level 1 pays 20% of the base credit.
    expect(approval.body.data.networkPointsDistributed).toBe(200);

    const childWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: child.user.id } });
    const rootWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: root.user.id } });

    expect(childWallet.availablePoints).toBe(1000);
    // Root already holds the 1,000-point signup bonus plus the 200-point level bonus.
    expect(rootWallet.availablePoints).toBe(1200);
  });

  it('never double-credits the same submission', async () => {
    const { child } = await makeChain();
    const admin = await createStaff('ADMIN');
    const campaign = await createCampaign({ creditValue: 500 });

    const submission = await request(app)
      .post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });

    await request(app).post(`/api/v1/verifications/${submission.body.data.id}/approve`).set(auth(admin.token)).send({});
    const second = await request(app).post(`/api/v1/verifications/${submission.body.data.id}/approve`).set(auth(admin.token)).send({});

    // The second attempt is refused by the state machine, not silently applied.
    expect(second.status).toBe(400);

    const entries = await prisma.pointsLedger.findMany({
      where: { userId: child.user.id, transactionType: 'POST_REWARD', sourceId: submission.body.data.id },
    });
    expect(entries).toHaveLength(1);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: child.user.id } });
    expect(wallet.availablePoints).toBe(500);
  });

  it('suppresses a duplicate award at the ledger level', async () => {
    const { child } = await makeChain();

    const first = await prisma.$transaction((tx) => pointsService.award({
      userId: child.user.id, points: 300, transactionType: 'MANUAL_CREDIT',
      sourceType: 'ADMIN', sourceId: 'fixed-source', description: 'Test credit',
    }, tx));
    const second = await prisma.$transaction((tx) => pointsService.award({
      userId: child.user.id, points: 300, transactionType: 'MANUAL_CREDIT',
      sourceType: 'ADMIN', sourceId: 'fixed-source', description: 'Test credit',
    }, tx));

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: child.user.id } });
    expect(wallet.availablePoints).toBe(300);
  });

  it('refuses to drive any wallet bucket negative', async () => {
    const { child } = await makeChain();
    await expect(
      prisma.$transaction((tx) => pointsService.award({
        userId: child.user.id, points: -100, transactionType: 'MANUAL_DEBIT',
        sourceType: 'ADMIN', sourceId: 'overdraw', description: 'Overdraw attempt',
      }, tx)),
    ).rejects.toThrow(/negative/i);
  });

  it('reverses the original award and every downstream referral bonus', async () => {
    const { root, child } = await makeChain();
    const admin = await createStaff('ADMIN');
    const superAdmin = await createStaff('SUPER_ADMIN');
    const campaign = await createCampaign({ creditValue: 1000 });

    const submission = await request(app)
      .post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });

    await request(app).post(`/api/v1/verifications/${submission.body.data.id}/approve`).set(auth(admin.token)).send({});

    const reversal = await request(app)
      .post(`/api/v1/verifications/${submission.body.data.id}/reverse`)
      .set(auth(superAdmin.token))
      .send({ reason: 'Post was deleted by the ambassador' });

    expect(reversal.status).toBe(200);

    const childWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: child.user.id } });
    const rootWallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: root.user.id } });

    expect(childWallet.availablePoints).toBe(0);
    // Only the signup bonus remains; the level bonus was compensated.
    expect(rootWallet.availablePoints).toBe(1000);

    // History is preserved — the original rows still exist alongside the reversals.
    const original = await prisma.pointsLedger.findMany({ where: { sourceId: submission.body.data.id, transactionType: { not: 'REVERSAL' } } });
    expect(original.length).toBeGreaterThan(0);
  });

  it('blocks approval that would exceed the campaign budget', async () => {
    const { child } = await makeChain();
    const admin = await createStaff('ADMIN');
    const campaign = await createCampaign({ creditValue: 1000, budgetPoints: 500 });

    const submission = await request(app)
      .post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });

    // The submission itself is blocked because the budget cannot cover it.
    expect(submission.status).toBe(400);
    expect(submission.body.error.message).toMatch(/budget/i);
  });
});

describe('Submission validation', () => {
  beforeEach(resetDatabase);

  it('rejects a duplicate post URL across different ambassadors', async () => {
    const { root, child } = await makeChain();
    const campaign = await createCampaign();
    const url = uniqueUrl();

    const first = await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: url });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/submissions').set(auth(root.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: url });

    expect(second.status).toBe(409);

    // The reuse is recorded as a fraud signal, not just a validation failure.
    const flags = await prisma.riskFlag.findMany({ where: { userId: root.user.id, type: 'DUPLICATE_URL' } });
    expect(flags.length).toBeGreaterThan(0);
  });

  it('treats tracking-parameter variants of a URL as the same post', async () => {
    const { child } = await makeChain();
    const campaign = await createCampaign();
    const base = uniqueUrl();

    await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: base });

    const duplicate = await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: `${base}/?utm_source=whatsapp&igshid=abc123` });

    expect(duplicate.status).toBe(409);
  });

  it('enforces the per-campaign submission limit', async () => {
    const { child } = await makeChain();
    const campaign = await createCampaign({ perUserLimit: 1 });

    await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });

    const second = await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'INSTAGRAM', postUrl: uniqueUrl() });

    expect(second.status).toBe(400);
    expect(second.body.error.message).toMatch(/limit/i);
  });

  it('rejects a platform the campaign does not accept', async () => {
    const { child } = await makeChain();
    const campaign = await createCampaign();

    const response = await request(app).post('/api/v1/submissions').set(auth(child.token))
      .send({ campaignId: campaign.id, platform: 'LINKEDIN', postUrl: 'https://www.linkedin.com/posts/abc123' });

    expect(response.status).toBe(400);
  });
});
