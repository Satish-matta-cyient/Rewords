import { startScheduler, type JobDefinition } from './scheduler';
import { livenessJob } from './liveness.job';
import { pointsExpiryJob } from './pointsExpiry.job';
import { leaderboardJob } from './leaderboard.job';
import { voucherStockJob } from './voucherStock.job';
import { campaignLifecycleJob } from './campaignLifecycle.job';
import { env } from '../config/env';

export const jobs: JobDefinition[] = [
  { name: 'post-liveness', intervalMinutes: env.LIVENESS_CHECK_CRON_MINUTES, handler: livenessJob },
  { name: 'points-expiry', intervalMinutes: 60 * 12, handler: pointsExpiryJob },
  { name: 'leaderboards', intervalMinutes: 60, runOnBoot: true, handler: leaderboardJob },
  { name: 'voucher-stock', intervalMinutes: 60 * 6, handler: voucherStockJob },
  { name: 'campaign-lifecycle', intervalMinutes: 30, runOnBoot: true, handler: campaignLifecycleJob },
];

export function startJobs() { return startScheduler(jobs); }
export { triggerJob } from './scheduler';
