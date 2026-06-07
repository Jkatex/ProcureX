import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';

function createServiceWithRepository(repositoryData: any) {
  return new ModuleService({
    health: async () => ({ ready: true }),
    getWelcomeData: async () => repositoryData
  } as any);
}

describe('procurement public welcome service', () => {
  it('maps repository data into the public welcome contract', async () => {
    const service = createServiceWithRepository({
      participantCount: 2450,
      openTenderCount: 18,
      verifiedUserCount: 2440,
      featuredTenders: [
        {
          id: 'tender-1',
          reference: 'PX-WRK-2026-001',
          title: 'Construction of community water wells',
          type: 'WORKS',
          status: 'OPEN',
          budget: { toString: () => '480000000' },
          currency: 'TZS',
          location: 'Dodoma',
          closingDate: new Date('2026-08-30T00:00:00.000Z'),
          buyerOrg: { name: 'Medical Stores Department' },
          categories: [{ name: 'Works' }, { name: 'Water' }]
        }
      ]
    });

    const payload = await service.publicWelcome();

    expect(payload.stats.participantCount).toBe(2450);
    expect(payload.stats.participantLabel).toBe('Used by 2,000+ participants');
    expect(payload.stats.openTenderCount).toBe(18);
    expect(payload.stats.verifiedProfileCompletionRate).toBeGreaterThanOrEqual(98.4);
    expect(payload.stats.activeWorkspaceLabel).toBe('Active workspace');
    expect(payload.featuredTenders).toEqual([
      {
        id: 'tender-1',
        reference: 'PX-WRK-2026-001',
        title: 'Construction of community water wells',
        buyerName: 'Medical Stores Department',
        type: 'WORKS',
        status: 'OPEN',
        budget: '480000000',
        currency: 'TZS',
        location: 'Dodoma',
        closingDate: '2026-08-30T00:00:00.000Z',
        categories: ['Works', 'Water']
      }
    ]);
  });

  it('returns stable defaults when repository access fails or no tenders are available', async () => {
    const failingService = new ModuleService({
      health: async () => ({ ready: true }),
      getWelcomeData: async () => {
        throw new Error('database unavailable');
      }
    } as any);
    const emptyService = createServiceWithRepository({
      participantCount: 0,
      openTenderCount: 0,
      verifiedUserCount: 0,
      featuredTenders: []
    });

    await expect(failingService.publicWelcome()).resolves.toMatchObject({
      stats: {
        participantLabel: 'Used by 2,000+ participants',
        verifiedProfileCompletionRate: 98.4
      },
      featuredTenders: [{ reference: 'PX-OPEN-2026' }]
    });
    await expect(emptyService.publicWelcome()).resolves.toMatchObject({
      stats: {
        participantCount: 2000,
        openTenderCount: 12
      },
      featuredTenders: [{ reference: 'PX-OPEN-2026' }]
    });
  });
});
