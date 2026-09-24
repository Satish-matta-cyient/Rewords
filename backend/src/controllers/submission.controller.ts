import type { Request, Response } from 'express';
import { submissionService } from '../services/submission.service';
import { verificationService } from '../services/verification.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import { publicUrlFor } from '../middleware/upload';

function ctx(req: Request) {
  return { actorId: req.auth?.userId, actorRole: req.auth?.role, ip: req.ip, userAgent: req.get('user-agent') ?? null };
}

export const submissionController = {
  async create(req: Request, res: Response) {
    const body = validated<Record<string, never>>(req);
    const screenshotUrl = req.file ? publicUrlFor('submissions', req.file.filename) : (req.body.screenshotUrl as string | undefined);
    const submission = await submissionService.create(req.auth!.userId, { ...body, screenshotUrl } as never, ctx(req));
    return created(res, submission);
  },

  async mine(req: Request, res: Response) {
    return ok(res, await submissionService.listForUser(req.auth!.userId, validated(req, 'query')));
  },

  async detail(req: Request, res: Response) {
    return ok(res, await submissionService.detail(req.params.id, { userId: req.auth!.userId, role: req.auth!.role }));
  },

  async queue(req: Request, res: Response) {
    return ok(res, await submissionService.listForReview(validated(req, 'query')));
  },

  async queueStats(_req: Request, res: Response) {
    return ok(res, await submissionService.queueStats());
  },

  async claim(req: Request, res: Response) {
    return ok(res, await verificationService.claim(req.params.id, req.auth!.userId, ctx(req)));
  },

  async approve(req: Request, res: Response) {
    const { note } = validated<{ note?: string }>(req);
    return ok(res, await verificationService.approve(req.params.id, req.auth!.userId, { note }, ctx(req)));
  },

  async reject(req: Request, res: Response) {
    const { reason, note } = validated<{ reason: string; note?: string }>(req);
    return ok(res, await verificationService.reject(req.params.id, req.auth!.userId, { reason, note }, ctx(req)));
  },

  async requestInfo(req: Request, res: Response) {
    const { reason } = validated<{ reason: string }>(req);
    return ok(res, await verificationService.requestInformation(req.params.id, req.auth!.userId, { reason }, ctx(req)));
  },

  async reverse(req: Request, res: Response) {
    const { reason } = validated<{ reason: string }>(req);
    return ok(res, await verificationService.reverse(req.params.id, req.auth!.userId, reason, ctx(req)));
  },

  async bulkApprove(req: Request, res: Response) {
    const { submissionIds } = validated<{ submissionIds: string[] }>(req);
    return ok(res, await verificationService.bulkApprove(submissionIds, req.auth!.userId, ctx(req)));
  },

  async bulkReject(req: Request, res: Response) {
    const { submissionIds, reason } = validated<{ submissionIds: string[]; reason?: string }>(req);
    return ok(res, await verificationService.bulkReject(submissionIds, req.auth!.userId, reason ?? 'Does not meet campaign requirements', ctx(req)));
  },
};
