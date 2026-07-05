import { BRANCH_CURRENCIES, BRANCH_VERTICALS } from '@/modules/branches/branch.schema';
import { POLICY_EFFECTS } from '@/modules/policies/policy.schema';

/**
 * Server-authoritative catalog that powers the SPA's guided condition builder.
 * It mirrors the tiny condition DSL in `@/access/policy` (dot-path key → operator
 * → operand over `{ principal, resource }`), so the builder can only emit
 * conditions the evaluator actually understands. The stored `conditions` JSON
 * contract is unchanged — the builder is just a typed front-end for it.
 */

/** Operators supported by the matcher (`applyOperator` in access/policy.ts). */
export const POLICY_CONDITION_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'in', label: 'is one of' },
  { value: 'nin', label: 'is not one of' },
  { value: 'contains', label: 'contains' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'at most' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'at least' },
] as const;

export type ConditionFieldType = 'boolean' | 'string' | 'number' | 'enum' | 'string[]';

export interface ConditionField {
  /** Dot-path used as the condition key, e.g. `resource.is_main`. */
  path: string;
  label: string;
  type: ConditionFieldType;
  /** Allowed values for `enum` fields. */
  options?: readonly string[];
  /** Operator whitelist for this field; omitted = equality operators only. */
  operators?: readonly string[];
}

/** Attributes of the acting user — available on every subject. */
const PRINCIPAL_FIELDS: ConditionField[] = [
  { path: 'principal.isOwner', label: 'Acting user is owner', type: 'boolean' },
  { path: 'principal.roleId', label: "Acting user's role id", type: 'string' },
  { path: 'principal.branchIds', label: "Acting user's branch access", type: 'string[]', operators: ['contains'] },
];

/** Attributes of the resource under decision, keyed by policy subject. */
const SUBJECT_FIELDS: Record<string, ConditionField[]> = {
  Branch: [
    { path: 'resource.is_main', label: 'Is main branch', type: 'boolean' },
    { path: 'resource.is_active', label: 'Is active', type: 'boolean' },
    { path: 'resource.vertical', label: 'Vertical', type: 'enum', options: BRANCH_VERTICALS },
    { path: 'resource.currency_code', label: 'Currency', type: 'enum', options: BRANCH_CURRENCIES },
    { path: 'resource.code', label: 'Branch code', type: 'string' },
  ],
  User: [
    { path: 'resource.is_owner', label: 'Is owner', type: 'boolean' },
    { path: 'resource.status', label: 'Status', type: 'enum', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
  ],
  Role: [{ path: 'resource.is_system', label: 'Is system role', type: 'boolean' }],
  Policy: [{ path: 'resource.effect', label: 'Effect', type: 'enum', options: POLICY_EFFECTS }],
  Organization: [],
};

export const POLICY_CONDITION_SCHEMA = {
  operators: POLICY_CONDITION_OPERATORS,
  principal: PRINCIPAL_FIELDS,
  subjects: SUBJECT_FIELDS,
} as const;

export type PolicyConditionSchema = typeof POLICY_CONDITION_SCHEMA;
