import { logger } from '../config/logger';
import { env } from '../config/env';

export interface JobDefinition {
  name: string;
  intervalMinutes: number;
  runOnBoot?: boolean;
  handler: () => Promise<unknown>;
}

const timers: NodeJS.Timeout[] = [];
const running = new Set<string>();

/**
 * Deliberately lightweight in-process scheduler for local development.
 * Swap `start` for a BullMQ/Agenda producer in production — the job handlers
 * themselves are plain async functions and need no changes.
 */
async function runOnce(job: JobDefinition) {
  if (running.has(job.name)) {
    logger.warn({ job: job.name }, 'skipping overlapping job run');
    return;
  }
  running.add(job.name);
  const startedAt = Date.now();
  try {
    const result = await job.handler();
    logger.info({ job: job.name, durationMs: Date.now() - startedAt, result }, 'job completed');
  } catch (error) {
    logger.error({ job: job.name, error }, 'job failed');
  } finally {
    running.delete(job.name);
  }
}

export function startScheduler(jobs: JobDefinition[]) {
  if (!env.ENABLE_JOBS) {
    logger.info('scheduler disabled by configuration');
    return () => undefined;
  }

  for (const job of jobs) {
    if (job.runOnBoot) void runOnce(job);
    const timer = setInterval(() => void runOnce(job), job.intervalMinutes * 60_000);
    timer.unref();
    timers.push(timer);
    logger.info({ job: job.name, everyMinutes: job.intervalMinutes }, 'job scheduled');
  }

  return () => { timers.forEach(clearInterval); timers.length = 0; };
}

export const triggerJob = runOnce;
