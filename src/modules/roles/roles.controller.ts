import type { Request, Response } from 'express';
import { roleService } from '@/modules/roles/role.service';
import type { ExportRolesQuery, ListRolesQuery } from '@/modules/roles/role.schema';

export const rolesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await roleService.listRoles(orgId, req.query as unknown as ListRolesQuery));
  },

  async listPermissions(_req: Request, res: Response): Promise<void> {
    res.json(await roleService.listPermissions());
  },

  async stats(req: Request, res: Response): Promise<void> {
    res.json(await roleService.stats(req.authContext!.organization.id));
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await roleService.exportCsv(req.authContext!.organization.id, req.query as unknown as ExportRolesQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="roles.csv"');
    res.send(csv);
  },

  async bulk(req: Request, res: Response): Promise<void> {
    res.json(await roleService.bulk(req.authContext!.organization.id, req.body));
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
