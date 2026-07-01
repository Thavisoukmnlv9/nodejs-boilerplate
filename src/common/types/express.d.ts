import type { AuthContext, AuthPrincipal } from '@/common/types/context';

/**
 * Express Request augmentation — the Node equivalent of FastAPI's injected
 * dependencies. `authGuard` attaches `req.auth`; `loadUserOrg` (and the RBAC
 * guards, lazily) attach `req.authContext`.
 */
declare global {
  namespace Express {
    interface Request {
      /** Correlation id, echoed as the `X-Request-Id` response header. */
      id: string;
      /** Set by `authGuard` once the access token is verified. */
      auth?: AuthPrincipal;
      /** Set by `loadUserOrg` / RBAC guards once (user, org, membership) is resolved. */
      authContext?: AuthContext;
    }
  }
}

export {};
