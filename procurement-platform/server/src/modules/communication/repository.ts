import { randomUUID } from 'node:crypto';
import {
  AuditSeverity,
  CommunicationKind,
  CommunicationPriority,
  CommunicationStatus,
  OrganizationCapabilityName,
  OrganizationKind,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  CommunicationAttachmentDto,
  CommunicationCountsDto,
  CommunicationListDto,
  CommunicationMessageDto,
  CommunicationQuery,
  CommunicationRecipientDto,
  CommunicationTenderLinkDto,
  CommunicationThreadEntryDto,
  ComposeMessageInput,
  ComposeMessageResultDto,
  PatchMessageInput,
  ReplyMessageInput
} from './types.js';

const communicationInclude = {
  ownerOrg: { select: { id: true, name: true } },
  senderOrg: { select: { id: true, name: true } },
  recipientOrg: { select: { id: true, name: true } },
  tender: { select: { id: true, reference: true, title: true } },
  attachments: {
    include: {
      document: {
        select: {
          id: true,
          name: true,
          documentType: true,
          objectKey: true,
          checksum: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  }
} satisfies Prisma.CommunicationItemInclude;

type CommunicationRecord = Prisma.CommunicationItemGetPayload<{ include: typeof communicationInclude }>;
type DbClient = PrismaClient | Prisma.TransactionClient;
type PayloadObject = Record<string, unknown>;

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async listMessages(query: CommunicationQuery): Promise<CommunicationListDto> {
    const where = messageWhere(query);
    const [messages, totalMessages, counts] = await Promise.all([
      this.db.communicationItem.findMany({
        where,
        include: communicationInclude,
        orderBy: orderBy(query),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.db.communicationItem.count({ where }),
      this.counts(query.organizationId)
    ]);

    return {
      messages: messages.map(toDto),
      counts,
      totalMessages,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(totalMessages / query.pageSize))
    };
  }

  async getMessage(messageId: string): Promise<CommunicationMessageDto | null> {
    const message = await this.db.communicationItem.findUnique({
      where: { id: messageId },
      include: communicationInclude
    });

    return message ? toDto(message) : null;
  }

  async createMessage(input: ComposeMessageInput): Promise<ComposeMessageResultDto> {
    const conversationId = `conversation-${randomUUID()}`;
    const contextKey = input.tenderId ? `tender:${input.tenderId}` : conversationId;
    const basePayload = buildPayload({
      conversationId,
      contextKey,
      metadata: input.metadata,
      thread: [
        {
          senderOrgId: input.senderOrgId,
          senderName: null,
          body: input.body,
          notice: null,
          createdAt: new Date().toISOString()
        }
      ]
    });

    const records = await this.db.$transaction(async (tx) => {
      const created: CommunicationRecord[] = [];
      const senderCopy = await createMessageCopy(tx, input, {
        ownerOrgId: input.ownerOrgId ?? input.senderOrgId,
        folder: 'sent',
        status: CommunicationStatus.READ,
        read: true,
        payload: { ...basePayload, deliveryRole: 'sender' }
      });
      created.push(senderCopy);

      if (input.recipientOrgId && input.recipientOrgId !== input.senderOrgId) {
        const recipientCopy = await createMessageCopy(tx, input, {
          ownerOrgId: input.recipientOrgId,
          folder: 'inbox',
          status: input.actionRequired ? CommunicationStatus.ACTION_REQUIRED : CommunicationStatus.UNREAD,
          read: false,
          payload: { ...basePayload, deliveryRole: 'recipient', senderCopyId: senderCopy.id }
        });
        created.push(recipientCopy);
      }

      return created;
    });

    return {
      message: toDto(records[0]),
      deliveries: records.map(toDto)
    };
  }

  async reply(messageId: string, input: ReplyMessageInput): Promise<ComposeMessageResultDto | null> {
    const original = await this.db.communicationItem.findUnique({
      where: { id: messageId },
      include: communicationInclude
    });
    if (!original) return null;

    const originalPayload = payloadObject(original.payload);
    const conversationId = stringPayload(originalPayload.conversationId) ?? `conversation-${randomUUID()}`;
    const contextKey = stringPayload(originalPayload.contextKey) ?? (original.tenderId ? `tender:${original.tenderId}` : conversationId);
    const senderOrgId = input.senderOrgId ?? original.ownerOrgId ?? original.recipientOrgId ?? original.senderOrgId;
    if (!senderOrgId) throw new Error('A reply needs a sender organization.');

    const recipientOrgId = input.recipientOrgId ?? otherParty(original, senderOrgId);
    if (!recipientOrgId) throw new Error('A reply needs a recipient organization.');
    const replyInput: ComposeMessageInput = {
      senderOrgId,
      recipientOrgId,
      tenderId: original.tenderId ?? undefined,
      kind: original.kind,
      category: original.category,
      subject: prefixReplySubject(original.subject),
      body: input.body,
      priority: input.priority ?? original.priority,
      visibility: input.visibility ?? original.visibility ?? undefined,
      actionRequired: false,
      attachments: input.attachments,
      metadata: {
        ...input.metadata,
        relatedMessageId: original.id,
        conversationId,
        contextKey
      }
    };

    const result = await this.db.$transaction(async (tx) => {
      const records: CommunicationRecord[] = [];
      const thread = [
        ...threadEntries(originalPayload),
        {
          senderOrgId,
          senderName: null,
          body: input.body,
          notice: input.visibility ?? null,
          createdAt: new Date().toISOString()
        }
      ];
      const replyPayload = buildPayload({
        relatedMessageId: original.id,
        conversationId,
        contextKey,
        metadata: input.metadata,
        thread
      });

      const senderCopy = await createMessageCopy(tx, replyInput, {
        ownerOrgId: senderOrgId,
        folder: 'sent',
        status: CommunicationStatus.READ,
        read: true,
        payload: { ...replyPayload, deliveryRole: 'sender' }
      });
      records.push(senderCopy);

      if (recipientOrgId && recipientOrgId !== senderOrgId) {
        const recipientCopy = await createMessageCopy(tx, replyInput, {
          ownerOrgId: recipientOrgId,
          folder: 'inbox',
          status: CommunicationStatus.UNREAD,
          read: false,
          payload: { ...replyPayload, deliveryRole: 'recipient', senderCopyId: senderCopy.id }
        });
        records.push(recipientCopy);
      }

      await tx.communicationItem.update({
        where: { id: original.id },
        data: {
          status: CommunicationStatus.REPLIED,
          read: true,
          actionRequired: false,
          payload: {
            ...originalPayload,
            conversationId,
            contextKey,
            thread,
            lastReplyId: senderCopy.id
          } as Prisma.InputJsonObject
        }
      });

      return records;
    });

    await this.recordCommunicationAudit(original.ownerOrgId, original.id, 'communication.message.replied', {
      replies: result.map((item) => item.id)
    });

    return {
      message: toDto(result[0]),
      deliveries: result.map(toDto)
    };
  }

  async patchMessage(messageId: string, input: PatchMessageInput): Promise<CommunicationMessageDto | null> {
    const existing = await this.db.communicationItem.findUnique({
      where: { id: messageId },
      include: communicationInclude
    });
    if (!existing) return null;

    const payload = payloadObject(existing.payload);
    const nextPayload =
      input.metadata === undefined
        ? payload
        : {
            ...payload,
            metadata: {
              ...objectPayload(payload.metadata),
              ...input.metadata
            }
          };

    const status = deriveStatus(input, existing.status);
    const folder = deriveFolder(input, existing.folder, status);
    const read = input.read ?? (status === CommunicationStatus.UNREAD ? false : existing.read || status === CommunicationStatus.READ);

    const updated = await this.db.communicationItem.update({
      where: { id: messageId },
      data: {
        ...(input.folder !== undefined || folder !== existing.folder ? { folder } : {}),
        ...(status !== existing.status ? { status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.read !== undefined || read !== existing.read ? { read } : {}),
        ...(input.actionRequired !== undefined ? { actionRequired: input.actionRequired } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.metadata !== undefined ? { payload: nextPayload as Prisma.InputJsonObject } : {})
      },
      include: communicationInclude
    });

    if (updated.read && !existing.read) {
      await this.recordCommunicationAudit(updated.ownerOrgId, updated.id, 'communication.message.read');
    }
    if (updated.status === CommunicationStatus.ARCHIVED && existing.status !== CommunicationStatus.ARCHIVED) {
      await this.recordCommunicationAudit(updated.ownerOrgId, updated.id, 'communication.message.archived');
    }
    if (updated.status === CommunicationStatus.DELETED && existing.status !== CommunicationStatus.DELETED) {
      await this.recordCommunicationAudit(updated.ownerOrgId, updated.id, 'communication.message.deleted');
    }

    return toDto(updated);
  }

  async markRead(messageId: string): Promise<CommunicationMessageDto | null> {
    const existing = await this.db.communicationItem.findUnique({
      where: { id: messageId },
      select: { status: true, read: true }
    });
    if (!existing) return null;

    const updated = await this.db.communicationItem.update({
      where: { id: messageId },
      data: {
        read: true,
        status: existing.status === CommunicationStatus.UNREAD ? CommunicationStatus.READ : existing.status
      },
      include: communicationInclude
    });

    if (!existing.read) {
      await this.recordCommunicationAudit(updated.ownerOrgId, updated.id, 'communication.message.read');
    }

    return toDto(updated);
  }

  async archive(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.patchMessage(messageId, {
      folder: 'archived',
      status: CommunicationStatus.ARCHIVED,
      read: true,
      actionRequired: false
    });
  }

  async softDelete(messageId: string): Promise<CommunicationMessageDto | null> {
    return this.patchMessage(messageId, {
      folder: 'trash',
      status: CommunicationStatus.DELETED,
      read: true,
      actionRequired: false
    });
  }

  private async recordCommunicationAudit(ownerOrgId: string | null, messageId: string, event: string, payload: Prisma.InputJsonObject = {}) {
    await this.db.auditEvent.create({
      data: {
        ownerOrgId,
        event,
        entityType: 'communication_item',
        entityRef: messageId,
        severity: AuditSeverity.INFO,
        payload
      }
    });
  }

  async listRecipients(input: { search: string; capability?: 'BUYER' | 'SUPPLIER'; pageSize: number }): Promise<CommunicationRecipientDto[]> {
    const search = input.search.trim();
    const normalizedSearch = search.toLowerCase();
    const adminAliasMatches = Boolean(search) && ['admin', 'administration', 'platform', 'procurex'].some((alias) => alias.includes(normalizedSearch));
    const organizations = await this.db.organization.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                ...(adminAliasMatches ? [{ kind: OrganizationKind.PLATFORM }] : [])
              ]
            }
          : {}),
        ...(input.capability
          ? {
              capabilities: {
                some: {
                  capability: input.capability as OrganizationCapabilityName,
                  enabled: true
                }
              }
            }
          : {})
      },
      include: {
        capabilities: {
          where: { enabled: true },
          select: { capability: true }
        }
      },
      orderBy: { name: 'asc' },
      take: input.pageSize
    });

    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.kind === OrganizationKind.PLATFORM ? 'Admin' : organization.name,
      kind: organization.kind,
      country: organization.country,
      capabilities: organization.capabilities.map((item) => item.capability)
    }));
  }

  async listTenderLinks(input: { search: string; organizationId: string; pageSize: number }): Promise<CommunicationTenderLinkDto[]> {
    const tenders = await this.db.tender.findMany({
      where: andTenderWhere([
        input.organizationId
          ? {
              OR: [{ buyerOrgId: input.organizationId }, { bids: { some: { supplierOrgId: input.organizationId } } }]
            }
          : {},
        input.search
          ? {
              OR: [
                { reference: { contains: input.search, mode: 'insensitive' } },
                { title: { contains: input.search, mode: 'insensitive' } },
                { buyerOrg: { name: { contains: input.search, mode: 'insensitive' } } }
              ]
            }
          : {}
      ]),
      include: {
        buyerOrg: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: input.pageSize
    });

    return tenders.map((tender) => ({
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      buyerName: tender.buyerOrg.name,
      status: tender.status
    }));
  }

  private async counts(organizationId: string): Promise<CommunicationCountsDto> {
    const base = organizationScope(organizationId);
    const [total, inbox, sent, drafts, archived, trash, unread, actionRequired] = await Promise.all([
      this.db.communicationItem.count({ where: base }),
      this.db.communicationItem.count({ where: andMessageWhere([base, inboxWhere()]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { folder: 'sent' }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { folder: 'drafts' }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { OR: [{ folder: 'archived' }, { status: CommunicationStatus.ARCHIVED }] }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { OR: [{ folder: 'trash' }, { status: CommunicationStatus.DELETED }] }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { read: false, status: { not: CommunicationStatus.DELETED } }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { OR: [{ actionRequired: true }, { status: CommunicationStatus.ACTION_REQUIRED }] }]) })
    ]);

    return { total, inbox, sent, drafts, archived, trash, unread, actionRequired };
  }
}

