/* Exercises communication behavior so regressions are caught close to the domain workflow they protect. */
import { CommunicationKind, CommunicationPriority, CommunicationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleService } from './service.js';
import { communicationQuerySchema, composeMessageBodySchema, patchMessageBodySchema } from './validators.js';
import type { CommunicationQuery } from './types.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const recipientOrgId = '22222222-2222-4222-8222-222222222222';
const otherOrgId = '33333333-3333-4333-8333-333333333333';

const userIdentity = {
  requireSession: async () => ({
    user: {
      accountType: 'USER',
      organizationId
    }
  })
};

const adminIdentity = {
  requireSession: async () => ({
    user: {
      accountType: 'ADMIN',
      organizationId: otherOrgId
    }
  })
};

describe('communication module', () => {
  it('normalizes mailbox query defaults', () => {
    expect(communicationQuerySchema.parse({ organizationId })).toEqual({
      organizationId,
      folder: 'inbox',
      search: '',
      kind: 'all',
      status: 'all',
      priority: 'all',
      category: '',
      tenderId: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    });
  });

  it('validates compose payloads for database-backed messages', () => {
    expect(
      composeMessageBodySchema.parse({
        senderOrgId: organizationId,
        recipientOrgId,
        kind: CommunicationKind.CLARIFICATION,
        category: 'Tender Clarification',
        subject: 'Can we visit the site?',
        body: 'Please confirm the available site visit slots.',
        priority: CommunicationPriority.HIGH,
        actionRequired: true,
        attachmentUploads: [
          {
            name: 'site-report.pdf',
            documentType: 'PDF',
            mimeType: 'application/pdf',
            size: 1200
          }
        ]
      })
    ).toEqual({
      senderOrgId: organizationId,
      recipientOrgId,
      kind: CommunicationKind.CLARIFICATION,
      category: 'Tender Clarification',
      subject: 'Can we visit the site?',
      body: 'Please confirm the available site visit slots.',
      priority: CommunicationPriority.HIGH,
      actionRequired: true,
      attachments: [],
      attachmentUploads: [
        {
          name: 'site-report.pdf',
          documentType: 'PDF',
          mimeType: 'application/pdf',
          size: 1200
        }
      ],
      metadata: {}
    });

    expect(() =>
      composeMessageBodySchema.parse({
        senderOrgId: organizationId,
        subject: '',
        body: 'Missing subject.'
      })
    ).toThrow();

    expect(() =>
      composeMessageBodySchema.parse({
        senderOrgId: organizationId,
        subject: 'Recipient missing',
        body: 'This should not create an orphaned mailbox item.'
      })
    ).toThrow();

    expect(() =>
      composeMessageBodySchema.parse({
        senderOrgId: organizationId,
        recipientOrgId,
        subject: 'Too many attachments',
        body: 'Attachment floods should be rejected early.',
        attachments: Array.from({ length: 21 }, () => ({ documentId: '33333333-3333-4333-8333-333333333333' }))
      })
    ).toThrow();

    expect(() =>
      composeMessageBodySchema.parse({
        senderOrgId: organizationId,
        recipientOrgId,
        subject: 'Too many mixed attachments',
        body: 'Attachment floods should be rejected early.',
        attachments: Array.from({ length: 10 }, () => ({ documentId: '33333333-3333-4333-8333-333333333333' })),
        attachmentUploads: Array.from({ length: 11 }, (_, index) => ({ name: `report-${index}.pdf` }))
      })
    ).toThrow();
  });

  it('requires patch payloads to change at least one message field', () => {
    expect(() => patchMessageBodySchema.parse({})).toThrow();
    expect(patchMessageBodySchema.parse({ status: CommunicationStatus.ARCHIVED })).toEqual({
      status: CommunicationStatus.ARCHIVED
    });
    expect(() => patchMessageBodySchema.parse({ folder: 'trash' })).toThrow();
    expect(() => patchMessageBodySchema.parse({ status: CommunicationStatus.DELETED })).toThrow();
  });

  it('returns an empty mailbox contract when the database is unavailable', async () => {
    const query: CommunicationQuery = {
      organizationId,
      folder: 'inbox',
      search: '',
      kind: 'all',
      status: 'all',
      priority: 'all',
      category: '',
      tenderId: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    };
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      ensureDraftBidDeadlineReminders: async () => 0,
      listMessages: async () => {
        throw new Error("Can't reach database server");
      }
    } as any, userIdentity as any);

    await expect(service.listMessages('session-token', query)).resolves.toEqual({
      messages: [],
      counts: {
        total: 0,
        inbox: 0,
        sent: 0,
        drafts: 0,
        archived: 0,
        unread: 0,
        actionRequired: 0
      },
      totalMessages: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1
    });
  });

  it('scopes non-admin mailbox queries to the session organization', async () => {
    const listMessages = vi.fn().mockResolvedValue(emptyMailbox());
    const service = new ModuleService({ ensureDraftBidDeadlineReminders: vi.fn().mockResolvedValue(0), listMessages } as any, userIdentity as any);

    await service.listMessages('session-token', {
      organizationId: recipientOrgId,
      folder: 'all',
      search: '',
      kind: 'all',
      status: 'all',
      priority: 'all',
      category: '',
      tenderId: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    });

    expect(listMessages).toHaveBeenCalledWith(expect.objectContaining({ organizationId }));
  });

  it('keeps admin mailbox queries filterable', async () => {
    const listMessages = vi.fn().mockResolvedValue(emptyMailbox());
    const service = new ModuleService({ ensureDraftBidDeadlineReminders: vi.fn().mockResolvedValue(0), listMessages } as any, adminIdentity as any);

    await service.listMessages('admin-token', {
      organizationId: recipientOrgId,
      folder: 'all',
      search: '',
      kind: 'all',
      status: 'all',
      priority: 'all',
      category: '',
      tenderId: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    });

    expect(listMessages).toHaveBeenCalledWith(expect.objectContaining({ organizationId: recipientOrgId }));
  });

  it('defaults admin mailbox queries to the admin organization when no filter is selected', async () => {
    const listMessages = vi.fn().mockResolvedValue(emptyMailbox());
    const service = new ModuleService({ ensureDraftBidDeadlineReminders: vi.fn().mockResolvedValue(0), listMessages } as any, adminIdentity as any);

    await service.listMessages('admin-token', {
      organizationId: '',
      folder: 'all',
      search: '',
      kind: 'all',
      status: 'all',
      priority: 'all',
      category: '',
      tenderId: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    });

    expect(listMessages).toHaveBeenCalledWith(expect.objectContaining({ organizationId: otherOrgId }));
  });

  it('blocks non-admin access to messages owned by another organization', async () => {
    const patchMessage = vi.fn();
    const service = new ModuleService(
      {
        getMessage: vi.fn().mockResolvedValue({ id: 'message-1', ownerOrgId: recipientOrgId }),
        patchMessage
      } as any,
      userIdentity as any
    );

    await expect(service.getMessage('session-token', 'message-1')).resolves.toBeNull();
    await expect(service.patchMessage('session-token', 'message-1', { read: true })).resolves.toBeNull();
    expect(patchMessage).not.toHaveBeenCalled();
  });

  it('derives non-admin compose and reply sender organization from the session', async () => {
    const createMessage = vi.fn().mockResolvedValue({ message: {}, deliveries: [] });
    const reply = vi.fn().mockResolvedValue({ message: {}, deliveries: [] });
    const service = new ModuleService(
      {
        createMessage,
        getMessage: vi.fn().mockResolvedValue({ id: 'message-1', ownerOrgId: organizationId }),
        reply
      } as any,
      userIdentity as any
    );

    await service.composeMessage('session-token', {
      senderOrgId: otherOrgId,
      recipientOrgId,
      ownerOrgId: otherOrgId,
      kind: CommunicationKind.MESSAGE,
      category: 'General Message',
      subject: 'Hello',
      body: 'A live platform message.',
      priority: CommunicationPriority.NORMAL,
      actionRequired: false,
      attachments: [],
      attachmentUploads: [],
      metadata: {}
    });
    await service.reply('session-token', 'message-1', {
      senderOrgId: otherOrgId,
      body: 'Reply body.',
      attachments: [],
      attachmentUploads: [],
      metadata: {}
    });

    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ senderOrgId: organizationId, ownerOrgId: organizationId }));
    expect(reply).toHaveBeenCalledWith('message-1', expect.objectContaining({ senderOrgId: organizationId }));
  });
});

function emptyMailbox() {
  return {
    messages: [],
    counts: {
      total: 0,
      inbox: 0,
      sent: 0,
      drafts: 0,
      archived: 0,
      unread: 0,
      actionRequired: 0
    },
    totalMessages: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1
  };
}
