import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@/config/permissions';

/**
 * Prod seed: permission catalog + system roles only — the platform config every
 * environment needs. Deliberately does NOT create demo users/organizations
 * (unlike dev/uat); production accounts are created through normal signup.
 * Idempotent — safe to run repeatedly.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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

async function main(): Promise<void> {
  console.log('Seeding (prod)…');
  await seedPermissions();
  await seedRoles();
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
