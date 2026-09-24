import type { Request, Response } from 'express';
import { campaignService } from '../services/campaign.service';
import { ok, created } from '../utils/response';
import { validated } from '../middleware/validate';
import { publicUrlFor } from '../middleware/upload';

function ctx(req: Request) {
  return { actorId: req.auth?.userId, actorRole: req.auth?.role, ip: req.ip, userAgent: req.get('user-agent') ?? null };
}

export const campaignController = {
  async list(req: Request, res: Response) {
    const filters = validated<Record<string, unknown>>(req, 'query');
    // Ambassadors only ever see live campaigns, regardless of query params.
    const scoped = req.auth?.role === 'USER' ? { ...filters, activeOnly: true, status: undefined } : filters;
    return ok(res, await campaignService.list(scoped, req.auth?.userId));
  },

  async detail(req: Request, res: Response) {
    return ok(res, await campaignService.detail(req.params.id, req.auth?.userId));
  },

  async create(req: Request, res: Response) {
    return created(res, await campaignService.create(validated(req), ctx(req)));
  },

  async update(req: Request, res: Response) {
    return ok(res, await campaignService.update(req.params.id, validated(req), ctx(req)));
  },

  async changeStatus(req: Request, res: Response) {
    const { status } = req.body as { status: string };
    return ok(res, await campaignService.changeStatus(req.params.id, status, ctx(req)));
  },

  async uploadCreative(req: Request, res: Response) {
    const file = req.file as Express.Multer.File;
    const creative = await campaignService.addCreative(req.params.id, {
      type: file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE',
      title: req.body.title ?? file.originalname,
      fileUrl: publicUrlFor('creatives', file.filename),
      fileSize: file.size,
      mimeType: file.mimetype,
    }, ctx(req));
    return created(res, creative);
  },

  async downloadCreative(req: Request, res: Response) {
    return ok(res, await campaignService.trackCreativeDownload(req.params.creativeId));
  },
};
