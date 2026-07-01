import type { PrismaClient } from '@/generated/prisma/client';
import { ALL_PERMISSIONS, SYSTEM_ROLES } from '@/config/permissions';

/** Upserts the 5 system roles (Owner/Admin/Manager/Member/Cashier) and resets their grants. */
export async function seedRoles(prisma: PrismaClient): Promise<void> {
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
