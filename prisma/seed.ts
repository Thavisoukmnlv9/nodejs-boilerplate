import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/common/utils/password';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@/config/permissions';

/**
 * Idempotent seed: permission catalog → system roles + grants → plans → a demo org
 * (owner + member, one branch, an active `pro` subscription enabling pos_shop +
 * inventory). Safe to run repeatedly (everything upserts on a natural key).
 */
const prisma = new PrismaClient();

const PLANS = [
  { slug: 'starter', name: 'Starter', modules: ['pos_shop', 'pos_food_service', 'pos_clothing', 'inventory'], limits: { max_branches: 1, max_users: 3 } },
  { slug: 'growth', name: 'Growth', modules: ['pos_shop', 'pos_food_service', 'pos_clothing', 'inventory', 'chat_manager'], limits: { max_branches: 3, max_users: 10 } },
  { slug: 'pro', name: 'Pro', modules: ['pos_shop', 'pos_food_service', 'pos_clothing', 'inventory', 'chat_manager', 'ecommerce', 'ads_manager'], limits: { max_branches: 10, max_users: 30 } },
  { slug: 'enterprise', name: 'Enterprise', modules: ['pos_shop', 'pos_food_service', 'pos_clothing', 'inventory', 'chat_manager', 'ecommerce', 'ads_manager'], limits: {} as Record<string, number> },
];

const ALL_MODULE_CODES = ['pos_shop', 'pos_food_service', 'pos_clothing', 'inventory', 'ecommerce', 'ads_manager', 'chat_manager'];

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

    // Reset grants → desired set (idempotent).
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

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    const record = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name },
      create: { slug: plan.slug, name: plan.name, billing_interval: 'MONTHLY', is_active: true },
    });
    for (const code of ALL_MODULE_CODES) {
      await prisma.planModule.upsert({
        where: { plan_id_module_code: { plan_id: record.id, module_code: code } },
        update: { included: plan.modules.includes(code) },
        create: { plan_id: record.id, module_code: code, included: plan.modules.includes(code) },
      });
    }
    for (const [key, value] of Object.entries(plan.limits)) {
      await prisma.planLimit.upsert({
        where: { plan_id_limit_key: { plan_id: record.id, limit_key: key } },
        update: { limit_value: value },
        create: { plan_id: record.id, limit_key: key, limit_value: value },
      });
    }
  }
  console.log(`  ✓ ${PLANS.length} plans`);
}

async function seedDemo(): Promise<void> {
  const password = await hashPassword('Password123');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Company', slug: 'demo', currency_code: 'LAK', locale: 'lo-LA' },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.test' },
    update: {},
    create: { email: 'owner@demo.test', name: 'Demo Owner', password_hash: password, status: 'ACTIVE' },
  });
  const member = await prisma.user.upsert({
    where: { email: 'member@demo.test' },
    update: {},
    create: { email: 'member@demo.test', name: 'Demo Member', password_hash: password, status: 'ACTIVE' },
  });

  const branch = await prisma.branch.upsert({
    where: { organization_id_code: { organization_id: org.id, code: 'MAIN' } },
    update: {},
    create: { organization_id: org.id, code: 'MAIN', name: 'Main Branch', vertical: 'shop', is_main: true },
  });

  await prisma.organizationMember.upsert({
    where: { user_id_organization_id: { user_id: owner.id, organization_id: org.id } },
    update: { role_id: 'role_owner', is_owner: true, accepted_at: new Date() },
    create: {
      user_id: owner.id,
      organization_id: org.id,
      role_id: 'role_owner',
      is_owner: true,
      accepted_at: new Date(),
      branch_ids: [branch.id],
      default_branch_id: branch.id,
    },
  });
  await prisma.organizationMember.upsert({
    where: { user_id_organization_id: { user_id: member.id, organization_id: org.id } },
    update: { role_id: 'role_member', accepted_at: new Date() },
    create: {
      user_id: member.id,
      organization_id: org.id,
      role_id: 'role_member',
      accepted_at: new Date(),
      branch_ids: [branch.id],
      default_branch_id: branch.id,
    },
  });

  const proPlan = await prisma.plan.findUnique({ where: { slug: 'pro' } });
  const sub = await prisma.organizationSubscription.upsert({
    where: { organization_id: org.id },
    update: { status: 'ACTIVE', plan_id: proPlan?.id },
    create: {
      organization_id: org.id,
      plan_id: proPlan?.id,
      status: 'ACTIVE',
      billing_interval: 'MONTHLY',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  for (const code of ['pos_shop', 'inventory', 'pos_food_service']) {
    await prisma.subscriptionModule.upsert({
      where: { organization_subscription_id_module_code: { organization_subscription_id: sub.id, module_code: code } },
      update: { enabled: true },
      create: { organization_subscription_id: sub.id, module_code: code, enabled: true },
    });
  }
  console.log('  ✓ demo org (owner@demo.test / member@demo.test — password: Password123)');
}

async function main(): Promise<void> {
  console.log('Seeding…');
  await seedPermissions();
  await seedRoles();
  await seedPlans();
  await seedDemo();
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
