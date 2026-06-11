import { CommunicationKind, CommunicationPriority, CommunicationStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';
import { communicationQuerySchema, composeMessageBodySchema, patchMessageBodySchema } from './validators.js';
import type { CommunicationQuery } from './types.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const recipientOrgId = '22222222-2222-4222-8222-222222222222';

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
        actionRequired: true
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
  });

  it('requires patch payloads to change at least one message field', () => {
    expect(() => patchMessageBodySchema.parse({})).toThrow();
    expect(patchMessageBodySchema.parse({ status: CommunicationStatus.ARCHIVED })).toEqual({
      status: CommunicationStatus.ARCHIVED
    });
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
      listMessages: async () => {
        throw new Error("Can't reach database server");
      }
    } as any);

    await expect(service.listMessages(query)).resolves.toEqual({
      messages: [],
      counts: {
        total: 0,
        inbox: 0,
        sent: 0,
        drafts: 0,
        archived: 0,
        trash: 0,
        unread: 0,
        actionRequired: 0
      },
      totalMessages: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1
    });
  });
});
