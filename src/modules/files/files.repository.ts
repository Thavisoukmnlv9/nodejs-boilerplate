import type { Prisma } from '@/generated/prisma/client';
import { BaseRepository } from '@/infra/prisma';

export class FilesRepository extends BaseRepository {
  create(data: Prisma.FileUncheckedCreateInput) {
    return this.db.file.create({ data });
  }

  findById(organizationId: string, id: string) {
    return this.db.file.findFirst({
      where: { id, organization_id: organizationId, ...this.notDeleted },
    });
  }
}

export const filesRepository = new FilesRepository();
