import { ProcurementMethod, TenderStatus, TenderType, Visibility } from '@prisma/client';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ModuleService as IdentityModuleService } from '../identity/service.js';
import { MARKETPLACE_UNAVAILABLE_CODE, MARKETPLACE_UNAVAILABLE_MESSAGE, ModuleService } from './service.js';
import {
  contactVerificationStartBodySchema,
  contactVerificationVerifyBodySchema,
  createTenderBodySchema,
  marketplaceQuerySchema,
  planLineBodySchema,
  planningQuerySchema,
  publishTenderBodySchema,
  scanLanguageBodySchema,
  saveAnnualPlanBodySchema,
  updateTenderBodySchema
} from './validators.js';
import type { CreateTenderInput, MarketplaceQuery, ProcurementPlanningQuery, UpdateTenderInput } from './types.js';
import { designFormSchemaTypeValues, masterDataGroupValues, type DesignFormControlDto } from './types.js';

function createServiceWithRepository(repositoryData: any) {
  return new ModuleService({
    health: async () => ({ ready: true }),
    getWelcomeData: async () => repositoryData
  } as any);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
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

describe('procurement master data service', () => {
  it('returns all expected master data groups with stable item shapes', async () => {
    const service = new ModuleService({} as any);

    const payload = await service.masterData();

    expect(payload.success).toBe(true);
    expect(payload.data.groups.map((group) => group.group)).toEqual([...masterDataGroupValues]);
    for (const group of payload.data.groups) {
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(Object.keys(item).sort()).toEqual(['code', 'isActive', 'label', 'sortOrder', 'value']);
        expect(item.isActive).toBe(true);
      }
      expect(group.items.map((item) => item.sortOrder)).toEqual([...group.items.map((item) => item.sortOrder)].sort((a, b) => a - b));
    }
  });

  it('returns tender type master data with frontend-friendly labels', async () => {
    const service = new ModuleService({} as any);

    await expect(service.masterDataGroup('tender-types')).resolves.toEqual({
      success: true,
      data: {
        group: 'tender-types',
        items: [
          { code: 'GOODS', label: 'Goods', value: 'Goods', isActive: true, sortOrder: 10 },
          { code: 'WORKS', label: 'Works', value: 'Works', isActive: true, sortOrder: 20 },
          { code: 'SERVICE', label: 'Non Consultancy', value: 'Non Consultancy', isActive: true, sortOrder: 30 },
          { code: 'CONSULTANCY', label: 'Consultancy', value: 'Consultancy', isActive: true, sortOrder: 40 }
        ]
      }
    });
  });

  it('returns Others as the final category master data option', async () => {
    const service = new ModuleService({} as any);

    const payload = await service.masterDataGroup('categories');

    expect(payload?.data.items.at(-1)).toEqual({
      code: 'OTHERS',
      label: 'Others',
      value: 'Others',
      isActive: true,
      sortOrder: 100
    });
  });

  it('returns null for unknown master data groups', async () => {
    const service = new ModuleService({} as any);

    await expect(service.masterDataGroup('unknown-group')).resolves.toBeNull();
  });
});

describe('procurement design form schema service', () => {
  it('returns all supported design form schemas', async () => {
    const service = new ModuleService({} as any);

    const payload = await service.designFormSchemas();

    expect(payload.success).toBe(true);
    expect(payload.data.schemaVersion).toBe('procurement-design-v1');
    expect(payload.data.schemas.map((schema) => schema.type)).toEqual([...designFormSchemaTypeValues]);
    expect(payload.data.schemas.map((schema) => schema.tenderType)).toEqual(['Goods', 'Works', 'Non Consultancy', 'Consultancy']);
  });

  it('returns the goods schema with wizard-derived sections and master-data-backed unit options', async () => {
    const service = new ModuleService({} as any);

    const payload = await service.designFormSchema('goods');
    const schema = payload?.data;
    const sectionIds = schema?.sections.map((section) => section.id);
    const unitControl = findControl(schema?.sections ?? [], 'unitOfMeasure');

    expect(schema).toMatchObject({
      schemaVersion: 'procurement-design-v1',
      type: 'goods',
      tenderType: 'Goods',
      title: 'Goods Tender Requirements'
    });
    expect(sectionIds).toEqual(['quantitySchedule', 'technicalSpecifications', 'sampleRequirements', 'financialCapacity', 'eligibilityRequirements']);
    expect(findControl(schema?.sections ?? [], 'sampleRequirementRows')).toMatchObject({
      showWhen: { field: 'requireSamples', value: 'Yes' }
    });
    expect(unitControl).toMatchObject({
      optionSource: { group: 'units' },
      options: ['Each', 'Lot', 'Piece', 'Set', 'Month', 'Day', 'Hour', 'Meter', 'Square Meter']
    });
  });

  it('returns service and works schemas with conditional rendering rules', async () => {
    const service = new ModuleService({} as any);

    const services = await service.designFormSchema('services');
    const works = await service.designFormSchema('works');

    expect(services?.data.sections.find((section) => section.id === 'securityRequirements')).toMatchObject({
      showWhen: { field: 'serviceCategory', value: 'Security' }
    });
    expect(services?.data.sections.find((section) => section.id === 'equipmentRequirements')).toMatchObject({
      showWhen: { field: 'serviceCategory', values: expect.arrayContaining(['Security', 'Cleaning']) }
    });
    expect(findControl(works?.data.sections ?? [], 'lumpSumPricingRows')).toMatchObject({
      showWhen: { field: 'contractType', value: 'Lump Sum Contract' }
    });
    expect(findControl(works?.data.sections ?? [], 'bankStatementPeriod')).toMatchObject({
      showWhen: { field: 'bankStatementsRequired', value: true }
    });
  });

  it('returns consultancy schema with nested cards, tables, and accordions', async () => {
    const service = new ModuleService({} as any);

    const payload = await service.designFormSchema('consultancy');

    expect(findControl(payload?.data.sections ?? [], 'consultancyEntityBackground')).toMatchObject({
      type: 'cards',
      fields: expect.arrayContaining([expect.objectContaining({ id: 'organizationBackground', type: 'richtext' })])
    });
    expect(findControl(payload?.data.sections ?? [], 'consultancyProjectBackground')).toMatchObject({
      type: 'accordion',
      panels: expect.arrayContaining([expect.objectContaining({ id: 'projectName' })])
    });
    expect(findControl(payload?.data.sections ?? [], 'consultancyDeliverables')).toMatchObject({
      type: 'table',
      columns: expect.arrayContaining([expect.objectContaining({ id: 'deliverableName' })])
    });
  });

  it('returns null for unknown design form schema types', async () => {
    const service = new ModuleService({} as any);

    await expect(service.designFormSchema('lease')).resolves.toBeNull();
  });

  it('scans tender language through an authenticated design endpoint', async () => {
    const service = new ModuleService({} as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    const result = await service.scanTenderLanguage('token-1', {
      title: 'ICT equipment',
      description: 'Only HP brand devices from a preferred supplier are acceptable and no equivalent products will be accepted.',
      requirements: {},
      evaluationCriteria: {},
      metadata: {}
    });

    expect(result.success).toBe(true);
    expect(result.data.riskLevel).toBe('High');
    expect(result.data.issues.map((issue) => issue.type)).toContain('brand-only-restriction');
  });

  it('returns taxonomy and standardizes category synonyms', async () => {
    const service = new ModuleService({} as any);

    const taxonomy = await service.taxonomy();
    const standardized = await service.standardizeCategory({ rawCategory: 'computer supplies', type: TenderType.GOODS });

    expect(taxonomy.data.taxonomyVersion).toBe('procurement-taxonomy-v1');
    expect(taxonomy.data.categories).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'ICT Equipment', synonyms: expect.arrayContaining(['laptops']) })]));
    expect(standardized).toEqual({
      success: true,
      data: expect.objectContaining({
        rawCategory: 'computer supplies',
        standardCategory: 'ICT Equipment',
        type: 'Goods',
        confidence: 0.98,
        synonymsMatched: ['computer supplies']
      })
    });
  });

  it('standardizes explicit Others categories to type-specific fallback categories', async () => {
    const service = new ModuleService({} as any);

    await expect(service.standardizeCategory({ rawCategory: 'Others', type: TenderType.GOODS })).resolves.toMatchObject({
      success: true,
      data: { standardCategory: 'Other Goods', type: 'Goods', confidence: 1 }
    });
    await expect(service.standardizeCategory({ rawCategory: 'Other', type: TenderType.WORKS })).resolves.toMatchObject({
      success: true,
      data: { standardCategory: 'Other Works', type: 'Works', confidence: 1 }
    });
    await expect(service.standardizeCategory({ rawCategory: 'Other Non Consultancy', type: TenderType.SERVICE })).resolves.toMatchObject({
      success: true,
      data: { standardCategory: 'Other Non Consultancy', type: 'Non Consultancy', confidence: 1 }
    });
    await expect(service.standardizeCategory({ rawCategory: 'Other Consultancy', type: TenderType.CONSULTANCY })).resolves.toMatchObject({
      success: true,
      data: { standardCategory: 'Other Consultancy', type: 'Consultancy', confidence: 1 }
    });
  });
});

