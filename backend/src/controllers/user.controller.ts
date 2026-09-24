import type { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { walletService } from '../services/wallet.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import type { Role } from '../../../shared/constants';

function ctx(req: Request) {
  return { actorId: req.auth?.userId, actorRole: req.auth?.role, ip: req.ip, userAgent: req.get('user-agent') ?? null };
}

export const userController = {
  async list(req: Request, res: Response) {
    return ok(res, await userService.list(validated(req, 'query')));
  },

  async detail(req: Request, res: Response) {
    return ok(res, await userService.detail(req.params.id, req.auth!.role as Role));
  },

  async myProfile(req: Request, res: Response) {
    return ok(res, await userService.detail(req.auth!.userId, req.auth!.role as Role));
  },

  async updateMyProfile(req: Request, res: Response) {
    return ok(res, await userService.updateProfile(req.auth!.userId, validated(req), ctx(req)));
  },

  async advanceOnboarding(req: Request, res: Response) {
    const { step } = req.body as { step: number };
    return ok(res, await userService.advanceOnboarding(req.auth!.userId, step));
  },

  async setStatus(req: Request, res: Response) {
    const { status, reason } = req.body as { status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'; reason: string };
    return ok(res, await userService.setStatus(req.params.id, status, reason, ctx(req)));
  },

  async adjustPoints(req: Request, res: Response) {
    return ok(res, await userService.adjustPoints(req.params.id, validated(req), ctx(req)));
  },

  async changeRole(req: Request, res: Response) {
    const { role } = req.body as { role: Role };
    return ok(res, await userService.changeRole(req.params.id, role, ctx(req)));
  },

  async createStaff(req: Request, res: Response) {
    return created(res, await userService.createStaff(validated(req), ctx(req)));
  },

  async listStaff(_req: Request, res: Response) {
    return ok(res, await userService.listStaff());
  },

  async remove(req: Request, res: Response) {
    const { reason } = req.body as { reason: string };
    return ok(res, await userService.softDelete(req.params.id, reason ?? 'Removed by administrator', ctx(req)));
  },

  async wallet(req: Request, res: Response) {
    return ok(res, await walletService.summary(req.auth!.userId));
  },

  async ledger(req: Request, res: Response) {
    return ok(res, await walletService.ledger(req.auth!.userId, validated(req, 'query')));
  },

  async walletTrend(req: Request, res: Response) {
    return ok(res, await walletService.trend(req.auth!.userId, Number(req.query.days) || 30));
  },
};
