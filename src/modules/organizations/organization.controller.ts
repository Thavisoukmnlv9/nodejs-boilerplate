import type { Request, Response } from 'express';

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
};