describe('procurement planning service', () => {
  it('normalizes marketplace query defaults and filters', () => {
    expect(marketplaceQuerySchema.parse({})).toEqual({
      search: '',
      category: '',
      type: '',
      budgetBand: '',
      status: '',
      includeClosed: false,
      visibility: '',
      sort: 'deadline',
      page: 1,
      limit: 20
    });

    expect(
      marketplaceQuerySchema.parse({
        search: 'water',
        category: 'computer supplies',
        type: 'GOODS',
        budgetBand: 'hundred-million-plus',
        status: 'PUBLISHED',
        includeClosed: 'true',
        visibility: 'PUBLIC_MARKETPLACE',
        sort: 'budget-desc',
        page: '2',
        limit: '25'
      })
    ).toMatchObject({
      search: 'water',
      category: 'computer supplies',
      type: 'GOODS',
      budgetBand: 'hundred-million-plus',
      status: 'PUBLISHED',
      includeClosed: true,
      visibility: 'PUBLIC_MARKETPLACE',
      sort: 'budget-desc',
      page: 2,
      limit: 25
    });

    expect(() => marketplaceQuerySchema.parse({ budgetBand: 'large' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ sort: 'random' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ search: 'x'.repeat(101) })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ category: 'x'.repeat(101) })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ type: 'Lease' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ status: 'Review' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ includeClosed: 'maybe' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ visibility: 'SECRET' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => marketplaceQuerySchema.parse({ limit: '101' })).toThrow();
  });

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

  it('returns an empty marketplace contract when the database is unavailable', async () => {
    const query: MarketplaceQuery = {
      search: '',
      category: '',
      type: '',
      budgetBand: '',
      status: '',
      includeClosed: false,
      visibility: '',
      sort: 'deadline',
      page: 1,
      limit: 20
    };
    const service = new ModuleService({
      getMarketplaceData: async () => {
        throw new Error("Can't reach database server");
      }
    } as any);

    await expect(service.marketplace(undefined, query)).resolves.toEqual({
      tenders: [],
      recommendedTenders: [],
      invitedTenders: [],
      myTenders: [],
      myBids: [],
      summary: {
        openTenders: 0,
        myTenders: 0,
        myBids: 0,
        totalBudgetValue: 0,
        categoryCounts: [],
        closingSoon: 0
      },
      pagination: {
        page: 1,
        limit: 20,
        matching: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      }
    });
  });

  it('logs and rejects with a sanitized marketplace outage error in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAppEnv = process.env.APP_ENV;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const databaseError = new Error("Can't reach database server at db.internal");
    const query: MarketplaceQuery = {
      search: '',
      category: '',
      type: '',
      budgetBand: '',
      status: '',
      includeClosed: false,
      visibility: '',
      sort: 'deadline',
      page: 1,
      limit: 20
    };
    const service = new ModuleService({
      getMarketplaceData: async () => {
        throw databaseError;
      }
    } as any);

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.APP_ENV;

      await expect(service.marketplace(undefined, query)).rejects.toMatchObject({
        status: 503,
        code: MARKETPLACE_UNAVAILABLE_CODE,
        message: MARKETPLACE_UNAVAILABLE_MESSAGE
      });
      expect(consoleError).toHaveBeenCalledWith(
        '[procurement.marketplace] Database unavailable while loading marketplace.',
        databaseError
      );
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalAppEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = originalAppEnv;
      consoleError.mockRestore();
    }
  });
});

