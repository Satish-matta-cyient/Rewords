import type { Request, Response } from 'express';
import { referralService } from '../services/referral.service';
import { analyticsService } from '../services/analytics.service';
import { ok } from '../utils/response';
import { AuthorizationError } from '../errors';

export const referralController = {
  async me(req: Request, res: Response) {
    return ok(res, await referralService.stats(req.auth!.userId));
  },

  async tree(req: Request, res: Response) {
    const depth = req.query.depth ? Number(req.query.depth) : undefined;
    return ok(res, await referralService.tree(req.auth!.userId, depth));
  },

  /** A user may only inspect a subtree they actually own; staff may view anyone. */
  async treeFor(req: Request, res: Response) {
    const targetId = req.params.userId;
    const isStaff = req.auth!.role !== 'USER';
    if (!isStaff && targetId !== req.auth!.userId) {
      const owns = await referralService.tree(req.auth!.userId);
      const flatten = (node: typeof owns): string[] => [node.userId, ...node.children.flatMap(flatten)];
      if (!flatten(owns).includes(targetId)) throw new AuthorizationError('You can only view members of your own network');
    }
    return ok(res, await referralService.tree(targetId));
  },

  async analytics(req: Request, res: Response) {
    return ok(res, await analyticsService.referralAnalytics(req.auth!.userId));
  },
};
