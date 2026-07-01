import type { Request, Response } from 'express';
import type { PaginationParams } from '@/common/utils/pagination';
import { roleService } from '@/modules/roles/role.service';

export const rolesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await roleService.listRoles(orgId, req.query as unknown as PaginationParams));
  },
};
