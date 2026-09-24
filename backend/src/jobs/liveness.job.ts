import { submissionRepository } from '../repositories/submission.repository';
import { adapterFor } from '../integrations/social/adapter';
import '../integrations/social/httpAdapter';
import { settingsService } from '../services/settings.service';
import { verificationService } from '../services/verification.service';
import { logger } from '../config/logger';

const BATCH_SIZE = 25;
const RECHECK_AFTER_HOURS = 24 * 7;

/**
 * Re-checks approved posts. Points are only reversed after the configured number
 * of *consecutive definitive* failures — a single network hiccup never costs points.
 */
export async function livenessJob() {
  const economics = await settingsService.getEconomics();
  const candidates = await submissionRepository.approvedForLiveness(BATCH_SIZE, RECHECK_AFTER_HOURS);

  let checked = 0;
  let removed = 0;
  let reversed = 0;

  for (const submission of candidates) {
    const adapter = adapterFor(submission.platform);
    if (!adapter) continue;

    const result = await adapter.checkLiveness(submission.postUrl);
    checked += 1;

    if (result === 'ALIVE') {
      await submissionRepository.update(submission.id, { lastLivenessAt: new Date(), livenessFailures: 0 });
      continue;
    }
    if (result === 'UNKNOWN') {
      // Inconclusive: record the attempt but do not count it as a failure.
      await submissionRepository.update(submission.id, { lastLivenessAt: new Date() });
      continue;
    }

    removed += 1;
    const failures = submission.livenessFailures + 1;
    await submissionRepository.update(submission.id, { lastLivenessAt: new Date(), livenessFailures: failures });

    if (failures >= economics.livenessFailureThreshold) {
      try {
        await verificationService.reverse(
          submission.id,
          null,
          `Post no longer reachable after ${failures} consecutive checks`,
          { actorId: null, actorRole: 'SYSTEM' },
        );
        reversed += 1;
      } catch (error) {
        logger.error({ error, submissionId: submission.id }, 'liveness reversal failed');
      }
    }
  }

  return { checked, removed, reversed, threshold: economics.livenessFailureThreshold };
}
