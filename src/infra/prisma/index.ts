export { prisma, connectPrisma, disconnectPrisma, checkDatabase } from '@/infra/prisma/client';
export { BaseRepository } from '@/infra/prisma/base.repository';
export { withTransaction } from '@/infra/prisma/transaction';
