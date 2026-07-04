import type { PolicyRule, PrincipalAttrs } from './types';

/**
 * Stored-policy (ABAC) evaluator.
 *
 * A `Policy` refines the coarse RBAC permission-code gate with rules over
 * attributes of the caller (`principal`) and the resource under decision
 * (`resource`). Rules are matched by `action` + `subject` (with `*` wildcards),
 * then their `conditions` are checked against the eval context. **DENY wins**: a
 * single matching DENY overrides every ALLOW.
 *
 * Condition DSL (JSON), intentionally tiny and greppable:
 *   { "resource.branch_id": { "in": { "var": "principal.branchIds" } },
 *     "resource.organization_id": { "eq": { "var": "principal.organizationId" } },
 *     "resource.total_cents": { "lte": 100000 } }
 * Each key is a dot-path into `{ principal, resource }`. Each value is a literal
 * (implicit `eq`) or an operator object. An operand may be a literal or
 * `{ "var": "<path>" }` resolved from the context. All entries AND together;
 * null/empty conditions always match. Swap this file for `@casl/ability` +
 * `@casl/prisma` if you outgrow it — nothing else in the library changes.
 */

export interface PolicyEvalContext {
  principal: PrincipalAttrs;
  resource?: Record<string, unknown> | null;
}

const OPERATORS = ['eq', 'ne', 'in', 'nin', 'lt', 'lte', 'gt', 'gte', 'contains'] as const;
type Operator = (typeof OPERATORS)[number];

function resolvePath(path: string, ctx: PolicyEvalContext): unknown {
  const parts = path.split('.');
  let cursor: unknown = ctx;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

/** A `{ var: "path" }` reference resolves from context; anything else is a literal. */
function resolveOperand(operand: unknown, ctx: PolicyEvalContext): unknown {
  if (operand && typeof operand === 'object' && 'var' in operand) {
    const ref = (operand as { var: unknown }).var;
    return typeof ref === 'string' ? resolvePath(ref, ctx) : undefined;
  }
  return operand;
}

function applyOperator(op: Operator, left: unknown, right: unknown): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'in':
      return Array.isArray(right) && right.includes(left as never);
    case 'nin':
      return Array.isArray(right) && !right.includes(left as never);
    case 'contains':
      return Array.isArray(left) && left.includes(right as never);
    case 'lt':
      return typeof left === 'number' && typeof right === 'number' && left < right;
    case 'lte':
      return typeof left === 'number' && typeof right === 'number' && left <= right;
    case 'gt':
      return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'gte':
      return typeof left === 'number' && typeof right === 'number' && left >= right;
    default:
      return false;
  }
}

/** Evaluate one condition entry (`left` = value at the key path). */
function matchEntry(keyValue: unknown, matcher: unknown, ctx: PolicyEvalContext): boolean {
  // Operator object, e.g. { in: {var:'principal.branchIds'} } or { lte: 100000 }.
  if (matcher && typeof matcher === 'object' && !Array.isArray(matcher)) {
    const entries = Object.entries(matcher as Record<string, unknown>);
    // A `{ var: ... }` on its own is an implicit `eq`.
    if (entries.length === 1 && entries[0]?.[0] === 'var') {
      return keyValue === resolveOperand(matcher, ctx);
    }
    return entries.every(([op, operand]) => {
      if (!OPERATORS.includes(op as Operator)) return false;
      return applyOperator(op as Operator, keyValue, resolveOperand(operand, ctx));
    });
  }
  // Bare literal → implicit eq.
  return keyValue === matcher;
}

/** All conditions must hold (AND). `null`/`{}` → always matches. */
export function matchConditions(conditions: unknown, ctx: PolicyEvalContext): boolean {
  if (conditions == null) return true;
  if (typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  return Object.entries(conditions as Record<string, unknown>).every(([path, matcher]) =>
    matchEntry(resolvePath(path, ctx), matcher, ctx),
  );
}

function ruleMatchesTarget(rule: PolicyRule, action: string, subject: string): boolean {
  const actionOk = rule.action === '*' || rule.action === action;
  const subjectOk = rule.subject === '*' || rule.subject === subject;
  return actionOk && subjectOk;
}

export interface PolicyOutcome {
  /** true = an ALLOW matched; false = a DENY matched (wins); null = no policy applies. */
  allowed: boolean | null;
}

/**
 * Evaluate all applicable policies for one (action, subject). DENY-wins: if any
 * matching rule denies, the outcome is `false` regardless of ALLOWs. Otherwise
 * `true` if any ALLOW matched, else `null` (no opinion — defer to RBAC).
 */
export function evaluatePolicies(
  policies: readonly PolicyRule[],
  action: string,
  subject: string,
  ctx: PolicyEvalContext,
): PolicyOutcome {
  let sawAllow = false;
  for (const rule of policies) {
    if (!ruleMatchesTarget(rule, action, subject)) continue;
    if (!matchConditions(rule.conditions, ctx)) continue;
    if (rule.effect === 'DENY') return { allowed: false }; // DENY wins immediately
    sawAllow = true;
  }
  return { allowed: sawAllow ? true : null };
}
