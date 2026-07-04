import type { Request, Response } from 'express';
import { organizationService } from '@/modules/organizations/organization.service';

export const organizationController = {
  /** GET /api/v1/organizations/current — the caller's active org (from the token). */
  current(req: Request, res: Response): void {
    const org = req.authContext!.organization;
    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      currency_code: org.currency_code,
      locale: org.locale,
      timezone: org.timezone,
    });
  },

  /** POST /api/v1/organizations — onboarding: create an org and become its Owner. */
  async create(req: Request, res: Response): Promise<void> {
    res.status(201).json(await organizationService.createOrganization(req.auth!.userId, req.body));
  },
};