async function createMessageCopy(
  db: DbClient,
  input: ComposeMessageInput,
  copy: {
    ownerOrgId: string;
    folder: string;
    status: CommunicationStatus;
    read: boolean;
    payload: PayloadObject;
  }
) {
  return db.communicationItem.create({
    data: {
      ownerOrgId: copy.ownerOrgId,
      senderOrgId: input.senderOrgId,
      recipientOrgId: input.recipientOrgId ?? null,
      tenderId: input.tenderId ?? null,
      kind: input.kind,
      folder: copy.folder,
      category: input.category,
      subject: input.subject,
      body: input.body,
      status: copy.status,
      priority: input.priority,
      read: copy.read,
      actionRequired: input.actionRequired,
      visibility: input.visibility ?? null,
      payload: copy.payload as Prisma.InputJsonObject,
      ...(input.attachments.length
        ? {
            attachments: {
              create: input.attachments.map((attachment) => ({
                documentId: attachment.documentId
              }))
            }
          }
        : {})
    },
    include: communicationInclude
  });
}

function messageWhere(query: CommunicationQuery): Prisma.CommunicationItemWhereInput {
  return andMessageWhere([
    organizationScope(query.organizationId),
    folderWhere(query.folder),
    query.kind !== 'all' ? { kind: query.kind } : {},
    query.status !== 'all' ? { status: query.status } : {},
    query.priority !== 'all' ? { priority: query.priority } : {},
    query.category ? { category: { contains: query.category, mode: 'insensitive' } } : {},
    query.tenderId ? { tenderId: query.tenderId } : {},
    query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: 'insensitive' } },
            { body: { contains: query.search, mode: 'insensitive' } },
            { category: { contains: query.search, mode: 'insensitive' } },
            { visibility: { contains: query.search, mode: 'insensitive' } },
            { senderOrg: { name: { contains: query.search, mode: 'insensitive' } } },
            { recipientOrg: { name: { contains: query.search, mode: 'insensitive' } } },
            { tender: { reference: { contains: query.search, mode: 'insensitive' } } },
            { tender: { title: { contains: query.search, mode: 'insensitive' } } }
          ]
        }
      : {}
  ]);
}

