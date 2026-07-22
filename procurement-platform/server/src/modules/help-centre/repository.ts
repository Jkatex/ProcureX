/* Encapsulates help centre persistence queries so service logic does not depend on raw Prisma access patterns. */
import { AuditSeverity, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  createAuditEvent(input: {
    actorUserId?: string | null;
    ownerOrgId?: string | null;
    event: string;
    entityType: string;
    entityRef?: string | null;
    severity?: AuditSeverity;
    payload?: Prisma.InputJsonObject;
  }) {
    return this.db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        ownerOrgId: input.ownerOrgId,
        event: input.event,
        entityType: input.entityType,
        entityRef: input.entityRef,
        severity: input.severity ?? AuditSeverity.INFO,
        payload: input.payload ?? {}
      }
    });
  }
}

