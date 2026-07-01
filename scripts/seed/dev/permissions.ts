import { PrismaClient } from '@/generated/prisma/client';
import { ALL_PERMISSIONS } from '@/config/permissions';

/** Upserts the full permission catalog (defined in `src/config/permissions.ts`). */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, description: p.description },
      create: { code: p.code, module: p.module, description: p.description },
    });
  }
  console.log(`  ✓ ${ALL_PERMISSIONS.length} permissions`);
}