function organizationScope(organizationId: string): Prisma.CommunicationItemWhereInput {
  if (!organizationId) return {};

  return { ownerOrgId: organizationId };
}

function folderWhere(folder: CommunicationQuery['folder']): Prisma.CommunicationItemWhereInput {
  if (folder === 'all') return {};
  if (folder === 'inbox') return inboxWhere();
  if (folder === 'archived') return { OR: [{ folder: 'archived' }, { status: CommunicationStatus.ARCHIVED }] };
  if (folder === 'trash') return { OR: [{ folder: 'trash' }, { status: CommunicationStatus.DELETED }] };
  if (folder === 'unread') return { read: false, status: { not: CommunicationStatus.DELETED } };
  return { folder };
}

function inboxWhere(): Prisma.CommunicationItemWhereInput {
  return {
    folder: { notIn: ['sent', 'archived', 'trash', 'drafts'] },
    status: { not: CommunicationStatus.DELETED }
  };
}

function orderBy(query: CommunicationQuery): Prisma.CommunicationItemOrderByWithRelationInput[] {
  const direction = query.sortDirection;
  if (query.sortBy === 'subject') return [{ subject: direction }, { createdAt: 'desc' }];
  if (query.sortBy === 'priority') return [{ priority: direction }, { createdAt: 'desc' }];
  if (query.sortBy === 'status') return [{ status: direction }, { createdAt: 'desc' }];
  if (query.sortBy === 'sender') return [{ senderOrg: { name: direction } }, { createdAt: 'desc' }];
  if (query.sortBy === 'recipient') return [{ recipientOrg: { name: direction } }, { createdAt: 'desc' }];
  return [{ createdAt: direction }];
}

