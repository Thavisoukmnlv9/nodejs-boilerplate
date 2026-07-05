import type { Request, Response } from 'express';
import { POLICY_CONDITION_SCHEMA } from '@/modules/policies/policy.condition-schema';
import { policyService } from '@/modules/policies/policy.service';
import type { ExportPoliciesQuery, ListPoliciesQuery } from '@/modules/policies/policy.schema';

export const policiesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    res.json(await policyService.list(orgId, req.query as unknown as ListPoliciesQuery));
  },

  async stats(req: Request, res: Response): Promise<void> {
    res.json(await policyService.stats(req.authContext!.organization.id));
  },

  /** Static catalog that drives the SPA's guided condition builder. */
  async conditionSchema(_req: Request, res: Response): Promise<void> {
    res.json(POLICY_CONDITION_SCHEMA);
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const csv = await policyService.exportCsv(req.authContext!.organization.id, req.query as unknown as ExportPoliciesQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="policies.csv"');
    res.send(csv);
  },

  async bulk(req: Request, res: Response): Promise<void> {
    res.json(await policyService.bulk(req.authContext!.organization.id, req.body));
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
