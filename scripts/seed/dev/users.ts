import type { PrismaClient } from '@/generated/prisma/client';
import { hashPassword } from '@/common/utils/password';

export interface DemoUserSeed {
  id: string;
  email: string;
  name: string;
  /** System role id (from `SYSTEM_ROLES` in `src/config/permissions.ts`) this user demos. */
  roleId: string;
}

/** One user per system role, so every role has a login to exercise it with. */
export const DEMO_USERS: DemoUserSeed[] = [
  { id: 'user_demo_owner', email: 'owner@demo.test', name: 'Demo Owner', roleId: 'role_owner' },
  { id: 'user_demo_admin', email: 'admin@demo.test', name: 'Demo Admin', roleId: 'role_admin' },
  { id: 'user_demo_manager', email: 'manager@demo.test', name: 'Demo Manager', roleId: 'role_manager' },
  { id: 'user_demo_member', email: 'member@demo.test', name: 'Demo Member', roleId: 'role_member' },
  { id: 'user_demo_cashier', email: 'cashier@demo.test', name: 'Demo Cashier', roleId: 'role_cashier' },
];

export const DEMO_PASSWORD = 'Password123';

/**
 * Upserts the 5 demo users (one per system role), all sharing `DEMO_PASSWORD`.
 * Returns the actual persisted id per user (upsert-by-email keeps whatever id a
 * pre-existing row already has, which may not match `DemoUserSeed.id`).
 */
export async function seedUsers(prisma: PrismaClient): Promise<Map<string, string>> {
  const password = await hashPassword(DEMO_PASSWORD);
  const idByEmail = new Map<string, string>();

  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { id: u.id, email: u.email, name: u.name, password_hash: password, status: 'ACTIVE' },
    });
    idByEmail.set(u.email, row.id);
  }
  console.log(`  ✓ ${DEMO_USERS.length} demo users (password: ${DEMO_PASSWORD})`);
  return idByEmail;
}