function toDto(message: CommunicationRecord): CommunicationMessageDto {
  const payload = payloadObject(message.payload);

  return {
    id: message.id,
    kind: message.kind,
    folder: message.folder,
    category: message.category,
    subject: message.subject,
    body: message.body,
    status: message.status,
    priority: message.priority,
    read: message.read,
    actionRequired: message.actionRequired,
    visibility: message.visibility,
    ownerOrgId: message.ownerOrgId,
    ownerName: message.ownerOrg?.name ?? null,
    senderOrgId: message.senderOrgId,
    senderName: message.senderOrg?.name ?? null,
    recipientOrgId: message.recipientOrgId,
    recipientName: message.recipientOrg?.name ?? null,
    tenderId: message.tenderId,
    tenderReference: message.tender?.reference ?? null,
    tenderTitle: message.tender?.title ?? null,
    relatedMessageId: stringPayload(payload.relatedMessageId),
    conversationId: stringPayload(payload.conversationId),
    contextKey: stringPayload(payload.contextKey),
    thread: threadEntries(payload).map((entry) => ({
      ...entry,
      senderName: entry.senderName ?? resolveThreadSenderName(entry.senderOrgId, message)
    })),
    attachments: message.attachments.map(toAttachmentDto),
    metadata: objectPayload(payload.metadata),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString()
  };
}

