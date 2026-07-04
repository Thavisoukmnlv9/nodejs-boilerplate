import type { Request, Response } from 'express';
import type { PaginationParams } from '@/common/utils/pagination';
import { roleService } from '@/modules/roles/role.service';

export const rolesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await roleService.listRoles(orgId, req.query as unknown as PaginationParams));
  },

  async listPermissions(_req: Request, res: Response): Promise<void> {
    res.json(await roleService.listPermissions());
  },

  async get(req: Request, res: Response): Promise<void> {
    res.json(await roleService.getRole(req.authContext!.organization.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    res.status(201).json(await roleService.createRole(req.authContext!.organization.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    res.json(await roleService.updateRole(req.authContext!.organization.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await roleService.deleteRole(req.authContext!.organization.id, req.params.id as string);
    res.status(204).send();
  },
};
