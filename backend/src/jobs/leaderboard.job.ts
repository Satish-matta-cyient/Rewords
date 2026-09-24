import { gamificationService } from '../services/gamification.service';
import { monthKey } from '../utils/date';

export async function leaderboardJob() {
  const current = await gamificationService.rebuildLeaderboards(monthKey());
  const allTime = await gamificationService.rebuildLeaderboards('ALL_TIME');
  return { current, allTime };
}
