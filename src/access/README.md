# `src/access` — access-control library

A self-contained, portable authorization toolkit: authentication (JWT), RBAC
(role → permission codes), branch scope (multi-branch data isolation), and a
stored **ABAC policy layer**. App code imports only from `@/access`.

## Model

Authorization is one decision seam — `can()` — layering three checks:

1. **Policy (ABAC)** — stored `Policy` rows matched by `action` + `subject`, with
   attribute `conditions` over `{ principal, resource }`. **DENY wins**; an ALLOW
   can grant beyond the role. Owners are *not* exempt from an explicit DENY.
2. **Branch scope** — non-owners may only touch branches assigned to their
   membership (`resolveBranchWhere` clamps list queries; `can({ branchId })` gates
   point access). Owners are unscoped.
3. **RBAC** — the member's role must hold the permission code. Owners hold all.

## On a route

```ts
import { authGuard, requirePermission, requirePolicy, getBranchScope, resolveBranchWhere } from '@/access';

// RBAC gate
router.post('/roles', authGuard, requirePermission('platform.roles.manage'), asyncHandler(ctrl.create));

// ABAC point check (loads the resource, evaluates policies + branch scope)
router.delete('/branches/:id', authGuard, requirePolicy('delete', 'Branch', (req) => branchRepo.findById(req.params.id)), asyncHandler(ctrl.remove));

// Branch-scoped list
const scope = await getBranchScope(req);
const branchWhere = resolveBranchWhere(req.query.branch_id as string | undefined, scope);
```

## Adopting in another Express app

Everything here is app-agnostic except `instance.ts`. Provide three deps and you
get the whole toolkit:

```ts
import { createAccessControl } from '@/access';

export const accessControl = createAccessControl({
  loadContext,        // (userId, orgId) => { user, organization, membership(+branch_access) }
  resolvePermissions, // (roleId) => string[]  — the codes the role grants
  loadPolicies,       // (orgId, roleId) => PolicyRule[]  — org-wide + role policies
});
```

Permission-catalog *content* lives in `src/config/permissions.ts` (via
`definePermissionCatalog`); the mechanics live here. Swap `policy.ts` for
`@casl/ability` + `@casl/prisma` if you outgrow the built-in evaluator — nothing
else changes.
