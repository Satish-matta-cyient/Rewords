import { registerAdapter, type LivenessResult, type SocialAdapter } from './adapter';
import { logger } from '../../config/logger';

const TIMEOUT_MS = 8_000;

/**
 * Generic HTTP adapter. It is intentionally conservative: anything other than a
 * clear 404/410 is reported as UNKNOWN so a transient outage can never cost an
 * ambassador their points.
 *
 * Replace or supplement with official platform APIs (Graph, LinkedIn, YouTube Data)
 * by registering additional adapters — no calling code changes.
 */
export const httpLivenessAdapter: SocialAdapter = {
  key: 'http-head',
  supports() { return true; },

  async checkLiveness(url: string): Promise<LivenessResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'EduRewardsLivenessBot/1.0 (+compliance check)' },
      });
      if (response.status === 404 || response.status === 410) return 'REMOVED';
      if (response.status >= 500 || response.status === 429 || response.status === 403) return 'UNKNOWN';
      return 'ALIVE';
    } catch (error) {
      logger.debug({ error, url }, 'liveness check inconclusive');
      return 'UNKNOWN';
    } finally {
      clearTimeout(timer);
    }
  },
};

registerAdapter(httpLivenessAdapter);
