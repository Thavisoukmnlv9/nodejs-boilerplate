import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { MODULE_CODES } from '@/config/permissions';
import { seedPermissions } from './permissions';
import { seedRoles } from './roles';
import { seedUsers, DEMO_USERS } from './users';

/**
 * Dev seed: permission catalog → system roles + grants → demo users → 5 demo
 * organizations (each with a branch, a member, a session, an entitlement
 * override, and an uploaded file). Idempotent — safe to run repeatedly
 * (everything upserts on a natural or fixed key).
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface DemoOrgSeed {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  currency_code: string;
}

/** One demo org per catalog module (`MODULE_CODES` in `src/config/permissions.ts`) — keeps the branch's vertical tied to a real module instead of an ad-hoc label. */
const DEMO_ORGS: DemoOrgSeed[] = [
  { id: 'org_demo_shop', name: 'Demo Shop Co.', slug: 'demo', vertical: MODULE_CODES[0], currency_code: 'LAK' },
  { id: 'org_demo_foods', name: 'Acme Foods', slug: 'acme-foods', vertical: MODULE_CODES[1], currency_code: 'LAK' },
  { id: 'org_demo_clothing', name: 'Urban Thread', slug: 'urban-thread', vertical: MODULE_CODES[2], currency_code: 'THB' },
  { id: 'org_demo_ecommerce', name: 'North Mart Online', slug: 'north-mart', vertical: MODULE_CODES[4], currency_code: 'USD' },
  { id: 'org_demo_chat', name: 'ChatLine Support', slug: 'chatline', vertical: MODULE_CODES[6], currency_code: 'USD' },
];

async function seedOrganizationsAndBranches(): Promise<Map<string, { orgId: string; branchId: string }>> {
  const byOrgKey = new Map<string, { orgId: string; branchId: string }>();

  for (const o of DEMO_ORGS) {
    const org = await prisma.organization.upsert({
      where: { slug: o.slug },
      update: { name: o.name, currency_code: o.currency_code },
      create: { id: o.id, name: o.name, slug: o.slug, currency_code: o.currency_code, locale: 'lo-LA' },
    });

    const branch = await prisma.branch.upsert({
      where: { organization_id_code: { organization_id: org.id, code: 'MAIN' } },
      update: { name: `${o.name} — Main Branch`, vertical: o.vertical },
      create: {
        id: `branch_${o.slug}_main`,
        organization_id: org.id,
        code: 'MAIN',
        name: `${o.name} — Main Branch`,
        vertical: o.vertical,
        is_main: true,
      },
    });

    byOrgKey.set(o.slug, { orgId: org.id, branchId: branch.id });
  }

  console.log(`  ✓ ${DEMO_ORGS.length} organizations + branches`);
  return byOrgKey;
}

/** Every demo user joins `demo` (the first org) with their matching system role. */
async function seedMembers(demoOrg: { orgId: string; branchId: string }, idByEmail: Map<string, string>): Promise<void> {
  for (const u of DEMO_USERS) {
    const userId = idByEmail.get(u.email);
    if (!userId) continue;
    await prisma.organizationMember.upsert({
      where: { user_id_organization_id: { user_id: userId, organization_id: demoOrg.orgId } },
      update: { role_id: u.roleId, is_owner: u.roleId === 'role_owner', accepted_at: new Date() },
      create: {
        id: `member_${u.id}`,
        user_id: userId,
        organization_id: demoOrg.orgId,
        role_id: u.roleId,
        is_owner: u.roleId === 'role_owner',
        accepted_at: new Date(),
        branch_ids: [demoOrg.branchId],
        default_branch_id: demoOrg.branchId,
      },
    });
  }
  console.log(`  ✓ ${DEMO_USERS.length} organization members`);
}

/** One active session per demo user, scoped to the demo org. */
async function seedSessions(demoOrgId: string, idByEmail: Map<string, string>): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  for (const u of DEMO_USERS) {
    const userId = idByEmail.get(u.email);
    if (!userId) continue;
    await prisma.session.upsert({
      where: { id: `session_${u.id}` },
      update: { expires_at: expiresAt },
      create: {
        id: `session_${u.id}`,
        user_id: userId,
        organization_id: demoOrgId,
        refresh_token_hash: `seed-placeholder-${u.id}`,
        expires_at: expiresAt,
        device_info: 'Seed script',
        ip_address: '127.0.0.1',
      },
    });
  }
  console.log(`  ✓ ${DEMO_USERS.length} sessions`);
}

/** One entitlement override per demo org, showing the feature/module/limit kinds. */
async function seedEntitlementOverrides(orgIds: Map<string, { orgId: string; branchId: string }>): Promise<void> {
  const overrides: { slug: string; kind: string; code: string; enabled?: boolean; limit_value?: number }[] = [
    { slug: 'demo', kind: 'feature', code: 'advanced_reports', enabled: true },
    { slug: 'acme-foods', kind: 'module', code: MODULE_CODES[1], enabled: true },
    { slug: 'urban-thread', kind: 'limit', code: 'max_branches', limit_value: 10 },
    { slug: 'north-mart', kind: 'feature', code: 'ecommerce_reviews', enabled: true },
    { slug: 'chatline', kind: 'limit', code: 'max_agents', limit_value: 25 },
  ];

  for (const o of overrides) {
    const org = orgIds.get(o.slug);
    if (!org) continue;
    await prisma.entitlementOverride.upsert({
      where: { organization_id_kind_code: { organization_id: org.orgId, kind: o.kind, code: o.code } },
      update: { enabled: o.enabled ?? null, limit_value: o.limit_value ?? null },
      create: {
        id: `entitlement_${o.slug}_${o.code}`,
        organization_id: org.orgId,
        kind: o.kind,
        code: o.code,
        enabled: o.enabled ?? null,
        limit_value: o.limit_value ?? null,
        reason: 'Seeded demo override',
      },
    });
  }
  console.log(`  ✓ ${overrides.length} entitlement overrides`);
}

/** One uploaded file per demo org, attributed to the demo owner. */
async function seedFiles(orgIds: Map<string, { orgId: string; branchId: string }>, ownerId: string): Promise<void> {
  let count = 0;
  for (const o of DEMO_ORGS) {
    const org = orgIds.get(o.slug);
    if (!org) continue;
    await prisma.file.upsert({
      where: { id: `file_${o.slug}_logo` },
      update: {},
      create: {
        id: `file_${o.slug}_logo`,
        organization_id: org.orgId,
        bucket: 'demo-bucket',
        key: `orgs/${o.slug}/logo.png`,
        filename: 'logo.png',
        content_type: 'image/png',
        size_bytes: 2048,
        uploaded_by_id: ownerId,
      },
    });
    count += 1;
  }
  console.log(`  ✓ ${count} files`);
}

async function main(): Promise<void> {
  console.log('Seeding (dev)…');
  await seedPermissions(prisma);
  await seedRoles(prisma);
  const idByEmail = await seedUsers(prisma);

  const orgIds = await seedOrganizationsAndBranches();
  const demoOrg = orgIds.get('demo');
  if (!demoOrg) throw new Error('demo organization was not seeded');

  const ownerId = idByEmail.get('owner@demo.test');
  if (!ownerId) throw new Error('demo owner user was not seeded');

  await seedMembers(demoOrg, idByEmail);
  await seedSessions(demoOrg.orgId, idByEmail);
  await seedEntitlementOverrides(orgIds);
  await seedFiles(orgIds, ownerId);

  console.log('Seed complete. Demo logins (password: Password123): owner@demo.test, admin@demo.test, manager@demo.test, member@demo.test, cashier@demo.test');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
