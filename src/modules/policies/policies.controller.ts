import type { Request, Response } from 'express';
import { policyService } from '@/modules/policies/policy.service';
import type { ListPoliciesQuery } from '@/modules/policies/policy.schema';

export const policiesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await policyService.list(orgId, req.query as unknown as ListPoliciesQuery));
  },

  async get(req: Request, res: Response): Promise<void> {
    res.json(await policyService.get(req.authContext!.organization.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    res.status(201).json(await policyService.create(req.authContext!.organization.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    res.json(await policyService.update(req.authContext!.organization.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await policyService.remove(req.authContext!.organization.id, req.params.id as string);
    res.status(204).send();
  },
};
