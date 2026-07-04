import type { Request, Response } from 'express';
import { UnauthorizedError } from '@/common/errors';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from '@/common/utils/cookies';
import { authService } from '@/modules/auth/auth.service';
import type { RequestMeta } from '@/modules/auth/auth.types';

/** Controllers do HTTP only: read the request, call the service, shape the response. */
function meta(req: Request): RequestMeta {
  return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const r = await authService.register(req.body, meta(req));
    setRefreshCookie(res, r.refreshToken);
    res.status(201).json({
      user_id: r.userId,
      email: r.email,
      access_token: r.accessToken,
      refresh_token: r.refreshToken,
      token_type: 'bearer',
      expires_in: r.expiresIn,
    });
  },

  async login(req: Request, res: Response): Promise<void> {
    const r = await authService.login(req.body, meta(req));
    setRefreshCookie(res, r.refreshToken);
    res.json({
      access_token: r.accessToken,
      refresh_token: r.refreshToken,
      token_type: 'bearer',
      expires_in: r.expiresIn,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const token = readRefreshToken(req, req.body?.refresh_token);
    if (!token) throw new UnauthorizedError('Missing refresh token');
    const r = await authService.refresh(token);
    res.json({ access_token: r.accessToken, token_type: 'bearer', expires_in: r.expiresIn });
  },

  async logout(req: Request, res: Response): Promise<void> {
    await authService.logout(readRefreshToken(req, req.body?.refresh_token));
    clearRefreshCookie(res);
    res.json({ ok: true });
  },

  async logoutAll(req: Request, res: Response): Promise<void> {
    const revokedCount = await authService.logoutAll(req.auth!.userId);
    res.json({ revoked_count: revokedCount });
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    await authService.forgotPassword(req.body);
    res.json({ ok: true });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    await authService.resetPassword(req.body);
    res.json({ ok: true });
  },

  async acceptInvite(req: Request, res: Response): Promise<void> {
    const r = await authService.acceptInvite(req.body, meta(req));
    setRefreshCookie(res, r.refreshToken);
    res.status(201).json({
      access_token: r.accessToken,
      refresh_token: r.refreshToken,
      token_type: 'bearer',
      expires_in: r.expiresIn,
    });
  },

  async listSessions(req: Request, res: Response): Promise<void> {
    res.json(await authService.listSessions(req.auth!.userId));
  },

  async revokeSession(req: Request, res: Response): Promise<void> {
    await authService.revokeSession(req.auth!.userId, req.params.id as string);
    res.json({ ok: true });
  },
};
