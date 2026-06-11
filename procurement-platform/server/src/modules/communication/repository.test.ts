import { describe, expect, it, vi } from 'vitest';
import { ModuleRepository } from './repository.js';
import type { CommunicationQuery } from './types.js';

const organizationId = '11111111-1111-4111-8111-111111111111';

describe('communication repository', () => {
  it('limits mailbox queries to messages owned by the selected organization', async () => {
    const db = {
      communicationItem: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      }
    };
    const repository = new ModuleRepository(db as any);
    const query: CommunicationQuery = {
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

    await repository.listMessages(query);

    expect(db.communicationItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerOrgId: organizationId }
      })
    );
    expect(db.communicationItem.count).toHaveBeenCalledWith({
      where: { ownerOrgId: organizationId }
    });
  });
});
