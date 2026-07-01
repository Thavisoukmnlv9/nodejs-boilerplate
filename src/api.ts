import { Router } from 'express';
import { authRoutes } from '@/modules/auth/auth.routes';
import { meRoutes } from '@/modules/me/me.routes';
import { usersRoutes } from '@/modules/users/users.routes';
import { rolesRoutes } from '@/modules/roles/roles.routes';
import { organizationRoutes } from '@/modules/organizations/organization.routes';
import { filesRoutes } from '@/modules/files/files.routes';

/**
 * The /api/v1 surface. Each feature owns a Router; this file is the only place that
 * knows the URL layout. Adding a module = one `use()` line here + the module folder.
 */
export const apiV1Router = Router();

apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/me', meRoutes);
apiV1Router.use('/users', usersRoutes);
apiV1Router.use('/roles', rolesRoutes);
apiV1Router.use('/organizations', organizationRoutes);
apiV1Router.use('/files', filesRoutes);
