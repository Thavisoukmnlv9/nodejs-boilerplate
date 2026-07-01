import type { Request, Response } from 'express';
import { usersService } from '@/modules/users/users.service';
import type { ListUsersQuery } from '@/modules/users/users.schema';

/** RBAC guards have already populated req.authContext by the time we run. */
export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await usersService.list(orgId, req.query as unknown as ListUsersQuery));
  },

  async get(req: Request, res: Response): Promise<void> {
    res.json(await usersService.get(req.authContext!.organization.id, req.params.id!));
  },

  async create(req: Request, res: Response): Promise<void> {
    const member = await usersService.invite(req.authContext!.organization.id, req.auth!.userId, req.body);
    res.status(201).json(member);
  },

  async update(req: Request, res: Response): Promise<void> {
    res.json(await usersService.update(req.authContext!.organization.id, req.params.id!, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await usersService.remove(req.authContext!.organization.id, req.params.id!);
    res.status(204).send();
  },
};
