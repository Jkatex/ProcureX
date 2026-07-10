import { describe, expect, it, vi } from 'vitest';
import { CommunicationStatus } from '@prisma/client';
import { ModuleRepository } from './repository.js';
import type { CommunicationQuery } from './types.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const baseQuery: CommunicationQuery = {
  organizationId,
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
};

describe('communication repository', () => {
  it('limits mailbox queries to messages owned by the selected organization', async () => {
    const db = {
      communicationItem: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.listMessages(baseQuery);

    expect(db.communicationItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerOrgId: organizationId }
      })
    );
    expect(db.communicationItem.count).toHaveBeenCalledWith({
      where: { ownerOrgId: organizationId }
    });
  });

  it('keeps unread as a received inbox subset, not a sent-message bucket', async () => {
    const db = {
      communicationItem: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.listMessages({ ...baseQuery, folder: 'unread' });

    expect(db.communicationItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { ownerOrgId: organizationId },
            {
              AND: [
                {
                  folder: { notIn: ['sent', 'archived', 'trash', 'drafts'] },
                  status: { not: CommunicationStatus.DELETED }
                },
                { read: false }
              ]
            }
          ]
        }
      })
    );
    expect(db.communicationItem.count).toHaveBeenCalledWith({
      where: {
        AND: [
          { ownerOrgId: organizationId },
          {
            AND: [
              {
                folder: { notIn: ['sent', 'archived', 'trash', 'drafts'] },
                status: { not: CommunicationStatus.DELETED }
              },
              { read: false }
            ]
          }
        ]
      }
    });
  });
});
