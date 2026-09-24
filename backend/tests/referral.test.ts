import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase, registerUser, activateAndLogin } from './helpers';
import { prisma } from '../src/config/prisma';
import { referralService } from '../src/services/referral.service';

async function makeUser(referralCode?: string) {
  const { response, body } = await registerUser(referralCode ? { referralCode } : {});
  const session = await activateAndLogin(body.email);
  return { id: session.user.id, code: response.body.data.referralCode as string, email: body.email };
}

describe('Referral engine', () => {
  beforeEach(resetDatabase);

  it('builds a four-level closure table with correct depths', async () => {
    const a = await makeUser();
    const b = await makeUser(a.code);
    const c = await makeUser(b.code);
    const d = await makeUser(c.code);
    const e = await makeUser(d.code);

    const ancestors = await prisma.referralClosure.findMany({
      where: { descendantId: e.id, depth: { gt: 0 } },
      orderBy: { depth: 'asc' },
    });

    expect(ancestors.map((row) => row.ancestorId)).toEqual([d.id, c.id, b.id, a.id]);
    expect(ancestors.map((row) => row.depth)).toEqual([1, 2, 3, 4]);
  });

  it('prevents self-referral', async () => {
    const a = await makeUser();
    await expect(
      prisma.$transaction((tx) => referralService.attach(a.id, a.code, tx)),
    ).rejects.toThrow(/cannot refer yourself/i);
  });

  it('prevents circular referrals', async () => {
    const a = await makeUser();
    const b = await makeUser(a.code);

    // A is already an ancestor of B, so attaching A beneath B would close a loop.
    await prisma.referralRelation.deleteMany({ where: { childId: a.id } });
    await expect(
      prisma.$transaction((tx) => referralService.attach(a.id, b.code, tx)),
    ).rejects.toThrow(/circular/i);
  });

  it('treats a parent as immutable once set', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const c = await makeUser(a.code);

    await expect(
      prisma.$transaction((tx) => referralService.attach(c.id, b.code, tx)),
    ).rejects.toThrow(/already linked/i);
  });

  it('rejects an unknown referral code', async () => {
    const a = await makeUser();
    await expect(
      prisma.$transaction((tx) => referralService.attach(a.id, 'NOPE99', tx)),
    ).rejects.toThrow(/does not exist/i);
  });

  it('awards the signup bonus exactly once', async () => {
    const a = await makeUser();
    const b = await makeUser(a.code);

    // Attempt a duplicate award for the same source.
    await prisma.$transaction((tx) => referralService.awardSignupBonus(b.id, a.id, tx));

    const entries = await prisma.pointsLedger.findMany({
      where: { userId: a.id, transactionType: 'REFERRAL_BONUS', sourceId: b.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].points).toBe(1000);
  });

  it('preserves the tree but pauses earnings when a member is suspended', async () => {
    const a = await makeUser();
    const b = await makeUser(a.code);

    await referralService.pauseEarnings(b.id, true);

    const relation = await prisma.referralRelation.findUniqueOrThrow({ where: { childId: b.id } });
    expect(relation.parentId).toBe(a.id);
    expect(relation.earningsPaused).toBe(true);
  });
});
