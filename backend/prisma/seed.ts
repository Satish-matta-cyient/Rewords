/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

// Demo passwords come from the environment so no real secret is ever committed.
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'EduRewards#2026';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code(len = 6) {
  return Array.from({ length: len }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
}
function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000); }
function daysAhead(n: number) { return new Date(Date.now() + n * 86_400_000); }
function pick<T>(arr: T[]): T { return arr[crypto.randomInt(arr.length)]; }
function ref(prefix: string) { return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }

const FIRST = ['Aarav', 'Diya', 'Vihaan', 'Ananya', 'Arjun', 'Ishita', 'Reyansh', 'Saanvi', 'Kabir', 'Myra', 'Aditya', 'Nisha', 'Rohan', 'Tara', 'Karthik', 'Meera', 'Dev', 'Priya', 'Sameer', 'Kavya', 'Nikhil', 'Riya', 'Varun', 'Sneha', 'Aryan'];
const LAST = ['Sharma', 'Reddy', 'Iyer', 'Patel', 'Nair', 'Gupta', 'Rao', 'Mehta', 'Kulkarni', 'Banerjee', 'Chopra', 'Desai'];

const ECONOMICS = [
  ['referral.levelPercentages', '[20,10,5,2.5]', 'JSON', 'ECONOMICS', 'Referral level percentages'],
  ['referral.maxDepth', '4', 'NUMBER', 'ECONOMICS', 'Maximum referral depth'],
  ['referral.signupBonus', '1000', 'NUMBER', 'ECONOMICS', 'Referral signup bonus'],
  ['campaign.defaultCredit', '500', 'NUMBER', 'ECONOMICS', 'Default campaign credit'],
  ['points.inrConversion', '0.1', 'NUMBER', 'ECONOMICS', 'Points to INR conversion'],
  ['points.expiryDays', '365', 'NUMBER', 'ECONOMICS', 'Points expiry (days)'],
  ['redemption.minimumPoints', '1000', 'NUMBER', 'ECONOMICS', 'Minimum redemption points'],
  ['submission.dailyLimit', '5', 'NUMBER', 'LIMITS', 'Daily submission limit'],
  ['points.monthlyEarnCap', '100000', 'NUMBER', 'LIMITS', 'Monthly earning cap per user'],
  ['payout.minimumAmount', '500', 'NUMBER', 'PAYOUTS', 'Minimum payout amount (INR)'],
  ['payout.tdsPercent', '0', 'NUMBER', 'PAYOUTS', 'TDS percentage'],
  ['liveness.failureThreshold', '3', 'NUMBER', 'RISK', 'Liveness failures before reversal'],
  ['voucher.lowStockThreshold', '5', 'NUMBER', 'INVENTORY', 'Voucher low-stock threshold'],
];

const LEVEL_PERCENTAGES = [20, 10, 5, 2.5];
const SIGNUP_BONUS = 1000;