function toAttachmentDto(attachment: CommunicationRecord['attachments'][number]): CommunicationAttachmentDto {
  return {
    id: attachment.id,
    documentId: attachment.documentId,
    name: attachment.document.name,
    documentType: attachment.document.documentType,
    objectKey: attachment.document.objectKey,
    checksum: attachment.document.checksum,
    createdAt: attachment.createdAt.toISOString()
  };
}

function payloadObject(value: unknown): PayloadObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PayloadObject;
}

function objectPayload(value: unknown): PayloadObject {
  return payloadObject(value);
}

function stringPayload(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function threadEntries(payload: PayloadObject): CommunicationThreadEntryDto[] {
  const raw = payload.thread;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as PayloadObject;
    const body = stringPayload(item.body);
    if (!body) return [];

    return [
      {
        senderOrgId: stringPayload(item.senderOrgId),
        senderName: stringPayload(item.senderName),
        body,
        notice: stringPayload(item.notice),
        createdAt: stringPayload(item.createdAt) ?? new Date(0).toISOString()
      }
    ];
  });
}

function buildPayload(input: {
  relatedMessageId?: string;
  conversationId: string;
  contextKey: string;
  metadata: Record<string, unknown>;
  thread: CommunicationThreadEntryDto[];
}): PayloadObject {
  return {
    relatedMessageId: input.relatedMessageId ?? null,
    conversationId: input.conversationId,
    contextKey: input.contextKey,
    metadata: input.metadata,
    thread: input.thread
  };
}

function resolveThreadSenderName(senderOrgId: string | null, message: CommunicationRecord) {
  if (!senderOrgId) return null;
  if (senderOrgId === message.senderOrgId) return message.senderOrg?.name ?? null;
  if (senderOrgId === message.recipientOrgId) return message.recipientOrg?.name ?? null;
  if (senderOrgId === message.ownerOrgId) return message.ownerOrg?.name ?? null;
  return null;
}

function otherParty(message: CommunicationRecord, senderOrgId: string) {
  if (message.senderOrgId && message.senderOrgId !== senderOrgId) return message.senderOrgId;
  if (message.recipientOrgId && message.recipientOrgId !== senderOrgId) return message.recipientOrgId;
  if (message.ownerOrgId && message.ownerOrgId !== senderOrgId) return message.ownerOrgId;
  return null;
}

function prefixReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

function deriveStatus(input: PatchMessageInput, current: CommunicationStatus) {
  if (input.status) return input.status;
  if (input.folder === 'archived') return CommunicationStatus.ARCHIVED;
  if (input.folder === 'trash') return CommunicationStatus.DELETED;
  if (input.read === true && current === CommunicationStatus.UNREAD) return CommunicationStatus.READ;
  if (input.read === false && current === CommunicationStatus.READ) return CommunicationStatus.UNREAD;
  return current;
}

function deriveFolder(input: PatchMessageInput, current: string, status: CommunicationStatus) {
  if (input.folder) return input.folder;
  if (status === CommunicationStatus.ARCHIVED) return 'archived';
  if (status === CommunicationStatus.DELETED) return 'trash';
  return current;
}

function andMessageWhere(filters: Prisma.CommunicationItemWhereInput[]): Prisma.CommunicationItemWhereInput {
  const active = filters.filter(hasKeys);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0];
  return { AND: active };
}

function andTenderWhere(filters: Prisma.TenderWhereInput[]): Prisma.TenderWhereInput {
  const active = filters.filter(hasKeys);
  if (active.length === 0) return {};
  if (active.length === 1) return active[0];
  return { AND: active };
}

function hasKeys(value: object) {
  return Object.keys(value).length > 0;
}
