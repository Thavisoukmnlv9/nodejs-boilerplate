import type { Request, Response } from 'express';
import { BadRequestError } from '@/common/errors';
import { filesService } from '@/modules/files/files.service';

export const filesController = {
  async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new BadRequestError('No file uploaded (expected multipart field "file")');
    const result = await filesService.upload(req.authContext!.organization.id, req.auth!.userId, req.file);
    res.status(201).json(result);
  },

  async get(req: Request, res: Response): Promise<void> {
    res.json(await filesService.getMeta(req.authContext!.organization.id, req.params.id!));
  },
};