async function reset() {
  // Order matters: children before parents.
  const tables = [
    'SupportAttachment', 'SupportMessage', 'SupportTicket', 'ReviewNote', 'PostReview', 'PostMedia',
    'PostSubmission', 'RedemptionItem', 'VoucherCode', 'Redemption', 'Reward', 'RewardCategory',
    'PointsReversal', 'PointsAdjustment', 'PointsDistribution', 'PointsLedger', 'Wallet',
    'PayoutRequest', 'KycRecord', 'PayoutProfile', 'RiskEvent', 'RiskFlag', 'LeaderboardEntry',
    'UserBadge', 'Badge', 'UserTier', 'Tier', 'Streak', 'Notification', 'NotificationPreference',
    'AuditLog', 'Announcement', 'ScheduledReport', 'CampaignRule', 'CampaignCreative', 'CampaignPlatform',
    'Campaign', 'ReferralClosure', 'ReferralRelation', 'ReferralCode', 'TermsAcceptance', 'AuthToken',
    'RefreshToken', 'UserRole', 'RolePermission', 'Permission', 'Role', 'Profile',
    'InstitutionAdmin', 'InstitutionUser', 'User', 'Institution', 'AppSetting', 'FeatureFlag',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`).catch(() => undefined);
  }
}

/** Ledger + wallet write that mirrors PointsService, used to build consistent history. */
async function credit(userId: string, params: {
  points: number; type: string; sourceType: string; sourceId: string;
  description: string; level?: number; originUserId?: string; createdAt: Date;
}) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  const next = wallet.availablePoints + params.points;
  if (next < 0) return null;

  await prisma.wallet.update({
    where: { userId },
    data: {
      availablePoints: next,
      lifetimeEarned: wallet.lifetimeEarned + Math.max(0, params.points),
      version: { increment: 1 },
    },
  });

  return prisma.pointsLedger.create({
    data: {
      userId, transactionType: params.type, points: params.points, balanceAfter: next,
      level: params.level ?? null, sourceType: params.sourceType, sourceId: params.sourceId,
      originUserId: params.originUserId ?? null, description: params.description,
      createdAt: params.createdAt, expiresAt: params.points > 0 ? daysAhead(365) : null,
    },
  });
}

async function distribute(originUserId: string, basePoints: number, sourceId: string, description: string, createdAt: Date) {
  const ancestors = await prisma.referralClosure.findMany({
    where: { descendantId: originUserId, depth: { gt: 0, lte: 4 } },
    orderBy: { depth: 'asc' },
    include: { ancestor: { select: { status: true } } },
  });
  let total = 0;
  for (const row of ancestors) {
    const percent = LEVEL_PERCENTAGES[row.depth - 1];
    if (!percent || row.ancestor.status !== 'ACTIVE') continue;
    const points = Math.floor((basePoints * percent) / 100);
    if (points <= 0) continue;
    await credit(row.ancestorId, {
      points, type: 'LEVEL_BONUS', sourceType: 'SUBMISSION', sourceId,
      description: `${description} · Level ${row.depth} (${percent}%)`,
      level: row.depth, originUserId, createdAt,
    });
    total += points;
  }
  return total;
}

async function main() {
  console.log('Resetting database…');
  await reset();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  console.log('Seeding settings, roles, tiers and badges…');
  for (const [key, value, valueType, group, label] of ECONOMICS) {
    await prisma.appSetting.create({ data: { key, value, valueType, group, label } });
  }
  await prisma.featureFlag.createMany({
    data: [
      { key: 'cash_payouts', enabled: true, description: 'Allow ambassadors to convert points to cash' },
      { key: 'public_leaderboard', enabled: true, description: 'Show the public leaderboard' },
      { key: 'liveness_checks', enabled: true, description: 'Periodically re-check approved posts' },
    ],
  });

  for (const r of [
    { key: 'USER', name: 'Ambassador', description: 'Promotes campaigns and builds a referral network' },
    { key: 'ADMIN', name: 'Administrator', description: 'Verifies posts and manages day-to-day operations' },
    { key: 'SUPER_ADMIN', name: 'Super Administrator', description: 'Owns platform configuration and economics' },
  ]) await prisma.role.create({ data: r });

  const tiers = await Promise.all([
    prisma.tier.create({ data: { key: 'BRONZE', name: 'Bronze', minPoints: 0, minReferrals: 0, multiplier: 1, sortOrder: 1 } }),
    prisma.tier.create({ data: { key: 'SILVER', name: 'Silver', minPoints: 10_000, minReferrals: 3, multiplier: 1.05, sortOrder: 2 } }),
    prisma.tier.create({ data: { key: 'GOLD', name: 'Gold', minPoints: 30_000, minReferrals: 10, multiplier: 1.1, sortOrder: 3 } }),
    prisma.tier.create({ data: { key: 'PLATINUM', name: 'Platinum', minPoints: 75_000, minReferrals: 25, multiplier: 1.2, sortOrder: 4 } }),
  ]);

  await prisma.badge.createMany({
    data: [
      { key: 'FIRST_REFERRAL', name: 'First Referral', description: 'Brought your first ambassador on board', criteria: JSON.stringify({ metric: 'referrals', gte: 1 }) },
      { key: 'NETWORK_BUILDER', name: 'Network Builder', description: 'Ten direct referrals', criteria: JSON.stringify({ metric: 'referrals', gte: 10 }) },
      { key: 'CONTENT_STAR', name: 'Content Star', description: 'Ten approved posts', criteria: JSON.stringify({ metric: 'approved', gte: 10 }) },
      { key: 'POINT_MILLIONAIRE', name: 'Fifty Thousand Club', description: 'Earned 50,000 lifetime points', criteria: JSON.stringify({ metric: 'lifetimeEarned', gte: 50_000 }) },
    ],
  });

  const institutions = await Promise.all([
    prisma.institution.create({ data: { name: 'Osmania University', slug: 'osmania-university', type: 'COLLEGE', city: 'Hyderabad', state: 'Telangana' } }),
    prisma.institution.create({ data: { name: 'VIT Vellore', slug: 'vit-vellore', type: 'COLLEGE', city: 'Vellore', state: 'Tamil Nadu' } }),
  ]);

  console.log('Creating staff accounts…');
  async function createUser(input: {
    fullName: string; email: string; phone: string; role: string; status?: string;
    institutionId?: string; createdAt?: Date;
  }) {
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName, email: input.email, phone: input.phone, passwordHash,
        primaryRole: input.role, status: input.status ?? 'ACTIVE', emailVerifiedAt: new Date(),
        institutionId: input.institutionId ?? null,
        createdAt: input.createdAt ?? new Date(),
        lastLoginAt: daysAgo(crypto.randomInt(0, 10)),
        profile: { create: { onboardingStep: 3, onboardedAt: new Date(), college: input.institutionId ? 'Osmania University' : null, city: 'Hyderabad', state: 'Telangana' } },
        notificationPref: { create: {} },
        wallet: { create: {} },
      },
    });
    await prisma.referralClosure.create({ data: { ancestorId: user.id, descendantId: user.id, depth: 0 } });
    await prisma.referralCode.create({ data: { userId: user.id, code: code() } });
    await prisma.streak.create({ data: { userId: user.id, currentDays: crypto.randomInt(1, 12), longestDays: crypto.randomInt(5, 30), lastActiveOn: new Date() } });
    return user;
  }

  const superAdmin = await createUser({ fullName: 'Priya Menon', email: 'admin@edurewards.local', phone: '+919000000001', role: 'SUPER_ADMIN', createdAt: daysAgo(120) });
  const admin1 = await createUser({ fullName: 'Rahul Verma', email: 'ops@edurewards.local', phone: '+919000000002', role: 'ADMIN', createdAt: daysAgo(115) });
  const admin2 = await createUser({ fullName: 'Sneha Kulkarni', email: 'ops2@edurewards.local', phone: '+919000000003', role: 'ADMIN', createdAt: daysAgo(110) });

  console.log('Creating 25 ambassadors with a 4-level referral network…');
  const rootAmbassador = await createUser({
    fullName: 'Aarav Sharma', email: 'ambassador@edurewards.local', phone: '+919000000010',
    role: 'USER', institutionId: institutions[0].id, createdAt: daysAgo(95),
  });

  const ambassadors = [rootAmbassador];
  const levelBuckets: string[][] = [[rootAmbassador.id], [], [], [], []];

  for (let i = 0; i < 24; i += 1) {
    // Distribute across levels 1-4 so the tree has real depth.
    const parentLevel = i < 5 ? 0 : i < 12 ? 1 : i < 19 ? 2 : 3;
    const parentId = pick(levelBuckets[parentLevel]);
    const createdAt = daysAgo(90 - i * 3);
    const status = i === 22 ? 'SUSPENDED' : 'ACTIVE';

    const user = await createUser({
      fullName: `${FIRST[i]} ${pick(LAST)}`,
      email: `ambassador${i + 1}@edurewards.local`,
      phone: `+9190000001${String(i).padStart(2, '0')}`,
      role: 'USER',
      status,
      institutionId: pick(institutions).id,
      createdAt,
    });

    const parentCode = await prisma.referralCode.findFirstOrThrow({ where: { userId: parentId } });
    await prisma.referralRelation.create({ data: { childId: user.id, parentId, codeUsed: parentCode.code, createdAt } });
    await prisma.referralCode.update({ where: { code: parentCode.code }, data: { signups: { increment: 1 }, clicks: { increment: crypto.randomInt(3, 15) } } });

    const parentAncestry = await prisma.referralClosure.findMany({ where: { descendantId: parentId } });
    for (const row of parentAncestry) {
      await prisma.referralClosure.create({
        data: { ancestorId: row.ancestorId, descendantId: user.id, depth: row.depth + 1, createdAt },
      });
    }

    await credit(parentId, {
      points: SIGNUP_BONUS, type: 'REFERRAL_BONUS', sourceType: 'REFERRAL', sourceId: user.id,
      description: `Referral bonus — ${user.fullName} joined`, level: 1, originUserId: user.id, createdAt,
    });

    ambassadors.push(user);
    levelBuckets[parentLevel + 1].push(user.id);
  }

  console.log('Creating campaigns…');
  const campaignSeeds = [
    { name: 'Summer Admissions Drive 2026', category: 'ADMISSIONS', credit: 500, budget: 250_000, platforms: ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'], status: 'ACTIVE', perUser: 3 },
    { name: 'Scholarship Awareness Week', category: 'AWARENESS', credit: 750, budget: 150_000, platforms: ['INSTAGRAM', 'X', 'YOUTUBE'], status: 'ACTIVE', perUser: 2 },
    { name: 'Campus Ambassador Recruitment', category: 'RECRUITMENT', credit: 400, budget: 100_000, platforms: ['LINKEDIN', 'TELEGRAM'], status: 'ACTIVE', perUser: 2 },
    { name: 'Open House Blitz (Budget Exhausted)', category: 'EVENTS', credit: 600, budget: 12_000, platforms: ['INSTAGRAM', 'FACEBOOK'], status: 'ACTIVE', perUser: 1 },
  ];

  const campaigns = [];
  for (const seed of campaignSeeds) {
    const campaign = await prisma.campaign.create({
      data: {
        name: seed.name,
        slug: seed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        description: `${seed.name}: share approved creatives with your network, tag the official handle and submit the live post link for verification. Approved posts credit ${seed.credit} points and pay the full referral ladder.`,
        product: 'EduRewards Programme',
        category: seed.category,
        creditValue: seed.credit,
        startDate: daysAgo(60),
        endDate: daysAhead(45),
        status: seed.status,
        budgetPoints: seed.budget,
        perUserLimit: seed.perUser,
        captionTemplate: 'Excited to be part of the journey! Applications are open — link in bio. #EduRewards',
        hashtags: JSON.stringify(['#EduRewards', '#CampusAmbassador', `#${seed.category.toLowerCase()}`]),
        brandGuidelines: 'Use the supplied creatives unmodified. Do not overlay third-party logos. Posts must stay live for at least 30 days.',
        createdById: admin1.id,
        rules: {
          create: [
            { label: 'Tag the official handle', detail: 'Mention @edurewards in the caption or first comment.', sortOrder: 0 },
            { label: 'Keep the post public', detail: 'Private or friends-only posts cannot be verified.', sortOrder: 1 },
            { label: 'Stay live for 30 days', detail: 'Deleted posts have their points reversed automatically.', sortOrder: 2 },
          ],
        },
        platforms: { create: seed.platforms.map((platform) => ({ platform })) },
      },
    });
    campaigns.push(campaign);
  }
  // The fourth campaign is deliberately at its budget ceiling.
  await prisma.campaign.update({ where: { id: campaigns[3].id }, data: { budgetSpentPoints: 12_000 } });

  console.log('Creating 60 submissions with full points history…');
  const activeAmbassadors = ambassadors.filter((a) => a.status === 'ACTIVE');
  const platformsByCampaign = campaignSeeds.map((c) => c.platforms);
  let approvedCount = 0;

  for (let i = 0; i < 60; i += 1) {
    const user = pick(activeAmbassadors);
    const campaignIndex = crypto.randomInt(0, 3); // avoid the exhausted campaign
    const campaign = campaigns[campaignIndex];
    const platform = pick(platformsByCampaign[campaignIndex]);
    const submittedAt = daysAgo(crypto.randomInt(1, 85));

    // Distribution: mostly approved, some rejected, some still queued.
    const roll = crypto.randomInt(0, 100);
    const status = roll < 62 ? 'APPROVED' : roll < 74 ? 'REJECTED' : roll < 86 ? 'PENDING' : roll < 94 ? 'UNDER_REVIEW' : 'INFO_REQUESTED';
    const decided = status === 'APPROVED' || status === 'REJECTED';
    const reviewer = pick([admin1, admin2]);
    const postUrl = `https://www.${platform.toLowerCase()}.com/p/${crypto.randomBytes(6).toString('hex')}`;

    const submission = await prisma.postSubmission.create({
      data: {
        userId: user.id,
        campaignId: campaign.id,
        platform,
        postUrl,
        normalisedUrl: postUrl,
        caption: 'Proud to represent EduRewards on campus this season!',
        status,
        awardedPoints: status === 'APPROVED' ? campaign.creditValue : 0,
        riskLevel: roll > 95 ? 'MEDIUM' : 'LOW',
        submittedAt,
        reviewedAt: decided ? new Date(submittedAt.getTime() + 3_600_000 * crypto.randomInt(2, 40)) : null,
        reviewedById: decided ? reviewer.id : null,
        createdAt: submittedAt,
        media: { create: { fileUrl: `https://placehold.co/800x1000/14532D/FFFFFF/png?text=${platform}`, type: 'SCREENSHOT' } },
        reviews: {
          create: [
            { fromStatus: 'DRAFT', toStatus: 'PENDING', reason: 'Submitted by ambassador', createdAt: submittedAt },
            ...(decided
              ? [{
                  reviewerId: reviewer.id,
                  fromStatus: 'PENDING',
                  toStatus: status,
                  reason: status === 'APPROVED' ? 'Approved' : 'Official handle was not tagged in the caption',
                  createdAt: new Date(submittedAt.getTime() + 3_600_000 * 5),
                }]
              : []),
          ],
        },
      },
    });

    if (status === 'APPROVED') {
      approvedCount += 1;
      const decidedAt = submission.reviewedAt as Date;
      await credit(user.id, {
        points: campaign.creditValue, type: 'POST_REWARD', sourceType: 'SUBMISSION', sourceId: submission.id,
        description: `${campaign.name} — approved post on ${platform}`, createdAt: decidedAt,
      });
      const networkPoints = await distribute(user.id, campaign.creditValue, submission.id, `${campaign.name} network bonus`, decidedAt);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { budgetSpentPoints: { increment: campaign.creditValue + networkPoints } },
      });
    }
  }

  console.log('Creating rewards and voucher pools…');
  const categories = await Promise.all([
    prisma.rewardCategory.create({ data: { key: 'SHOPPING', name: 'Shopping', sortOrder: 1 } }),
    prisma.rewardCategory.create({ data: { key: 'FOOD', name: 'Food & Dining', sortOrder: 2 } }),
    prisma.rewardCategory.create({ data: { key: 'ENTERTAINMENT', name: 'Entertainment', sortOrder: 3 } }),
    prisma.rewardCategory.create({ data: { key: 'TRAVEL', name: 'Travel', sortOrder: 4 } }),
    prisma.rewardCategory.create({ data: { key: 'EDUCATION', name: 'Education', sortOrder: 5 } }),
    prisma.rewardCategory.create({ data: { key: 'CASH', name: 'Cash', sortOrder: 6 } }),
  ]);
  const byKey = Object.fromEntries(categories.map((c) => [c.key, c.id]));

  const rewardSeeds = [
    { title: '₹500 Amazon Gift Card', category: 'SHOPPING', points: 5000, cash: 500, badge: 'POPULAR', featured: false, codes: 40 },
    { title: '₹250 Swiggy Voucher', category: 'FOOD', points: 2500, cash: 250, featured: false, codes: 35 },
    { title: '₹500 BookMyShow Voucher', category: 'ENTERTAINMENT', points: 4500, cash: 500, badge: 'BEST_VALUE', featured: false, codes: 25 },
    { title: '₹1,000 Shopping Voucher', category: 'SHOPPING', points: 10_000, cash: 1000, badge: 'NEW', featured: true, codes: 15 },
    { title: '₹1,000 MakeMyTrip Credit', category: 'TRAVEL', points: 9500, cash: 1000, featured: false, codes: 12 },
    { title: 'Coursera Plus — 1 Month', category: 'EDUCATION', points: 6000, cash: 650, featured: false, codes: 20 },
    { title: '₹200 Zomato Voucher', category: 'FOOD', points: 2000, cash: 200, featured: false, codes: 4 },
    { title: '₹2,000 Flipkart Gift Card', category: 'SHOPPING', points: 19_000, cash: 2000, featured: false, codes: 8 },
    { title: 'Spotify Premium — 3 Months', category: 'ENTERTAINMENT', points: 3500, cash: 380, featured: false, codes: 18 },
    { title: 'Direct Bank Payout', category: 'CASH', points: 10_000, cash: 1000, featured: false, codes: 0, delivery: 'CASH_PAYOUT' },
  ];

  const rewards = [];
  for (const [index, seed] of rewardSeeds.entries()) {
    const reward = await prisma.reward.create({
      data: {
        title: seed.title,
        description: `Redeem your points for ${seed.title}. Codes are delivered instantly to your account once the redemption is approved.`,
        categoryId: byKey[seed.category],
        imageUrl: `https://placehold.co/600x400/E8F5EE/14532D/png?text=${encodeURIComponent(seed.title.slice(0, 18))}`,
        pointsCost: seed.points,
        cashValue: seed.cash,
        stock: seed.codes,
        badge: seed.badge ?? null,
        featured: seed.featured,
        sortOrder: index,
        deliveryType: seed.delivery ?? 'VOUCHER_CODE',
        terms: 'Valid for 12 months from the date of issue. Cannot be exchanged for cash unless stated.',
      },
    });
    if (seed.codes > 0) {
      await prisma.voucherCode.createMany({
        data: Array.from({ length: seed.codes }, () => ({
          rewardId: reward.id,
          code: `${seed.category.slice(0, 3)}-${code(4)}-${code(4)}`,
          batchRef: 'SEED-BATCH-01',
          expiresAt: daysAhead(365),
        })),
      });
    }
    rewards.push(reward);
  }

  console.log('Creating 15 redemptions…');
  const wealthy = await prisma.wallet.findMany({ where: { availablePoints: { gte: 2500 } }, orderBy: { availablePoints: 'desc' }, take: 15 });
  for (const [index, wallet] of wealthy.entries()) {
    const affordable = rewards.filter((r) => r.pointsCost <= wallet.availablePoints && r.deliveryType === 'VOUCHER_CODE');
    if (affordable.length === 0) continue;
    const reward = pick(affordable);
    const status = index < 6 ? 'FULFILLED' : index < 9 ? 'APPROVED' : index < 12 ? 'POINTS_LOCKED' : index < 14 ? 'UNDER_REVIEW' : 'REJECTED';
    const createdAt = daysAgo(crypto.randomInt(2, 60));

    const redemption = await prisma.redemption.create({
      data: {
        reference: ref('RDM'),
        userId: wallet.userId,
        rewardId: reward.id,
        pointsSpent: reward.pointsCost,
        cashValue: reward.cashValue,
        status,
        rejectionReason: status === 'REJECTED' ? 'Account had an unresolved risk flag at the time of review' : null,
        reviewedById: ['FULFILLED', 'APPROVED', 'REJECTED'].includes(status) ? admin1.id : null,
        reviewedAt: ['FULFILLED', 'APPROVED', 'REJECTED'].includes(status) ? new Date(createdAt.getTime() + 86_400_000) : null,
        fulfilledAt: status === 'FULFILLED' ? new Date(createdAt.getTime() + 172_800_000) : null,
        createdAt,
        items: { create: { label: reward.title, quantity: 1, pointsEach: reward.pointsCost } },
      },
    });

    if (status === 'REJECTED') continue;

    await credit(wallet.userId, {
      points: -reward.pointsCost, type: 'REDEMPTION_LOCK', sourceType: 'REDEMPTION', sourceId: redemption.id,
      description: `Points locked for ${reward.title}`, createdAt,
    });
    await prisma.wallet.update({ where: { userId: wallet.userId }, data: { lockedPoints: { increment: reward.pointsCost } } });

    if (['APPROVED', 'FULFILLED'].includes(status)) {
      await prisma.wallet.update({
        where: { userId: wallet.userId },
        data: { lockedPoints: { decrement: reward.pointsCost }, redeemedPoints: { increment: reward.pointsCost } },
      });
      await prisma.pointsLedger.create({
        data: {
          userId: wallet.userId, transactionType: 'REDEMPTION_DEBIT', points: -reward.pointsCost,
          balanceAfter: (await prisma.wallet.findUniqueOrThrow({ where: { userId: wallet.userId } })).availablePoints,
          sourceType: 'REDEMPTION', sourceId: redemption.id, description: `Redeemed ${reward.title}`,
          createdAt: new Date(createdAt.getTime() + 86_400_000),
        },
      });
      const voucher = await prisma.voucherCode.findFirst({ where: { rewardId: reward.id, status: 'UNUSED' } });
      if (voucher) {
        await prisma.voucherCode.update({
          where: { id: voucher.id },
          data: { status: status === 'FULFILLED' ? 'USED' : 'ASSIGNED', assignedToId: wallet.userId, redemptionId: redemption.id, assignedAt: new Date() },
        });
        await prisma.reward.update({ where: { id: reward.id }, data: { stock: { decrement: 1 } } });
      }
    }
  }

  console.log('Creating risk flags, tickets, notifications, announcements and audit history…');
  const flagged = ambassadors.slice(5, 8);
  const flagSeeds = [
    { type: 'SHARED_IP', severity: 'MEDIUM', summary: '4 other accounts registered from the same IP in the last 7 days', score: 15 },
    { type: 'DUPLICATE_URL', severity: 'HIGH', summary: 'Submitted a post URL already claimed by another ambassador', score: 25 },
    { type: 'VELOCITY', severity: 'HIGH', summary: '18 referrals accepted in 24 hours', score: 25 },
  ];
  for (const [index, seed] of flagSeeds.entries()) {
    const user = flagged[index];
    const flag = await prisma.riskFlag.create({
      data: {
        userId: user.id, type: seed.type, severity: seed.severity, status: 'OPEN',
        score: seed.score, summary: seed.summary, evidence: JSON.stringify({ detectedBy: 'seed' }),
        createdAt: daysAgo(crypto.randomInt(1, 20)),
      },
    });
    await prisma.riskEvent.create({ data: { flagId: flag.id, userId: user.id, type: seed.type, weight: seed.score, detail: seed.summary } });
    await prisma.user.update({ where: { id: user.id }, data: { riskScore: { increment: seed.score } } });
  }

  const ticketSeeds = [
    { category: 'POINTS', subject: 'Points not credited for an approved post', priority: 'HIGH', status: 'OPEN' },
    { category: 'REDEMPTION', subject: 'Voucher code is showing as already used', priority: 'URGENT', status: 'IN_PROGRESS' },
    { category: 'ACCOUNT', subject: 'Unable to update my phone number', priority: 'LOW', status: 'RESOLVED' },
    { category: 'CAMPAIGN', subject: 'Which platforms qualify for the scholarship campaign?', priority: 'MEDIUM', status: 'WAITING_FOR_USER' },
    { category: 'TECHNICAL', subject: 'Screenshot upload fails on mobile', priority: 'MEDIUM', status: 'OPEN' },
  ];
  for (const [index, seed] of ticketSeeds.entries()) {
    const user = ambassadors[index + 1];
    const ticket = await prisma.supportTicket.create({
      data: {
        reference: ref('TKT'), userId: user.id, category: seed.category, subject: seed.subject,
        priority: seed.priority, status: seed.status,
        assigneeId: seed.status === 'OPEN' ? null : admin2.id,
        createdAt: daysAgo(crypto.randomInt(1, 25)),
        ...(seed.status === 'RESOLVED' ? { resolvedAt: daysAgo(2) } : {}),
      },
    });
    await prisma.supportMessage.create({ data: { ticketId: ticket.id, authorId: user.id, body: `${seed.subject}. Could you please take a look?` } });
    if (seed.status !== 'OPEN') {
      await prisma.supportMessage.create({ data: { ticketId: ticket.id, authorId: admin2.id, body: 'Thanks for flagging this — we are looking into it and will update you shortly.' } });
    }
  }

  for (const user of ambassadors.slice(0, 12)) {
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'POINTS_CREDITED', title: 'Points credited', body: 'Your latest approved post has been credited to your wallet.', link: '/wallet', createdAt: daysAgo(crypto.randomInt(1, 10)) },
        { userId: user.id, type: 'REFERRAL_JOINED', title: 'A new ambassador joined', body: 'Someone signed up using your referral link.', link: '/network', createdAt: daysAgo(crypto.randomInt(1, 20)) },
      ],
    });
  }

  await prisma.announcement.create({
    data: {
      title: 'Scholarship Awareness Week is live',
      body: 'Approved posts during Scholarship Awareness Week credit 750 points and pay the full referral ladder. Creatives are available on the campaign page.',
      audience: 'ALL', severity: 'SUCCESS', publishedAt: daysAgo(4), authorId: superAdmin.id,
    },
  });

  const auditSeeds = [
    { action: 'settings.economics_changed', entityType: 'AppSetting', actor: superAdmin },
    { action: 'campaign.created', entityType: 'Campaign', actor: admin1, entityId: campaigns[0].id },
    { action: 'submission.approved', entityType: 'PostSubmission', actor: admin1 },
    { action: 'redemption.approved', entityType: 'Redemption', actor: admin2 },
    { action: 'user.suspended', entityType: 'User', actor: admin1 },
  ];
  for (const seed of auditSeeds) {
    await prisma.auditLog.create({
      data: {
        actorId: seed.actor.id, actorRole: seed.actor.primaryRole, action: seed.action,
        entityType: seed.entityType, entityId: seed.entityId ?? null, ip: '10.0.0.12',
        afterJson: JSON.stringify({ seeded: true }), createdAt: daysAgo(crypto.randomInt(1, 30)),
      },
    });
  }

  console.log('Assigning tiers, badges and leaderboards…');
  const wallets = await prisma.wallet.findMany();
  for (const wallet of wallets) {
    const referrals = await prisma.referralRelation.count({ where: { parentId: wallet.userId } });
    const approved = await prisma.postSubmission.count({ where: { userId: wallet.userId, status: 'APPROVED' } });
    const earned = tiers.filter((t) => wallet.lifetimeEarned >= t.minPoints && referrals >= t.minReferrals);
    const tier = earned[earned.length - 1] ?? tiers[0];
    await prisma.userTier.create({ data: { userId: wallet.userId, tierId: tier.id } });

    const badges = await prisma.badge.findMany();
    const stats: Record<string, number> = { referrals, approved, lifetimeEarned: wallet.lifetimeEarned };
    for (const badge of badges) {
      if (!badge.criteria) continue;
      const criteria = JSON.parse(badge.criteria) as { metric: string; gte: number };
      if ((stats[criteria.metric] ?? 0) >= criteria.gte) {
        await prisma.userBadge.create({ data: { userId: wallet.userId, badgeId: badge.id } });
      }
    }
  }

  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const pointsRanking = await prisma.wallet.findMany({ orderBy: { lifetimeEarned: 'desc' }, take: 20 });
  for (const [index, wallet] of pointsRanking.entries()) {
    await prisma.leaderboardEntry.create({ data: { userId: wallet.userId, period, scope: 'POINTS', rank: index + 1, value: wallet.lifetimeEarned } });
  }
  const networkRanking = await prisma.referralRelation.groupBy({ by: ['parentId'], _count: { _all: true }, orderBy: { _count: { parentId: 'desc' } }, take: 20 });
  for (const [index, row] of networkRanking.entries()) {
    await prisma.leaderboardEntry.create({ data: { userId: row.parentId, period, scope: 'NETWORK', rank: index + 1, value: row._count._all } });
  }

  const totals = await prisma.wallet.aggregate({ _sum: { availablePoints: true, lifetimeEarned: true } });
  console.log('\n─────────────────────────────────────────────');
  console.log('  EduRewards seed complete');
  console.log('─────────────────────────────────────────────');
  console.log(`  Users               ${await prisma.user.count()}`);
  console.log(`  Campaigns           ${campaigns.length}`);
  console.log(`  Submissions         ${await prisma.postSubmission.count()} (${approvedCount} approved)`);
  console.log(`  Rewards             ${rewards.length}`);
  console.log(`  Voucher codes       ${await prisma.voucherCode.count()}`);
  console.log(`  Redemptions         ${await prisma.redemption.count()}`);
  console.log(`  Ledger entries      ${await prisma.pointsLedger.count()}`);
  console.log(`  Points outstanding  ${(totals._sum.availablePoints ?? 0).toLocaleString()}`);
  console.log(`  Lifetime earned     ${(totals._sum.lifetimeEarned ?? 0).toLocaleString()}`);
  console.log('\n  Sign in with (password from SEED_PASSWORD, default shown):');
  console.log(`    Super Admin   admin@edurewards.local        ${DEMO_PASSWORD}`);
  console.log(`    Admin         ops@edurewards.local          ${DEMO_PASSWORD}`);
  console.log(`    Ambassador    ambassador@edurewards.local   ${DEMO_PASSWORD}`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
