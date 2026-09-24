import type { Request, Response } from 'express';
import { rewardService } from '../services/reward.service';
import { redemptionService } from '../services/redemption.service';
import { voucherService } from '../services/voucher.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import { parseCodeList } from '../utils/csv';

function ctx(req: Request) {
  return { actorId: req.auth?.userId, actorRole: req.auth?.role, ip: req.ip, userAgent: req.get('user-agent') ?? null };
}

export const rewardController = {
  async list(req: Request, res: Response) {
    return ok(res, await rewardService.list(validated(req, 'query'), req.auth?.userId));
  },
  async detail(req: Request, res: Response) {
    return ok(res, await rewardService.detail(req.params.id, req.auth?.userId));
  },
  async categories(_req: Request, res: Response) {
    return ok(res, await rewardService.categories());
  },
  async create(req: Request, res: Response) {
    return created(res, await rewardService.create(validated(req), ctx(req)));
  },
  async update(req: Request, res: Response) {
    return ok(res, await rewardService.update(req.params.id, validated(req), ctx(req)));
  },
  async archive(req: Request, res: Response) {
    return ok(res, await rewardService.archive(req.params.id, ctx(req)));
  },

  async createRedemption(req: Request, res: Response) {
    const body = validated<{ rewardId: string; quantity: number }>(req);
    return created(res, await redemptionService.create(req.auth!.userId, body, ctx(req)));
  },
  async myRedemptions(req: Request, res: Response) {
    return ok(res, await redemptionService.listForUser(req.auth!.userId, validated(req, 'query')));
  },
  async redemptionDetail(req: Request, res: Response) {
    return ok(res, await redemptionService.detail(req.params.id, { userId: req.auth!.userId, role: req.auth!.role }));
  },
  async revealVoucher(req: Request, res: Response) {
    return ok(res, await redemptionService.revealVoucher(req.params.id, req.auth!.userId));
  },

  async adminRedemptions(req: Request, res: Response) {
    return ok(res, await redemptionService.listForAdmin(validated(req, 'query')));
  },
  async approveRedemption(req: Request, res: Response) {
    return ok(res, await redemptionService.approve(req.params.id, req.auth!.userId, ctx(req)));
  },
  async rejectRedemption(req: Request, res: Response) {
    const { reason } = validated<{ reason: string }>(req);
    return ok(res, await redemptionService.reject(req.params.id, req.auth!.userId, reason, ctx(req)));
  },
  async fulfilRedemption(req: Request, res: Response) {
    return ok(res, await redemptionService.markFulfilled(req.params.id, req.auth!.userId, ctx(req)));
  },

  async voucherOverview(_req: Request, res: Response) {
    return ok(res, await voucherService.overview());
  },
  async voucherInventory(req: Request, res: Response) {
    return ok(res, await voucherService.inventory(req.params.id));
  },
  async importVouchers(req: Request, res: Response) {
    // Accepts either a JSON array of codes or a raw CSV blob.
    const body = req.body as { rewardId?: string; codes?: string[]; csv?: string; batchRef?: string; expiresAt?: string };
    const codes = body.codes ?? parseCodeList(body.csv ?? '');
    const result = await voucherService.importCodes({
      rewardId: body.rewardId ?? req.params.id,
      codes,
      batchRef: body.batchRef,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    }, ctx(req));
    return created(res, result);
  },
};
