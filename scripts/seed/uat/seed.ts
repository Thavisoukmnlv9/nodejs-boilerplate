import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { hashPassword } from '@/common/utils/password';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@/config/permissions';

/**
 * UAT seed: shared permission catalog + system roles (same source of truth as
 * dev/prod), plus a single QA organization with 5 test users — one per system
 * role — for acceptance testing. Idempotent — safe to run repeatedly.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const UAT_PASSWORD = 'UatPassword123!';

const UAT_USERS = [
  { id: 'user_uat_owner', email: 'owner@uat.test', name: 'UAT Owner', roleId: 'role_owner' },
  { id: 'user_uat_admin', email: 'admin@uat.test', name: 'UAT Admin', roleId: 'role_admin' },
  { id: 'user_uat_manager', email: 'manager@uat.test', name: 'UAT Manager', roleId: 'role_manager' },
  { id: 'user_uat_member', email: 'member@uat.test', name: 'UAT Member', roleId: 'role_member' },
  { id: 'user_uat_cashier', email: 'cashier@uat.test', name: 'UAT Cashier', roleId: 'role_cashier' },
] as const;

async function seedPermissions(): Promise<void> {
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, description: p.description },
      create: { code: p.code, module: p.module, description: p.description },
    });
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`);
}

async function seedRoles(): Promise<void> {
  const perms = await prisma.permission.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(perms.map((p) => [p.code, p.id] as const));

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name, description: role.description, is_system: true, organization_id: null },
      create: { id: role.id, name: role.name, description: role.description, is_system: true },
    });

    const codes = role.grants === 'ALL' ? ALL_PERMISSIONS.map((p) => p.code) : role.grants;
    const permissionIds = codes.map((c) => idByCode.get(c)).filter((v): v is string => Boolean(v));

    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permission_id) => ({ role_id: role.id, permission_id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  ✓ ${SYSTEM_ROLES.length} system roles + grants`);
}

async function seedQaOrg(): Promise<void> {
  const password = await hashPassword(UAT_PASSWORD);

  const org = await prisma.organization.upsert({
    where: { slug: 'uat-qa' },
    update: {},
    create: { id: 'org_uat_qa', name: 'UAT QA Org', slug: 'uat-qa', currency_code: 'LAK', locale: 'lo-LA' },
  });

  const branch = await prisma.branch.upsert({
    where: { organization_id_code: { organization_id: org.id, code: 'MAIN' } },
    update: {},
    create: { id: 'branch_uat_qa_main', organization_id: org.id, code: 'MAIN', name: 'QA Main Branch', vertical: 'shop', is_main: true },
  });

  for (const u of UAT_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { id: u.id, email: u.email, name: u.name, password_hash: password, status: 'ACTIVE' },
    });

    const member = await prisma.organizationMember.upsert({
      where: { user_id_organization_id: { user_id: u.id, organization_id: org.id } },
      update: { role_id: u.roleId, is_owner: u.roleId === 'role_owner', accepted_at: new Date(), default_branch_id: branch.id },
      create: {
        id: `member_${u.id}`,
        user_id: u.id,
        organization_id: org.id,
        role_id: u.roleId,
        is_owner: u.roleId === 'role_owner',
        accepted_at: new Date(),
        default_branch_id: branch.id,
      },
    });
    await prisma.memberBranchAccess.upsert({
      where: { member_id_branch_id: { member_id: member.id, branch_id: branch.id } },
      update: {},
      create: { member_id: member.id, branch_id: branch.id },
    });

    await prisma.session.upsert({
      where: { id: `session_${u.id}` },
      update: {},
      create: {
        id: `session_${u.id}`,
        user_id: u.id,
        organization_id: org.id,
        refresh_token_hash: `seed-placeholder-${u.id}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        device_info: 'Seed script',
      },
    });
  }

  await prisma.entitlementOverride.upsert({
    where: { organization_id_kind_code: { organization_id: org.id, kind: 'feature', code: 'advanced_reports' } },
    update: {},
    create: {
      id: 'entitlement_uat_qa_advanced_reports',
      organization_id: org.id,
      kind: 'feature',
      code: 'advanced_reports',
      enabled: true,
      reason: 'Seeded UAT override',
    },
  });

  await prisma.file.upsert({
    where: { id: 'file_uat_qa_logo' },
    update: {},
    create: {
      id: 'file_uat_qa_logo',
      organization_id: org.id,
      bucket: 'uat-bucket',
      key: 'orgs/uat-qa/logo.png',
      filename: 'logo.png',
      content_type: 'image/png',
      size_bytes: 2048,
      uploaded_by_id: 'user_uat_owner',
    },
  });

  console.log(`  ✓ UAT QA org, ${UAT_USERS.length} users/members/sessions, 1 entitlement override, 1 file`);
}

async function main(): Promise<void> {
  console.log('Seeding (uat)…');
  await seedPermissions();
  await seedRoles();
  await seedQaOrg();
  console.log(`Seed complete. UAT logins (password: ${UAT_PASSWORD}): ${UAT_USERS.map((u) => u.email).join(', ')}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
