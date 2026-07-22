/* Encapsulates support persistence queries so service logic does not depend on raw Prisma access patterns. */
import { AuditSeverity, SupportTicketStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  AddSupportTicketCommentInput,
  CreateSupportTicketInput,
  SupportTicketCommentDto,
  SupportTicketDto
} from './types.js';

const ticketInclude = {
  ownerUser: { select: { id: true, displayName: true } },
  ownerOrg: { select: { id: true, name: true } },
  comments: {
    include: {
      actorUser: { select: { id: true, displayName: true } }
    },
    orderBy: { createdAt: 'asc' as const }
  }
} satisfies Prisma.SupportTicketInclude;

type TicketRecord = Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }>;

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  listTickets(where: Prisma.SupportTicketWhereInput) {
    return this.db.supportTicket.findMany({
      where,
      include: ticketInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findTicket(id: string) {
    return this.db.supportTicket.findUnique({
      where: { id },
      include: ticketInclude
    });
  }

  createTicket(input: CreateSupportTicketInput & { ownerUserId: string; ownerOrgId?: string | null }) {
    return this.db.supportTicket.create({
      data: {
        ownerUserId: input.ownerUserId,
        ownerOrgId: input.ownerOrgId ?? null,
        subject: input.subject,
        category: input.category,
        priority: input.priority,
        description: input.description,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      },
      include: ticketInclude
    });
  }

  addComment(ticketId: string, input: AddSupportTicketCommentInput & { actorUserId?: string | null }) {
    return this.db.supportTicketComment.create({
      data: {
        ticketId,
        actorUserId: input.actorUserId ?? null,
        body: input.body,
        visibility: input.visibility ?? 'PUBLIC',
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      },
      include: {
        actorUser: { select: { id: true, displayName: true } }
      }
    });
  }

  touchTicket(id: string, status?: SupportTicketStatus) {
    const now = new Date();
    return this.db.supportTicket.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(status === SupportTicketStatus.RESOLVED ? { resolvedAt: now, closedAt: null } : {}),
        ...(status === SupportTicketStatus.CLOSED ? { closedAt: now } : {}),
        ...(status === SupportTicketStatus.OPEN ? { resolvedAt: null, closedAt: null } : {})
      },
      include: ticketInclude
    });
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

export function toTicketDto(ticket: TicketRecord): SupportTicketDto {
  return {
    id: ticket.id,
    ownerUserId: ticket.ownerUserId,
    ownerOrgId: ticket.ownerOrgId,
    ownerName: ticket.ownerUser.displayName,
    organizationName: ticket.ownerOrg?.name ?? null,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    description: ticket.description,
    payload: objectPayload(ticket.payload),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    comments: ticket.comments.map(toCommentDto)
  };
}

export function toCommentDto(comment: {
  id: string;
  ticketId: string;
  actorUserId: string | null;
  actorUser?: { displayName: string } | null;
  body: string;
  visibility: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): SupportTicketCommentDto {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    actorUserId: comment.actorUserId,
    actorName: comment.actorUser?.displayName ?? null,
    body: comment.body,
    visibility: comment.visibility,
    payload: objectPayload(comment.payload),
    createdAt: comment.createdAt.toISOString()
  };
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
