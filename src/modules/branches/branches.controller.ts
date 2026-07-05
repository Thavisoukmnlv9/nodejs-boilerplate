import type { Request, Response } from 'express';
import { accessControl, ensureAuthContext, getBranchScope, resolveBranchWhere } from '@/access';
import { ForbiddenError } from '@/common/errors';
import { branchService } from '@/modules/branches/branch.service';
import type { BulkBranchesInput, ExportBranchesQuery, ListBranchesQuery } from '@/modules/branches/branch.schema';

/**
 * Branch-scope is resolved HERE (at the HTTP edge) and passed into the service, so
 * the 403 stays at the route layer and the service stays a pure function of its args.
 */
export const branchesController = {
  async list(req: Request, res: Response): Promise<void> {
    const orgId = req.authContext!.organization.id;
    const query = req.query as unknown as ListBranchesQuery;
    const scope = await getBranchScope(req);
    const idFilter = resolveBranchWhere(query.branch_id, scope);
    res.json(await branchService.list(orgId, query, idFilter));
  },

  async stats(req: Request, res: Response): Promise<void> {
    const scope = await getBranchScope(req);
    const idFilter = resolveBranchWhere(undefined, scope);
    res.json(await branchService.stats(req.authContext!.organization.id, idFilter));
  },

  async exportCsv(req: Request, res: Response): Promise<void> {
    const scope = await getBranchScope(req);
    const idFilter = resolveBranchWhere(undefined, scope);
    const csv = await branchService.exportCsv(req.authContext!.organization.id, req.query as unknown as ExportBranchesQuery, idFilter);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="branches.csv"');
    res.send(csv);
  },

  /**
   * `delete` requires the stricter branches.delete permission (parity with the
   * single-item DELETE); `archive`/`activate` need only branches.manage. Enforced
   * per-action here since one route serves all three. Scope clamps the target set.
   */
  async bulk(req: Request, res: Response): Promise<void> {
    const ctx = await ensureAuthContext(req);
    const action = (req.body as BulkBranchesInput).action;
    const needed = action === 'delete' ? 'platform.branches.delete' : 'platform.branches.manage';
    const decision = await accessControl.can({ ctx, permission: needed });
    if (!decision.allowed) throw new ForbiddenError(`Permission denied: ${needed}`);
    const scope = await getBranchScope(req);
    const idFilter = resolveBranchWhere(undefined, scope);
    res.json(await branchService.bulk(ctx.organization.id, req.body, idFilter));
  },

  async get(req: Request, res: Response): Promise<void> {
    const scope = await getBranchScope(req);
    resolveBranchWhere(req.params.id as string, scope); // 403 if the branch is outside the caller's scope
    res.json(await branchService.get(req.authContext!.organization.id, req.params.id as string));
  },

  async create(req: Request, res: Response): Promise<void> {
    res.status(201).json(await branchService.create(req.authContext!.organization.id, req.body));
  },

  async update(req: Request, res: Response): Promise<void> {
    res.json(await branchService.update(req.authContext!.organization.id, req.params.id as string, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await branchService.remove(req.authContext!.organization.id, req.params.id as string);
    res.status(204).send();
  },
};
