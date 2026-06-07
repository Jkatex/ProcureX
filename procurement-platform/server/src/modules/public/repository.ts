import { PublicPageKey, PublicPageStatus, type PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async latestPublishedPage(pageKey: PublicPageKey) {
    if (this.db === prisma && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured.');
    }

    return this.db.publicPageVersion.findFirst({
      where: {
        pageKey,
        status: PublicPageStatus.PUBLISHED,
        effectiveAt: {
          lte: new Date()
        }
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }
}
