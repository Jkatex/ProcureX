import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';
import { planLineBodySchema, planningQuerySchema, saveAnnualPlanBodySchema } from './validators.js';
import type { ProcurementPlanningQuery } from './types.js';

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

describe('procurement planning service', () => {
  it('normalizes planning query defaults', () => {
    expect(planningQuerySchema.parse({})).toEqual({
      organizationId: '',
      financialYear: '',
      search: '',
      status: '',
      category: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    });
  });

  it('validates annual procurement plan payloads', () => {
    expect(
      saveAnnualPlanBodySchema.parse({
        financialYear: '2026/2027',
        lines: [
          {
            tenderTitle: 'Fleet maintenance framework agreement',
            category: 'Services',
            procurementMethod: 'Open Tender',
            openingDate: '2026-07-01',
            closingDate: '2026-07-30',
            sourceOfFunds: 'Operational budget',
            budget: '125000000',
            expectedCompletionDate: '2026-10-30',
            notes: 'High priority'
          }
        ]
      })
    ).toMatchObject({
      financialYear: '2026/2027',
      status: 'DRAFT',
      source: 'manual',
      currency: 'TZS',
      lines: [
        {
          tenderTitle: 'Fleet maintenance framework agreement',
          budget: 125000000,
          status: 'Draft planning',
          planState: 'Planning begun'
        }
      ]
    });

    expect(() => saveAnnualPlanBodySchema.parse({ financialYear: '2026/2027', lines: [] })).toThrow();
  });

  it('rejects impossible procurement planning dates', () => {
    const validLine = {
      tenderTitle: 'Diagnostic equipment service contract',
      openingDate: '2026-07-01',
      closingDate: '2026-07-30',
      expectedCompletionDate: '2026-10-30'
    };

    expect(() =>
      planLineBodySchema.parse({
        ...validLine,
        openingDate: '2026-08-01',
        closingDate: '2026-07-30'
      })
    ).toThrow();

    expect(() =>
      planLineBodySchema.parse({
        ...validLine,
        closingDate: '2026-11-01',
        expectedCompletionDate: '2026-10-30'
      })
    ).toThrow();

    expect(() =>
      planLineBodySchema.parse({
        ...validLine,
        openingDate: '2026-02-31'
      })
    ).toThrow();
  });

  it('returns an empty planning contract when the database is unavailable', async () => {
    const query: ProcurementPlanningQuery = {
      organizationId: '',
      financialYear: '2026/2027',
      search: '',
      status: '',
      category: '',
      page: 1,
      pageSize: 20,
      sortBy: 'date',
      sortDirection: 'desc'
    };
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      listPlans: async () => {
        throw new Error("Can't reach database server");
      }
    } as any);

    await expect(service.planning(query)).resolves.toEqual({
      plans: [],
      records: [],
      summary: {
        financialYear: '2026/2027',
        years: ['2026/2027'],
        totalPlans: 0,
        totalLines: 0,
        totalBudget: 0,
        byStatus: [],
        byCategory: []
      },
      totalPlans: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1
    });
  });
});
