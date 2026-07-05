import type { Request, Response } from 'express';
import { usersService } from '@/modules/users/users.service';
import type { ExportUsersQuery, ListUsersQuery } from '@/modules/users/users.schema';

/** RBAC guards have already populated req.authContext by the time we run. */
export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await usersService.list(orgId, req.query as unknown as ListUsersQuery));
  },

  async stats(req: Request, res: Response): Promise<void> {
    res.json(await usersService.stats(req.authContext!.organization.id));
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    const csv = await usersService.exportCsv(orgId, req.query as unknown as ExportUsersQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
  },

  async bulk(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await usersService.bulk(orgId, req.auth!.userId, req.body));
  },

  async get(req: Request, res: Response): Promise<void> {
    res.json(await usersService.get(req.authContext!.organization.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    const issued = await usersService.invite(req.authContext!.organization.id, req.auth!.userId, req.body);
    res.status(201).json(issued);
  },

  async update(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await usersService.update(orgId, req.params.id as string, req.auth!.userId, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await usersService.remove(req.authContext!.organization.id, req.params.id as string, req.auth!.userId);
    res.status(204).send();
  },

  async resendInvite(req: Request, res: Response): Promise<void> {
    res.status(201).json(await usersService.resendInvite(req.authContext!.organization.id, req.params.id as string));
  },
};
