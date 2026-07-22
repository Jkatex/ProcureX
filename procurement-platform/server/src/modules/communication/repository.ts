/* Encapsulates communication persistence queries so service logic does not depend on raw Prisma access patterns. */
import { createHash, randomUUID } from 'node:crypto';
import {
  AuditSeverity,
  BidStatus,
  CommunicationKind,
  CommunicationPriority,
  CommunicationStatus,
  OrganizationCapabilityName,
  OrganizationKind,
  TenderStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  CommunicationAttachmentDto,
  CommunicationAttachmentFileDto,
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

  async getAttachment(messageId: string, attachmentId: string): Promise<CommunicationAttachmentFileDto | null> {
    const attachment = await this.db.communicationAttachment.findFirst({
      where: { id: attachmentId, communicationItemId: messageId },
      include: {
        document: {
          select: {
            name: true,
            documentType: true,
            metadata: true
          }
        }
      }
    });
    if (!attachment) return null;

    const metadata = payloadObject(attachment.document.metadata);
    const content = base64Buffer(stringPayload(metadata.contentBase64));
    if (!content) return null;

    return {
      name: attachment.document.name,
      mimeType: documentMimeType(attachment.document.documentType, metadata),
      content
    };
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
      const attachmentDocumentIds = await ensureAttachmentDocuments(tx, input);
      const senderCopy = await createMessageCopy(tx, input, {
        ownerOrgId: input.ownerOrgId ?? input.senderOrgId,
        folder: 'sent',
        status: CommunicationStatus.READ,
        read: true,
        payload: { ...basePayload, deliveryRole: 'sender' },
        attachmentDocumentIds
      });
      created.push(senderCopy);

      if (input.recipientOrgId && input.recipientOrgId !== input.senderOrgId) {
        const recipientCopy = await createMessageCopy(tx, input, {
          ownerOrgId: input.recipientOrgId,
          folder: 'inbox',
          status: input.actionRequired ? CommunicationStatus.ACTION_REQUIRED : CommunicationStatus.UNREAD,
          read: false,
          payload: { ...basePayload, deliveryRole: 'recipient', senderCopyId: senderCopy.id },
          attachmentDocumentIds
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
      category: input.category ?? original.category,
      subject: input.subject ?? prefixReplySubject(original.subject),
      body: input.body,
      priority: input.priority ?? original.priority,
      visibility: input.visibility ?? original.visibility ?? undefined,
      actionRequired: false,
      attachments: input.attachments,
      attachmentUploads: input.attachmentUploads,
      metadata: {
        ...input.metadata,
        relatedMessageId: original.id,
        conversationId,
        contextKey
      }
    };

    const result = await this.db.$transaction(async (tx) => {
      const records: CommunicationRecord[] = [];
      const attachmentDocumentIds = await ensureAttachmentDocuments(tx, replyInput);
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
        payload: { ...replyPayload, deliveryRole: 'sender' },
        attachmentDocumentIds
      });
      records.push(senderCopy);

      if (recipientOrgId && recipientOrgId !== senderOrgId) {
        const recipientCopy = await createMessageCopy(tx, replyInput, {
          ownerOrgId: recipientOrgId,
          folder: 'inbox',
          status: CommunicationStatus.UNREAD,
          read: false,
          payload: { ...replyPayload, deliveryRole: 'recipient', senderCopyId: senderCopy.id },
          attachmentDocumentIds
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

  async ensureDraftBidDeadlineReminders(organizationId: string, now = new Date()): Promise<number> {
    if (!organizationId) return 0;
    const windowEnd = new Date(now);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 7);

    const drafts = await this.db.bid.findMany({
      where: {
        supplierOrgId: organizationId,
        status: BidStatus.DRAFT,
        tender: {
          status: { in: [TenderStatus.PUBLISHED, TenderStatus.OPEN] },
          closingDate: {
            gte: now,
            lte: windowEnd
          }
        }
      },
      include: {
        tender: {
          select: {
            id: true,
            reference: true,
            title: true,
            closingDate: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
    if (!drafts.length) return 0;

    const platformOrg = await this.db.organization.upsert({
      where: { name: 'ProcureX Platform' },
      update: { kind: OrganizationKind.PLATFORM },
      create: { name: 'ProcureX Platform', kind: OrganizationKind.PLATFORM, country: 'TZ' },
      select: { id: true }
    });

    let created = 0;
    for (const draft of drafts) {
      const subject = `Complete draft bid before closing: ${draft.tender.reference}`;
      const existing = await this.db.communicationItem.findFirst({
        where: {
          ownerOrgId: organizationId,
          tenderId: draft.tenderId,
          category: 'Bid deadline reminder',
          subject
        },
        select: { id: true }
      });
      if (existing) continue;

      await this.createMessage({
        senderOrgId: platformOrg.id,
        recipientOrgId: organizationId,
        tenderId: draft.tenderId,
        kind: CommunicationKind.ALERT,
        category: 'Bid deadline reminder',
        subject,
        body: `You have a draft bid for ${draft.tender.title} (${draft.tender.reference}). The tender closes this week on ${formatReminderDeadline(draft.tender.closingDate)}. Complete and submit your bid before the deadline closes.`,
        priority: CommunicationPriority.HIGH,
        visibility: 'Private platform reminder',
        actionRequired: true,
        attachments: [],
        attachmentUploads: [],
        metadata: {
          source: 'draft-bid-deadline-reminder',
          bidId: draft.id,
          tenderId: draft.tenderId,
          reminderWindowDays: 7,
          actionLabel: 'Complete bid',
          actionRoute: `/bidding?tenderId=${draft.tenderId}`
        }
      });
      created += 1;
    }

    return created;
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
    const [total, inbox, sent, drafts, archived, unread, actionRequired] = await Promise.all([
      this.db.communicationItem.count({ where: base }),
      this.db.communicationItem.count({ where: andMessageWhere([base, inboxWhere()]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { folder: 'sent' }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { folder: 'drafts' }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { OR: [{ folder: 'archived' }, { status: CommunicationStatus.ARCHIVED }] }]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, unreadWhere()]) }),
      this.db.communicationItem.count({ where: andMessageWhere([base, { OR: [{ actionRequired: true }, { status: CommunicationStatus.ACTION_REQUIRED }] }]) })
    ]);

    return { total, inbox, sent, drafts, archived, unread, actionRequired };
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
    attachmentDocumentIds: string[];
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
      ...(copy.attachmentDocumentIds.length
        ? {
            attachments: {
              create: copy.attachmentDocumentIds.map((documentId) => ({
                documentId
              }))
            }
          }
        : {})
    },
    include: communicationInclude
  });
}

async function ensureAttachmentDocuments(db: DbClient, input: ComposeMessageInput): Promise<string[]> {
  const linkedDocumentIds = (input.attachments ?? []).map((attachment) => attachment.documentId);
  const attachmentUploads = input.attachmentUploads ?? [];
  if (!attachmentUploads.length) return linkedDocumentIds;

  const created = await Promise.all(
    attachmentUploads.map((attachment) => {
      const content = base64Buffer(attachment.contentBase64);
      return db.documentObject.create({
        data: {
          ownerOrgId: input.ownerOrgId ?? input.senderOrgId,
          name: attachment.name,
          objectKey: `communication/${randomUUID()}/${safeObjectName(attachment.name)}`,
          documentType: attachment.documentType ?? documentTypeForAttachment(attachment),
          checksum: content ? createHash('sha256').update(content).digest('hex') : null,
          metadata: {
            source: 'communication-message',
            mimeType: attachment.mimeType ?? null,
            size: attachment.size ?? content?.byteLength ?? null,
            contentBase64: attachment.contentBase64 ?? null
          } as Prisma.InputJsonObject
        },
        select: { id: true }
      });
    })
  );

  return [...linkedDocumentIds, ...created.map((document) => document.id)];
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
  if (folder === 'unread') return unreadWhere();
  return { folder };
}

function inboxWhere(): Prisma.CommunicationItemWhereInput {
  return {
    folder: { notIn: ['sent', 'archived', 'trash', 'drafts'] },
    status: { not: CommunicationStatus.DELETED }
  };
}

function unreadWhere(): Prisma.CommunicationItemWhereInput {
  return andMessageWhere([inboxWhere(), { read: false }]);
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

function safeObjectName(name: string) {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'attachment';
}

function documentTypeForAttachment(attachment: { name: string; mimeType?: string }) {
  const mimeType = attachment.mimeType?.trim();
  if (mimeType) return mimeType;
  const extension = attachment.name.includes('.') ? attachment.name.split('.').pop()?.trim() : '';
  return extension ? extension.toUpperCase() : 'Attachment';
}

function formatReminderDeadline(value: Date | null) {
  if (!value) return 'the published closing date';
  return value.toISOString().slice(0, 10);
}

function documentMimeType(documentType: string, metadata: PayloadObject) {
  const metadataMimeType = stringPayload(metadata.mimeType);
  if (metadataMimeType?.includes('/')) return metadataMimeType;
  if (documentType.includes('/')) return documentType;
  return 'application/octet-stream';
}

function base64Buffer(value: string | undefined | null) {
  const normalized = normalizeBase64(value);
  if (!normalized) return null;
  return Buffer.from(normalized, 'base64');
}

function normalizeBase64(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function deriveStatus(input: PatchMessageInput, current: CommunicationStatus) {
  if (input.status) return input.status;
  if (input.folder === 'archived') return CommunicationStatus.ARCHIVED;
  if (input.read === true && current === CommunicationStatus.UNREAD) return CommunicationStatus.READ;
  if (input.read === false && current === CommunicationStatus.READ) return CommunicationStatus.UNREAD;
  return current;
}

function deriveFolder(input: PatchMessageInput, current: string, status: CommunicationStatus) {
  if (input.folder) return input.folder;
  if (status === CommunicationStatus.ARCHIVED) return 'archived';
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
