import type { Request, Response } from 'express';
import { meService } from '@/modules/me/me.service';

export const meController = {
  async getMe(req: Request, res: Response): Promise<void> {
    const { userId, orgId } = req.auth!;
    res.json(await meService.getMe(userId, orgId));
  },
};