describe('procurement contact verification identity challenge service', () => {
  const session = { user: { id: 'user-1', organizationId: 'org-1' } };
  const createdAt = new Date('2099-07-01T08:00:00.000Z');
  const expiresAt = new Date('2099-07-01T09:00:00.000Z');

  function createIdentityService(repositoryOverrides: Record<string, unknown> = {}, notificationOverrides: Record<string, unknown> = {}) {
    const repository = {
      replacePendingChallenges: vi.fn().mockResolvedValue({ count: 0 }),
      createChallenge: vi.fn().mockResolvedValue({
        id: 'challenge-1',
        createdAt,
        expiresAt,
        metadata: {}
      }),
      updateChallenge: vi.fn().mockImplementation((id: string, data: any) => Promise.resolve({ id, createdAt, expiresAt, ...data })),
      findChallenge: vi.fn(),
      incrementChallengeAttempts: vi.fn().mockResolvedValue({}),
      consumeChallenge: vi.fn().mockResolvedValue({ consumedAt: new Date('2099-07-01T08:02:00.000Z') }),
      createAuditEvent: vi.fn().mockResolvedValue({}),
      ...repositoryOverrides
    };
    const notifications = {
      sendPhoneOtp: vi.fn().mockResolvedValue({ provider: 'dev-console' }),
      sendTenderContactVerification: vi.fn().mockResolvedValue({ provider: 'dev-console' }),
      ...notificationOverrides
    };
    const service = new IdentityModuleService(repository as any, notifications as any);
    vi.spyOn(service, 'requirePermission').mockResolvedValue(session as any);
    return { service, repository, notifications };
  }

  it('starts email and phone tender contact challenges', async () => {
    const { service, repository, notifications } = createIdentityService();

    await expect(service.startTenderContactVerification('token-1', { channel: 'email', target: ' Buyer@Example.GO.TZ ' })).resolves.toMatchObject({
      challengeId: 'challenge-1',
      channel: 'email',
      target: 'buyer@example.go.tz',
      devCode: expect.any(String)
    });
    await expect(service.startTenderContactVerification('token-1', { channel: 'phone', target: '0700000001' })).resolves.toMatchObject({
      channel: 'phone',
      target: '+255700000001',
      devCode: expect.any(String)
    });

    expect(service.requirePermission).toHaveBeenCalledWith('token-1', 'procurement.create');
    expect(repository.replacePendingChallenges).toHaveBeenCalledWith({ userId: 'user-1', purpose: 'TENDER_CONTACT_EMAIL_CODE', target: 'buyer@example.go.tz' });
    expect(repository.replacePendingChallenges).toHaveBeenCalledWith({ userId: 'user-1', purpose: 'TENDER_CONTACT_PHONE_OTP', target: '+255700000001' });
    expect(notifications.sendTenderContactVerification).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@example.go.tz' }));
    expect(notifications.sendPhoneOtp).toHaveBeenCalledWith(expect.objectContaining({ to: '+255700000001' }));
  });

  it('verifies tender contact codes and consumes the challenge', async () => {
    const { service, repository } = createIdentityService({
      findChallenge: vi.fn().mockResolvedValue({
        id: 'challenge-1',
        userId: 'user-1',
        purpose: 'TENDER_CONTACT_PHONE_OTP',
        target: '+255700000001',
        status: 'PENDING',
        attempts: 0,
        expiresAt,
        codeHash: sha256('123456')
      })
    });

    await expect(service.verifyTenderContact('token-1', 'challenge-1', '123456')).resolves.toEqual({
      verified: true,
      channel: 'phone',
      target: '+255700000001',
      verifiedAt: '2099-07-01T08:02:00.000Z'
    });
    expect(repository.consumeChallenge).toHaveBeenCalledWith('challenge-1');
  });

  it('rejects wrong, expired, unauthorized, and over-attempt contact codes', async () => {
    const baseChallenge = {
      id: 'challenge-1',
      userId: 'user-1',
      purpose: 'TENDER_CONTACT_EMAIL_CODE',
      target: 'buyer@example.go.tz',
      status: 'PENDING',
      attempts: 0,
      expiresAt,
      codeHash: sha256('123456')
    };
    const wrong = createIdentityService({ findChallenge: vi.fn().mockResolvedValue(baseChallenge) });
    await expect(wrong.service.verifyTenderContact('token-1', 'challenge-1', '000000')).rejects.toThrow('Contact verification code is incorrect.');
    expect(wrong.repository.incrementChallengeAttempts).toHaveBeenCalledWith('challenge-1');

    const expired = createIdentityService({ findChallenge: vi.fn().mockResolvedValue({ ...baseChallenge, expiresAt: new Date('2020-01-01T00:00:00.000Z') }) });
    await expect(expired.service.verifyTenderContact('token-1', 'challenge-1', '123456')).rejects.toThrow('Contact verification code is no longer valid.');

    const tooMany = createIdentityService({ findChallenge: vi.fn().mockResolvedValue({ ...baseChallenge, attempts: 5 }) });
    await expect(tooMany.service.verifyTenderContact('token-1', 'challenge-1', '123456')).rejects.toThrow('Too many contact verification attempts.');

    const unauthorized = createIdentityService({ findChallenge: vi.fn().mockResolvedValue({ ...baseChallenge, userId: 'other-user' }) });
    await expect(unauthorized.service.verifyTenderContact('token-1', 'challenge-1', '123456')).rejects.toThrow('Contact verification code was not found.');
  });
});

function findControl(sections: Array<{ controls: DesignFormControlDto[] }>, id: string): DesignFormControlDto | undefined {
  const queue = sections.flatMap((section) => section.controls);
  while (queue.length > 0) {
    const control = queue.shift();
    if (!control) continue;
    if (control.id === id) return control;
    queue.push(...(control.columns ?? []), ...(control.fields ?? []), ...(control.panels ?? []));
  }
  return undefined;
}

describe('procurement tender write service', () => {
  const completeGoodsRequirements = {
    quantityScheduleRows: [{ itemDescription: 'Diagnostic kit', unitOfMeasure: 'Each', quantity: 10 }],
    productSpecificationTemplate: { specifications: [{ name: 'Warranty', value: '12 months' }] }
  };

  const createInput: CreateTenderInput = {
    title: 'Supply of laboratory equipment',
    type: TenderType.GOODS,
    description: 'Supply and delivery of diagnostic laboratory equipment.',
    budget: 250000000,
    currency: 'TZS',
    location: 'Dar es Salaam',
    closingDate: '2099-08-30',
    categories: ['Health', 'Equipment'],
    requirements: {},
    metadata: {}
  };

  it('normalizes create tender payloads for frontend labels', () => {
    expect(
      createTenderBodySchema.parse({
        title: 'Road maintenance',
        type: 'Non Consultancy',
        description: 'Routine maintenance services',
        budget: '120000000',
        currency: 'tzs',
        location: 'Dodoma',
        closingDate: '2099-08-30',
        category: ' Consulting ',
        categories: [' Services ', 'consulting']
      })
    ).toMatchObject({
      type: TenderType.SERVICE,
      budget: 120000000,
      currency: 'TZS',
      categories: ['Consulting', 'Services']
    });

    expect(
      createTenderBodySchema.parse({
        title: 'Works draft tender',
        type: 'Works',
        description: 'Routine road maintenance works',
        location: 'Dodoma'
      })
    ).toMatchObject({
      type: TenderType.WORKS,
      currency: 'TZS',
      categories: [],
      requirements: {},
      metadata: {}
    });

    expect(() =>
      createTenderBodySchema.parse({
        ...createInput,
        type: 'Lease'
      })
    ).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, title: 'Bad' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, title: 'x'.repeat(201) })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, description: 'Too short' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, budget: 0 })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, closingDate: '2020-08-30' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, metadata: [] })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, requirements: [] })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, buyerOrgId: 'org-2' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, ownerUserId: 'user-2' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, status: 'OPEN' })).toThrow();
    expect(() => createTenderBodySchema.parse({ ...createInput, visibility: 'PUBLIC_MARKETPLACE' })).toThrow();
  });

  it('validates tender contact verification payloads', () => {
    expect(contactVerificationStartBodySchema.parse({ channel: 'email', target: 'buyer@example.go.tz' })).toEqual({
      channel: 'email',
      target: 'buyer@example.go.tz'
    });
    expect(contactVerificationStartBodySchema.parse({ channel: 'phone', target: '+255700000001' })).toEqual({
      channel: 'phone',
      target: '+255700000001'
    });
    expect(contactVerificationVerifyBodySchema.parse({ challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' })).toEqual({
      challengeId: '11111111-1111-4111-8111-111111111111',
      code: '123456'
    });

    expect(() => contactVerificationStartBodySchema.parse({ channel: 'email', target: 'not-email' })).toThrow();
    expect(() => contactVerificationStartBodySchema.parse({ channel: 'phone', target: '123' })).toThrow();
    expect(() => contactVerificationStartBodySchema.parse({ channel: 'fax', target: '+255700000001' })).toThrow();
    expect(() => contactVerificationVerifyBodySchema.parse({ challengeId: 'not-a-uuid', code: '123456' })).toThrow();
    expect(() => contactVerificationVerifyBodySchema.parse({ challengeId: '11111111-1111-4111-8111-111111111111', code: '123' })).toThrow();
  });

  it('validates draft tender update payloads', () => {
    expect(
      updateTenderBodySchema.parse({
        title: 'Updated tender title',
        type: 'Non Consultancy',
        budget: '275000000',
        currency: 'tzs',
        closingDate: '2099-09-30',
        category: ' Health ',
        categories: ['Equipment', 'health'],
        metadata: { source: 'buyer-workspace' }
      })
    ).toMatchObject({
      title: 'Updated tender title',
      type: TenderType.SERVICE,
      budget: 275000000,
      currency: 'TZS',
      closingDate: '2099-09-30',
      categories: ['Health', 'Equipment'],
      metadata: { source: 'buyer-workspace' }
    });

    expect(updateTenderBodySchema.parse({ location: 'Dodoma' })).toEqual({ location: 'Dodoma' });
    expect(() => updateTenderBodySchema.parse({})).toThrow();
    expect(() => updateTenderBodySchema.parse({ title: 'Bad' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ title: 'x'.repeat(201) })).toThrow();
    expect(() => updateTenderBodySchema.parse({ description: 'Too short' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ budget: 0 })).toThrow();
    expect(() => updateTenderBodySchema.parse({ closingDate: '2020-08-30' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ type: 'Lease' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ metadata: [] })).toThrow();
    expect(() => updateTenderBodySchema.parse({ requirements: [] })).toThrow();
    expect(() => updateTenderBodySchema.parse({ buyerOrgId: 'org-2' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ ownerUserId: 'user-2' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ reference: 'PX-NEW' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ createdAt: '2026-01-01T00:00:00.000Z' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ status: 'OPEN' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ visibility: 'PUBLIC_MARKETPLACE' })).toThrow();
    expect(() => updateTenderBodySchema.parse({ bids: [] })).toThrow();
    expect(() => updateTenderBodySchema.parse({ bidSummary: {} })).toThrow();
  });

  it('validates publish payloads as empty objects only', () => {
    expect(publishTenderBodySchema.parse({})).toEqual({});
    expect(() => publishTenderBodySchema.parse({ status: 'OPEN' })).toThrow();
    expect(() => publishTenderBodySchema.parse({ publishedAt: '2099-09-30T00:00:00.000Z' })).toThrow();
  });

  it('validates tender language scan payloads', () => {
    expect(
      scanLanguageBodySchema.parse({
        title: 'Supply of ICT equipment',
        description: 'Open and measurable specifications.',
        requirements: { item: 'Laptop' },
        evaluationCriteria: { method: 'Lowest evaluated cost' },
        metadata: { closingDate: '2099-08-30' }
      })
    ).toMatchObject({
      title: 'Supply of ICT equipment',
      requirements: { item: 'Laptop' },
      metadata: { closingDate: '2099-08-30' }
    });
    expect(() => scanLanguageBodySchema.parse({ metadata: [] })).toThrow();
    expect(() => scanLanguageBodySchema.parse({ unsafe: true })).toThrow();
  });

  it('creates draft tenders for the authenticated organization', async () => {
    const createdTender = { success: true, message: 'Tender draft created successfully', data: { id: 'tender-1' } };
    const repository = {
      createTender: vi.fn().mockResolvedValue(createdTender)
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.createTender('token-1', createInput)).resolves.toEqual({
      ...createdTender,
      message: 'Tender draft saved successfully',
      validation: {
        schemaVersion: 'procurement-design-v1',
        warnings: expect.arrayContaining(['Quantity lines is recommended before publishing.', 'Product specification table is recommended before publishing.']),
        missingRequiredFields: expect.arrayContaining([
          { path: 'quantityScheduleRows', label: 'Quantity lines', section: 'Quantity Schedule / BOQ' },
          { path: 'productSpecificationTemplate', label: 'Product specification table', section: 'Product Specification Builder' }
        ])
      }
    });
    expect(identity.requirePermission).toHaveBeenCalledWith('token-1', 'procurement.create');
    expect(repository.createTender).toHaveBeenCalledWith(
      {
        ...createInput,
        categories: ['Medical Equipment', 'ICT Equipment'],
        metadata: {
          schemaVersion: 'procurement-design-v1',
          typeProfile: 'goods',
          categoryStandardization: {
            taxonomyVersion: 'procurement-taxonomy-v1',
            standardCategories: ['Medical Equipment', 'ICT Equipment'],
            mappings: [
              expect.objectContaining({ rawCategory: 'Health', standardCategory: 'Medical Equipment' }),
              expect.objectContaining({ rawCategory: 'Equipment', standardCategory: 'ICT Equipment' })
            ]
          }
        }
      },
      { organizationId: 'org-1', userId: 'user-1' }
    );
  });

  it('starts tender contact verification through the identity challenge service', async () => {
    const identity = {
      startTenderContactVerification: vi.fn().mockResolvedValue({
        challengeId: 'email-challenge',
        channel: 'email',
        target: 'buyer@example.go.tz',
        expiresAt: '2026-07-01T09:00:00.000Z',
        resendAvailableAt: '2026-07-01T08:01:00.000Z',
        maxAttempts: 5,
        devCode: '123456'
      })
    };
    const service = new ModuleService({} as any, identity as any);

    await expect(service.startContactVerification('token-1', { channel: 'email', target: 'buyer@example.go.tz' })).resolves.toMatchObject({
      challengeId: 'email-challenge',
      devCode: '123456'
    });
    expect(identity.startTenderContactVerification).toHaveBeenCalledWith('token-1', { channel: 'email', target: 'buyer@example.go.tz' });
  });

  it('verifies tender contact codes through the identity challenge service', async () => {
    const identity = {
      verifyTenderContact: vi.fn().mockResolvedValue({
        verified: true,
        channel: 'phone',
        target: '+255700000001',
        verifiedAt: '2026-07-01T08:02:00.000Z'
      })
    };
    const service = new ModuleService({} as any, identity as any);

    await expect(service.verifyContactVerification('token-1', { challengeId: '11111111-1111-4111-8111-111111111111', code: '123456' })).resolves.toMatchObject({
      verified: true,
      target: '+255700000001'
    });
    expect(identity.verifyTenderContact).toHaveBeenCalledWith('token-1', '11111111-1111-4111-8111-111111111111', '123456');
  });

  it('standardizes Others during draft tender creation', async () => {
    const createdTender = { success: true, message: 'Tender draft created successfully', data: { id: 'tender-other' } };
    const repository = {
      createTender: vi.fn().mockResolvedValue(createdTender)
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.createTender('token-1', { ...createInput, categories: ['Others'] })).resolves.toMatchObject({
      success: true,
      message: 'Tender draft saved successfully'
    });
    expect(repository.createTender).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['Other Goods'],
        metadata: expect.objectContaining({
          categoryStandardization: expect.objectContaining({
            standardCategories: ['Other Goods'],
            mappings: [expect.objectContaining({ rawCategory: 'Others', standardCategory: 'Other Goods', confidence: 1 })]
          })
        })
      }),
      { organizationId: 'org-1', userId: 'user-1' }
    );
  });

  it('accepts legacy unit aliases during draft schema validation', async () => {
    const createdTender = { success: true, message: 'Tender draft created successfully', data: { id: 'tender-units' } };
    const repository = {
      createTender: vi.fn().mockResolvedValue(createdTender)
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(
      service.createTender('token-1', {
        ...createInput,
        requirements: {
          goods: {
            fields: {
              quantityScheduleRows: [{ itemDescription: 'Diagnostic kit', unitOfMeasure: 'Pcs', quantity: 10 }],
              productSpecificationTemplate: { specifications: [{ name: 'Warranty', value: '12 months' }] }
            }
          }
        }
      })
    ).resolves.toMatchObject({
      success: true,
      message: 'Tender draft saved successfully'
    });
    expect(repository.createTender).toHaveBeenCalled();
  });

  it('accepts financial evidence tag arrays and legacy strings during draft schema validation', async () => {
    const createdTender = { success: true, message: 'Tender draft created successfully', data: { id: 'tender-evidence' } };
    const repository = {
      createTender: vi.fn().mockResolvedValue(createdTender)
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(
      service.createTender('token-1', {
        ...createInput,
        requirements: {
          goods: {
            fields: {
              quantityScheduleRows: [{ itemDescription: 'Diagnostic kit', unitOfMeasure: 'Each', quantity: 10 }],
              productSpecificationTemplate: { specifications: [{ name: 'Warranty', value: '12 months' }] },
              financialRequirementRows: [
                { requirementType: 'Access to Credit', evidenceRequired: ['Bank statement'], mandatory: true },
                { requirementType: 'Minimum Annual Turnover', evidenceRequired: 'Audited accounts', mandatory: true }
              ]
            }
          }
        }
      })
    ).resolves.toMatchObject({
      success: true,
      message: 'Tender draft saved successfully'
    });
    expect(repository.createTender).toHaveBeenCalled();
  });

  it('rejects invalid financial evidence tag options before repository writes', async () => {
    const repository = {
      createTender: vi.fn()
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(
      service.createTender('token-1', {
        ...createInput,
        requirements: {
          goods: {
            fields: {
              quantityScheduleRows: [{ itemDescription: 'Diagnostic kit', unitOfMeasure: 'Each', quantity: 10 }],
              productSpecificationTemplate: { specifications: [{ name: 'Warranty', value: '12 months' }] },
              financialRequirementRows: [{ requirementType: 'Access to Credit', evidenceRequired: ['Unsupported evidence'], mandatory: true }]
            }
          }
        }
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Evidence required must be one of the configured options.'
    });
    expect(repository.createTender).not.toHaveBeenCalled();
  });

  it('rejects clearly malformed draft schema field values before repository writes', async () => {
    const repository = {
      createTender: vi.fn()
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(
      service.createTender('token-1', {
        ...createInput,
        requirements: { quantityScheduleRows: 'not-a-table' }
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Quantity lines must be an array.'
    });
    expect(repository.createTender).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated tender creation before repository writes', async () => {
    const repository = {
      createTender: vi.fn()
    };
    const identity = {
      requirePermission: vi.fn().mockRejectedValue(Object.assign(new Error('Authentication is required.'), { status: 401 }))
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.createTender(undefined, createInput)).rejects.toMatchObject({
      status: 401,
      message: 'Authentication is required.'
    });
    expect(identity.requirePermission).toHaveBeenCalledWith(undefined, 'procurement.create');
    expect(repository.createTender).not.toHaveBeenCalled();
  });

  it('requires organization context before tender creation', async () => {
    const service = new ModuleService({} as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);

    await expect(service.createTender('token-1', createInput)).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });

  it('updates draft tenders for the authenticated organization', async () => {
    const updateInput: UpdateTenderInput = {
      title: 'Updated tender title',
      type: TenderType.GOODS,
      categories: ['Health']
    };
    const updatedTender = { success: true, message: 'Tender updated successfully', data: { id: 'tender-1' } };
    const repository = {
      getTenderForUpdate: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        status: TenderStatus.DRAFT,
        type: TenderType.GOODS
      }),
      updateTender: vi.fn().mockResolvedValue(updatedTender)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.updateTender('tender-1', 'token-1', updateInput)).resolves.toEqual({
      ...updatedTender,
      message: 'Tender draft saved successfully',
      validation: {
        warnings: [],
        missingRequiredFields: [],
        schemaVersion: 'procurement-design-v1'
      }
    });
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.getTenderForUpdate).toHaveBeenCalledWith('tender-1');
    expect(repository.updateTender).toHaveBeenCalledWith(
      'tender-1',
      {
        ...updateInput,
        categories: ['Medical Equipment'],
        metadata: {
          schemaVersion: 'procurement-design-v1',
          typeProfile: 'goods',
          categoryStandardization: {
            taxonomyVersion: 'procurement-taxonomy-v1',
            standardCategories: ['Medical Equipment'],
            mappings: [expect.objectContaining({ rawCategory: 'Health', standardCategory: 'Medical Equipment' })]
          }
        }
      },
      { organizationId: 'org-1', userId: 'user-1' }
    );
  });

  it('returns draft validation warnings for partial update requirements without blocking save', async () => {
    const updatedTender = { success: true, message: 'Tender updated successfully', data: { id: 'tender-1' } };
    const repository = {
      getTenderForUpdate: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        status: TenderStatus.DRAFT,
        type: TenderType.GOODS
      }),
      updateTender: vi.fn().mockResolvedValue(updatedTender)
    };
    const service = new ModuleService(repository as any, {
      requireSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    } as any);

    await expect(service.updateTender('tender-1', 'token-1', { requirements: { productSpecificationTemplate: { rows: [] } } })).resolves.toMatchObject({
      validation: {
        schemaVersion: 'procurement-design-v1',
        missingRequiredFields: [{ path: 'quantityScheduleRows', label: 'Quantity lines', section: 'Quantity Schedule / BOQ' }]
      }
    });
  });

  it('requires organization context before tender updates', async () => {
    const service = new ModuleService({} as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);

    await expect(service.updateTender('tender-1', 'token-1', { title: 'Updated title' })).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });

  it('deletes draft tenders for the authenticated owner organization', async () => {
    const deletedTender = {
      success: true,
      message: 'Tender draft deleted successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-DRAFT-001',
        title: 'Draft owned tender'
      }
    };
    const repository = {
      deleteTenderDraft: vi.fn().mockResolvedValue(deletedTender)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.deleteTenderDraft('tender-1', 'token-1')).resolves.toEqual(deletedTender);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.deleteTenderDraft).toHaveBeenCalledWith('tender-1', { organizationId: 'org-1', userId: 'user-1' });
  });

  it('requires organization context before tender draft deletion', async () => {
    const repository = {
      deleteTenderDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);

    await expect(service.deleteTenderDraft('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
    expect(repository.deleteTenderDraft).not.toHaveBeenCalled();
  });

  it('updates buyer notices for the authenticated owner organization', async () => {
    const updatedNotice = {
      success: true,
      message: 'Buyer notice saved successfully',
      data: {
        id: 'tender-1',
        buyerNotice: 'Site visit starts at Gate B.',
        updatedAt: '2099-08-01T10:00:00.000Z'
      }
    };
    const repository = {
      updateTenderBuyerNotice: vi.fn().mockResolvedValue(updatedNotice)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.updateTenderBuyerNotice('tender-1', 'token-1', { buyerNotice: 'Site visit starts at Gate B.' })).resolves.toEqual(updatedNotice);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.updateTenderBuyerNotice).toHaveBeenCalledWith(
      'tender-1',
      { buyerNotice: 'Site visit starts at Gate B.' },
      { organizationId: 'org-1', userId: 'user-1' }
    );
  });

  it('submits owner organization tenders for admin review only when the draft is complete', async () => {
    const tender = {
      id: 'tender-1',
      buyerOrgId: 'org-1',
      title: 'Supply of laboratory equipment',
      type: TenderType.GOODS,
      method: ProcurementMethod.OPEN_TENDER,
      description: 'Supply and delivery of diagnostic laboratory equipment.',
      budget: 250000000,
      status: TenderStatus.DRAFT,
      location: 'Dar es Salaam',
      closingDate: new Date('2099-08-30T00:00:00.000Z'),
      requirements: completeGoodsRequirements,
      metadata: {},
      categories: [{ name: 'computer supplies' }]
    };
    const submittedTender = {
      success: true,
      message: 'Tender submitted for admin review',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-001',
        title: 'Supply of laboratory equipment',
        status: 'Under Review',
        visibility: 'PRIVATE',
        publishedAt: '',
        closingDate: '2099-08-30'
      }
    };
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue(tender),
      recordTenderLanguageScan: vi.fn().mockResolvedValue(undefined),
      applyTenderCategoryStandardization: vi.fn().mockResolvedValue(undefined),
      submitTenderForReview: vi.fn().mockResolvedValue(submittedTender)
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.publishTender('tender-1', 'token-1')).resolves.toMatchObject({
      ...submittedTender,
      validation: {
        warnings: [],
        scannerIssues: [],
        standardizedCategories: ['ICT Equipment']
      },
      languageScan: {
        riskLevel: 'Low',
        score: 0,
        issues: []
      }
    });
    expect(identity.requirePermission).toHaveBeenCalledWith('token-1', 'procurement.publish');
    expect(repository.recordTenderLanguageScan).toHaveBeenCalledWith('tender-1', {
      riskLevel: 'Low',
      score: 0,
      issues: []
    });
    expect(repository.applyTenderCategoryStandardization).toHaveBeenCalledWith(
      'tender-1',
      ['ICT Equipment'],
      expect.objectContaining({
        categoryStandardization: expect.objectContaining({
          taxonomyVersion: 'procurement-taxonomy-v1',
          standardCategories: ['ICT Equipment'],
          mappings: [expect.objectContaining({ rawCategory: 'computer supplies', standardCategory: 'ICT Equipment' })]
        })
      })
    );
    expect(repository.submitTenderForReview).toHaveBeenCalledWith('tender-1', 'org-1', { userId: 'user-1' });
  });

  it('allows medium-risk tender language during review submission and returns scan warnings', async () => {
    const submittedTender = {
      success: true,
      message: 'Tender submitted for admin review',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-001',
        title: 'Supply of laboratory equipment',
        status: 'Under Review',
        visibility: 'PRIVATE',
        publishedAt: '',
        closingDate: '2099-08-30'
      }
    };
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        method: ProcurementMethod.OPEN_TENDER,
        description: 'Local suppliers only may participate in this procurement.',
        budget: 250000000,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: completeGoodsRequirements,
        metadata: {},
        categories: [{ name: 'laptops' }]
      }),
      recordTenderLanguageScan: vi.fn().mockResolvedValue(undefined),
      applyTenderCategoryStandardization: vi.fn().mockResolvedValue(undefined),
      submitTenderForReview: vi.fn().mockResolvedValue(submittedTender)
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).resolves.toMatchObject({
      validation: {
        warnings: [expect.stringContaining('local-only-restriction')],
        scannerIssues: [expect.objectContaining({ type: 'local-only-restriction' })],
        standardizedCategories: ['ICT Equipment']
      },
      languageScan: {
        riskLevel: 'Medium',
        issues: [expect.objectContaining({ type: 'local-only-restriction' })]
      }
    });
    expect(repository.applyTenderCategoryStandardization).toHaveBeenCalledWith(
      'tender-1',
      ['ICT Equipment'],
      expect.objectContaining({
        categoryStandardization: expect.objectContaining({ standardCategories: ['ICT Equipment'] })
      })
    );
    expect(repository.submitTenderForReview).toHaveBeenCalledWith('tender-1', 'org-1', { userId: 'user-1' });
  });

  it('submits invited tenders for review while keeping them private', async () => {
    const submittedTender = {
      success: true,
      message: 'Tender submitted for admin review',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-001',
        title: 'Supply of laboratory equipment',
        status: 'Under Review',
        visibility: Visibility.PRIVATE,
        publishedAt: '',
        closingDate: '2099-08-30'
      }
    };
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        method: ProcurementMethod.INVITED_TENDER,
        description: 'Supply and delivery of diagnostic laboratory equipment.',
        budget: 250000000,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: completeGoodsRequirements,
        metadata: {},
        categories: [{ name: 'laptops' }]
      }),
      recordTenderLanguageScan: vi.fn().mockResolvedValue(undefined),
      applyTenderCategoryStandardization: vi.fn().mockResolvedValue(undefined),
      submitTenderForReview: vi.fn().mockResolvedValue(submittedTender)
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).resolves.toMatchObject({
      data: { status: 'Under Review', visibility: Visibility.PRIVATE },
      validation: { standardizedCategories: ['ICT Equipment'] }
    });
    expect(repository.submitTenderForReview).toHaveBeenCalledWith('tender-1', 'org-1', { userId: 'user-1' });
  });

  it('blocks high-risk tender language during publish after persisting the scan', async () => {
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        title: 'Supply of HP ICT equipment',
        type: TenderType.GOODS,
        method: ProcurementMethod.OPEN_TENDER,
        description: 'Only HP brand devices from a preferred supplier will be accepted. No equivalent products.',
        budget: 250000000,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: completeGoodsRequirements,
        metadata: {},
        categories: [{ name: 'laptops' }]
      }),
      recordTenderLanguageScan: vi.fn().mockResolvedValue(undefined),
      applyTenderCategoryStandardization: vi.fn().mockResolvedValue(undefined),
      publishTender: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'Tender cannot be published',
      code: 'PUBLISH_VALIDATION_FAILED',
      errors: expect.arrayContaining([expect.objectContaining({ step: 'language-scan', severity: 'error' })])
    });
    expect(repository.recordTenderLanguageScan).toHaveBeenCalledWith(
      'tender-1',
      expect.objectContaining({
        riskLevel: 'High',
        issues: expect.arrayContaining([
          expect.objectContaining({ type: 'brand-only-restriction' }),
          expect.objectContaining({ type: 'conflict-of-interest-phrase' })
        ])
      })
    );
    expect(repository.publishTender).not.toHaveBeenCalled();
  });

  it('rejects publish attempts from another organization', async () => {
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        buyerOrgId: 'org-2',
        title: 'Tender',
        type: TenderType.GOODS,
        description: 'Details',
        budget: 1,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: { technical: true }
      }),
      publishTender: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).rejects.toMatchObject({ status: 403 });
    expect(repository.publishTender).not.toHaveBeenCalled();
  });

  it('blocks publication when schema-required design fields are incomplete', async () => {
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        buyerOrgId: 'org-1',
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        description: 'Supply and delivery of diagnostic laboratory equipment.',
        budget: 250000000,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: { technical: true }
      }),
      publishTender: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 400,
      message: 'Tender cannot be published',
      code: 'PUBLISH_VALIDATION_FAILED',
      errors: expect.arrayContaining([expect.objectContaining({ step: 'schema-required-fields' })])
    });
    expect(repository.publishTender).not.toHaveBeenCalled();
  });

  it('blocks publication when evaluation criteria weights do not total 100', async () => {
    const repository = {
      getTenderForPublication: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        method: ProcurementMethod.OPEN_TENDER,
        description: 'Supply and delivery of diagnostic laboratory equipment.',
        budget: 250000000,
        status: TenderStatus.DRAFT,
        location: 'Dar es Salaam',
        closingDate: new Date('2099-08-30T00:00:00.000Z'),
        requirements: completeGoodsRequirements,
        metadata: {
          evaluationCriteria: [
            { name: 'Technical', weight: 60 },
            { name: 'Financial', weight: 20 }
          ]
        },
        categories: [{ name: 'laptops' }]
      }),
      applyTenderCategoryStandardization: vi.fn(),
      recordTenderLanguageScan: vi.fn(),
      publishTender: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.publishTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 400,
      code: 'PUBLISH_VALIDATION_FAILED',
      errors: [expect.objectContaining({ step: 'evaluation-criteria', field: 'metadata.evaluationCriteria' })]
    });
    expect(repository.applyTenderCategoryStandardization).not.toHaveBeenCalled();
    expect(repository.recordTenderLanguageScan).not.toHaveBeenCalled();
    expect(repository.publishTender).not.toHaveBeenCalled();
  });

  it('rejects publish attempts for invalid status or incomplete tender fields', async () => {
    const baseTender = {
      buyerOrgId: 'org-1',
      title: 'Tender',
      type: TenderType.GOODS,
      description: 'Details',
      budget: 1,
      status: TenderStatus.DRAFT,
      location: 'Dar es Salaam',
      closingDate: new Date('2099-08-30T00:00:00.000Z'),
      requirements: { technical: true }
    };
    const identity = {
      requirePermission: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };

    for (const tender of [
      { ...baseTender, status: TenderStatus.OPEN },
      { ...baseTender, status: TenderStatus.PUBLISHED },
      { ...baseTender, status: TenderStatus.CLOSED },
      { ...baseTender, status: TenderStatus.EVALUATION },
      { ...baseTender, status: TenderStatus.AWARDED },
      { ...baseTender, status: TenderStatus.CANCELLED },
      { ...baseTender, title: '' },
      { ...baseTender, description: '' },
      { ...baseTender, budget: 0 },
      { ...baseTender, location: '' },
      { ...baseTender, closingDate: null },
      { ...baseTender, closingDate: new Date(Date.now() - 86400000) },
      { ...baseTender, requirements: {} }
    ]) {
      const service = new ModuleService(
        {
          getTenderForPublication: vi.fn().mockResolvedValue(tender),
          publishTender: vi.fn()
        } as any,
        identity as any
      );

      await expect(service.publishTender('tender-1', 'token-1')).rejects.toMatchObject({ status: expect.any(Number) });
    }
  });

  it('closes open tenders for the authenticated owner organization', async () => {
    const closedTender = {
      success: true,
      message: 'Tender closed successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-001',
        title: 'Supply of laboratory equipment',
        status: 'Closed',
        closingDate: '2099-09-30',
        updatedAt: '2026-06-26T09:00:00.000Z'
      }
    };
    const repository = {
      getTenderForClose: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-1',
        status: TenderStatus.OPEN
      }),
      closeTender: vi.fn().mockResolvedValue(closedTender)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({
        user: { id: 'user-1', organizationId: 'org-1' }
      })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.closeTender('tender-1', 'token-1')).resolves.toBe(closedTender);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.closeTender).toHaveBeenCalledWith('tender-1', 'org-1');
  });

  it('requires organization context before closing tenders', async () => {
    const service = new ModuleService({} as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);

    await expect(service.closeTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });

  it('rejects close attempts from another organization', async () => {
    const repository = {
      getTenderForClose: vi.fn().mockResolvedValue({
        id: 'tender-1',
        buyerOrgId: 'org-2',
        status: TenderStatus.OPEN
      }),
      closeTender: vi.fn()
    };
    const service = new ModuleService(repository as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    } as any);

    await expect(service.closeTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 403,
      message: 'Only the owner organization can close this tender.'
    });
    expect(repository.closeTender).not.toHaveBeenCalled();
  });

  it('rejects close attempts for missing or non-open tenders', async () => {
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };

    const missingService = new ModuleService(
      {
        getTenderForClose: vi.fn().mockResolvedValue(null),
        closeTender: vi.fn()
      } as any,
      identity as any
    );
    await expect(missingService.closeTender('missing-tender', 'token-1')).rejects.toMatchObject({ status: 404 });

    for (const status of [TenderStatus.DRAFT, TenderStatus.REVIEW, TenderStatus.CANCELLED, TenderStatus.AWARDED, TenderStatus.EVALUATION, TenderStatus.CLOSED]) {
      const repository = {
        getTenderForClose: vi.fn().mockResolvedValue({
          id: 'tender-1',
          buyerOrgId: 'org-1',
          status
        }),
        closeTender: vi.fn()
      };
      const service = new ModuleService(repository as any, identity as any);

      await expect(service.closeTender('tender-1', 'token-1')).rejects.toMatchObject({
        status: 409,
        message: 'Only open or published tenders can be closed.'
      });
      expect(repository.closeTender).not.toHaveBeenCalled();
    }
  });

  it('saves tenders for the authenticated organization and user', async () => {
    const saved = {
      success: true,
      message: 'Tender saved successfully'
    };
    const repository = {
      saveTender: vi.fn().mockResolvedValue(saved)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.saveTender('tender-1', 'token-1')).resolves.toBe(saved);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.saveTender).toHaveBeenCalledWith('tender-1', { organizationId: 'org-1', userId: 'user-1' });
  });

  it('removes saved tenders idempotently for the authenticated organization', async () => {
    const removed = {
      success: true,
      message: 'Tender removed from saved tenders'
    };
    const repository = {
      unsaveTender: vi.fn().mockResolvedValue(removed)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.unsaveTender('tender-1', 'token-1')).resolves.toBe(removed);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.unsaveTender).toHaveBeenCalledWith('tender-1', 'org-1');
  });

  it('lists saved tenders for the authenticated organization', async () => {
    const payload = { tenders: [] };
    const repository = {
      getSavedTenders: vi.fn().mockResolvedValue(payload)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.savedTenders('token-1')).resolves.toBe(payload);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.getSavedTenders).toHaveBeenCalledWith('org-1');
  });

  it('records tender document downloads with authenticated context when available', async () => {
    const response = {
      success: true,
      message: 'Document download recorded'
    };
    const repository = {
      recordTenderDocumentDownload: vi.fn().mockResolvedValue(response)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.recordTenderDocumentDownload('tender-1', 'doc-1', 'token-1')).resolves.toBe(response);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.recordTenderDocumentDownload).toHaveBeenCalledWith('tender-1', 'doc-1', { organizationId: 'org-1', userId: 'user-1' });
  });

  it('requires organization context for saved tender operations', async () => {
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    };
    const service = new ModuleService({} as any, identity as any);

    await expect(service.saveTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
    await expect(service.unsaveTender('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
    await expect(service.savedTenders('token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });
});
