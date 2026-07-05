import { BidStatus, OrganizationCapabilityName, TenderStatus, TenderType, Visibility } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleController } from './controller.js';
import { ModuleRepository } from './repository.js';
import { ModuleService } from './service.js';

describe('intelligence supplier recommendations service', () => {
  it('requires auth and organization context before loading recommendations', async () => {
    const repository = {
      recommendedTenders: vi.fn().mockResolvedValue({ success: true, data: [] })
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'supplier-org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.recommendedTenders('token-1')).resolves.toEqual({ success: true, data: [] });
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.recommendedTenders).toHaveBeenCalledWith({ organizationId: 'supplier-org-1', userId: 'user-1' });

    const missingOrgService = new ModuleService({} as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);
    await expect(missingOrgService.recommendedTenders('token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });

  it('requires auth and organization context before loading buyer-side supplier recommendations', async () => {
    const repository = {
      supplierRecommendations: vi.fn().mockResolvedValue({ success: true, data: [] })
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'buyer-org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.supplierRecommendations('tender-1', 'token-1')).resolves.toEqual({ success: true, data: [] });
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.supplierRecommendations).toHaveBeenCalledWith('tender-1', { organizationId: 'buyer-org-1', userId: 'user-1' });

    const missingTenderService = new ModuleService(
      {
        supplierRecommendations: vi.fn().mockResolvedValue(null)
      } as any,
      identity as any
    );
    await expect(missingTenderService.supplierRecommendations('missing-tender', 'token-1')).rejects.toMatchObject({
      status: 404,
      message: 'Tender was not found.'
    });

    const missingOrgService = new ModuleService({} as any, {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } })
    } as any);
    await expect(missingOrgService.supplierRecommendations('tender-1', 'token-1')).rejects.toMatchObject({
      status: 409,
      message: 'An organization profile is required.'
    });
  });

  it('requires auth before loading marketplace analytics', async () => {
    const payload = {
      success: true,
      data: analyticsPayload()
    };
    const repository = {
      marketplaceAnalytics: vi.fn().mockResolvedValue(payload)
    };
    const identity = {
      requireSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', organizationId: 'org-1' } })
    };
    const service = new ModuleService(repository as any, identity as any);

    await expect(service.marketplaceAnalytics('token-1')).resolves.toBe(payload);
    expect(identity.requireSession).toHaveBeenCalledWith('token-1');
    expect(repository.marketplaceAnalytics).toHaveBeenCalledWith();
  });
});

describe('intelligence supplier recommendations controller', () => {
  it('forwards bearer auth to the recommendation service', async () => {
    const service = {
      recommendedTenders: vi.fn().mockResolvedValue({ success: true, data: [] })
    };
    const controller = new ModuleController(service as any);
    const req = {
      header: vi.fn().mockReturnValue('Bearer token-1')
    };
    const res = {
      json: vi.fn()
    };
    const next = vi.fn();

    await controller.recommendedTenders(req as any, res as any, next);

    expect(service.recommendedTenders).toHaveBeenCalledWith('token-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it('validates tender id and forwards buyer-side supplier recommendation requests', async () => {
    const service = {
      supplierRecommendations: vi.fn().mockResolvedValue({ success: true, data: [] })
    };
    const controller = new ModuleController(service as any);
    const req = {
      header: vi.fn().mockReturnValue('Bearer token-1'),
      params: { tenderId: '11111111-1111-4111-8111-111111111111' }
    };
    const res = {
      json: vi.fn()
    };
    const next = vi.fn();

    await controller.supplierRecommendations(req as any, res as any, next);

    expect(service.supplierRecommendations).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'token-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards bearer auth to marketplace analytics', async () => {
    const payload = {
      success: true,
      data: analyticsPayload()
    };
    const service = {
      marketplaceAnalytics: vi.fn().mockResolvedValue(payload)
    };
    const controller = new ModuleController(service as any);
    const req = {
      header: vi.fn().mockReturnValue('Bearer token-1')
    };
    const res = {
      json: vi.fn()
    };
    const next = vi.fn();

    await controller.marketplaceAnalytics(req as any, res as any, next);

    expect(service.marketplaceAnalytics).toHaveBeenCalledWith('token-1');
    expect(res.json).toHaveBeenCalledWith(payload);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('intelligence supplier recommendations repository', () => {
  it('scores, sorts, caps, maps safe rows, and persists supplier match signals', async () => {
    const topTender = tenderRecord({
      id: 'tender-top',
      title: 'Supply of medical equipment',
      type: TenderType.GOODS,
      categories: [{ name: 'Health' }, { name: 'Equipment' }],
      location: 'Dar es Salaam',
      budget: 250000000,
      closingDate: new Date('2099-08-30T00:00:00.000Z')
    });
    const locationOnlyTender = tenderRecord({
      id: 'tender-location',
      title: 'Consultancy support',
      type: TenderType.CONSULTANCY,
      categories: [{ name: 'Strategy' }],
      location: 'Dar es Salaam',
      budget: 750000000,
      closingDate: new Date('2099-08-01T00:00:00.000Z')
    });
    const zeroScoreTender = tenderRecord({
      id: 'tender-zero',
      title: 'Bridge works',
      type: TenderType.WORKS,
      categories: [{ name: 'Roads' }],
      location: 'Mwanza',
      budget: 900000000,
      closingDate: new Date('2099-07-01T00:00:00.000Z')
    });
    const extraTenders = Array.from({ length: 25 }, (_, index) =>
      tenderRecord({
        id: `tender-extra-${index}`,
        title: `Medical supplies ${index}`,
        type: TenderType.GOODS,
        categories: [{ name: 'Health' }],
        location: 'Dodoma',
        budget: 200000000 + index,
        closingDate: new Date(`2099-09-${String((index % 20) + 1).padStart(2, '0')}T00:00:00.000Z`)
      })
    );
    const tx = {
      supplierMatchSignal: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 20 })
      }
    };
    const db = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'supplier-org-1',
          name: 'Supplier Org',
          metadata: { operatingLocations: ['Dar es Salaam'] },
          supplierProfile: {
            bidLimit: 300000000,
            categories: ['Health', 'Equipment']
          },
          profile: {
            payload: {
              preferredTenderTypes: ['Goods'],
              operatingLocations: ['Dar es Salaam']
            }
          },
          capabilities: [{ capability: 'SUPPLIER' }]
        })
      },
      bid: {
        findMany: vi.fn().mockResolvedValue([
          {
            tender: {
              type: TenderType.GOODS,
              categories: [{ name: 'Health' }]
            }
          }
        ])
      },
      tender: {
        findMany: vi.fn().mockResolvedValue([zeroScoreTender, locationOnlyTender, ...extraTenders, topTender])
      },
      savedTender: {
        findMany: vi.fn().mockResolvedValue([{ tenderId: 'tender-top' }])
      },
      $transaction: vi.fn((callback) => callback(tx))
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.recommendedTenders({ organizationId: 'supplier-org-1', userId: 'user-1' });

    expect(db.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          buyerOrgId: { not: 'supplier-org-1' },
          visibility: Visibility.PUBLIC_MARKETPLACE,
          status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] },
          closingDate: { gt: expect.any(Date) }
        }),
        include: expect.objectContaining({
          buyerOrg: { select: { id: true, name: true } },
          categories: { select: { name: true }, orderBy: { name: 'asc' } }
        }),
        take: 1000
      })
    );
    expect(db.savedTender.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'supplier-org-1' },
      select: { tenderId: true }
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(20);
    expect(result.data[0]).toMatchObject({
      id: 'tender-top',
      title: 'Supply of medical equipment',
      organization: 'Medical Stores Department',
      ownerOrganization: 'Medical Stores Department',
      type: 'Goods',
      category: 'Health / Equipment',
      description: 'Diagnostic equipment package',
      location: 'Dar es Salaam',
      budget: 250000000,
      status: 'Open',
      reference: 'PX-2026-001',
      publishedAt: '2026-07-01T08:00:00.000Z',
      closingDate: '2099-08-30',
      createdByCurrentUser: false,
      isSaved: true,
      matchScore: 100,
      matchReasons: [
        'Category matches supplier profile',
        'Tender type matches supplier preference',
        'Location matches supplier operating area',
        'Budget is within supplier capacity',
        'Similar previous bid history'
      ]
    });
    const unsavedRow = result.data.find((row) => row.id !== 'tender-top');
    expect(unsavedRow?.isSaved).toBe(false);
    expect(result.data.some((row) => row.id === 'tender-zero')).toBe(false);
    expect(Object.keys(result.data[0]).sort()).toEqual(
      [
        'budget',
        'category',
        'closingDate',
        'createdByCurrentUser',
        'description',
        'id',
        'isSaved',
        'location',
        'matchReasons',
        'matchScore',
        'organization',
        'ownerOrganization',
        'publishedAt',
        'reference',
        'status',
        'title',
        'type'
      ].sort()
    );
    expect(tx.supplierMatchSignal.deleteMany).toHaveBeenCalledWith({
      where: {
        supplierOrgId: 'supplier-org-1',
        tenderId: { not: null },
        AND: [
          { payload: { path: ['scoringVersion'], equals: 'supplier-recommendations-v1' } },
          { NOT: { payload: { path: ['direction'], equals: 'buyer_supplier_recommendation' } } }
        ]
      }
    });
    expect(tx.supplierMatchSignal.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenderId: 'tender-top',
          supplierOrgId: 'supplier-org-1',
          score: 100,
          payload: expect.objectContaining({
            scoringVersion: 'supplier-recommendations-v1',
            reasons: expect.arrayContaining(['Category matches supplier profile']),
            tenderReference: 'PX-2026-001'
          })
        })
      ])
    });
  });

  it('returns an empty payload and cleans stale supplier-side signals when no positive matches exist', async () => {
    const tx = {
      supplierMatchSignal: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn()
      }
    };
    const db = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'supplier-org-1',
          metadata: {},
          supplierProfile: null,
          profile: null,
          capabilities: []
        })
      },
      bid: {
        findMany: vi.fn().mockResolvedValue([])
      },
      tender: {
        findMany: vi.fn().mockResolvedValue([tenderRecord({ id: 'tender-zero', categories: [{ name: 'Roads' }] })])
      },
      savedTender: {
        findMany: vi.fn().mockResolvedValue([{ tenderId: 'other-tender' }])
      },
      $transaction: vi.fn((callback) => callback(tx))
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.recommendedTenders({ organizationId: 'supplier-org-1', userId: 'user-1' })).resolves.toEqual({
      success: true,
      data: []
    });
    expect(tx.supplierMatchSignal.deleteMany).toHaveBeenCalledWith({
      where: {
        supplierOrgId: 'supplier-org-1',
        tenderId: { not: null },
        AND: [
          { payload: { path: ['scoringVersion'], equals: 'supplier-recommendations-v1' } },
          { NOT: { payload: { path: ['direction'], equals: 'buyer_supplier_recommendation' } } }
        ]
      }
    });
    expect(tx.supplierMatchSignal.createMany).not.toHaveBeenCalled();
  });

  it('returns null for missing tenders and rejects non-owner supplier recommendations', async () => {
    const missingRepository = new ModuleRepository({
      tender: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    } as any);
    await expect(missingRepository.supplierRecommendations('tender-1', { organizationId: 'buyer-org-1', userId: 'user-1' })).resolves.toBeNull();

    const nonOwnerRepository = new ModuleRepository({
      tender: {
        findUnique: vi.fn().mockResolvedValue(tenderRecord({ buyerOrgId: 'other-buyer-org' }))
      }
    } as any);
    await expect(nonOwnerRepository.supplierRecommendations('tender-1', { organizationId: 'buyer-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 403,
      message: 'Only the tender owner organization can view supplier recommendations.'
    });
  });

  it('scores buyer-side supplier recommendations with safe supplier fields and refreshed signals', async () => {
    const tender = tenderRecord({
      id: 'tender-1',
      buyerOrgId: 'buyer-org-1',
      type: TenderType.GOODS,
      categories: [{ name: 'Health' }, { name: 'Equipment' }],
      location: 'Dar es Salaam',
      budget: 250000000
    });
    const suppliers = [
      supplierRecord({
        id: 'supplier-top',
        name: 'Alpha Medical Supplies',
        supplierProfile: {
          bidLimit: 300000000,
          categories: ['Health', 'Equipment']
        },
        profile: {
          summary: 'Medical equipment supplier',
          payload: {
            preferredTenderTypes: ['Goods'],
            operatingLocations: ['Dar es Salaam'],
            categories: ['Health']
          }
        }
      }),
      supplierRecord({
        id: 'supplier-budget',
        name: 'Budget Only Ltd',
        supplierProfile: {
          bidLimit: null,
          categories: []
        },
        profile: {
          summary: null,
          payload: {}
        }
      }),
      supplierRecord({
        id: 'supplier-zero',
        name: 'Road Works Ltd',
        supplierProfile: {
          bidLimit: 100000000,
          categories: ['Roads']
        },
        profile: {
          summary: 'Civil works supplier',
          payload: {
            preferredTenderTypes: ['Works'],
            operatingLocations: ['Mwanza']
          }
        }
      })
    ];
    const extraSuppliers = Array.from({ length: 25 }, (_, index) =>
      supplierRecord({
        id: `supplier-extra-${index}`,
        name: `Health Supplier ${String(index).padStart(2, '0')}`,
        supplierProfile: {
          bidLimit: 500000000,
          categories: ['Health']
        }
      })
    );
    const tx = {
      supplierMatchSignal: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 20 })
      }
    };
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(tender)
      },
      organization: {
        findMany: vi.fn().mockResolvedValue([suppliers[2], ...extraSuppliers, suppliers[1], suppliers[0]])
      },
      bid: {
        findMany: vi.fn().mockResolvedValue([
          {
            supplierOrgId: 'supplier-top',
            tender: {
              type: TenderType.GOODS,
              location: 'Dar es Salaam',
              budget: 200000000,
              categories: [{ name: 'Health' }]
            }
          }
        ])
      },
      $transaction: vi.fn((callback) => callback(tx))
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.supplierRecommendations('tender-1', { organizationId: 'buyer-org-1', userId: 'user-1' });

    expect(db.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: 'buyer-org-1' },
          capabilities: {
            some: {
              capability: OrganizationCapabilityName.SUPPLIER,
              enabled: true
            }
          }
        },
        include: expect.objectContaining({
          supplierProfile: true,
          profile: true,
          capabilities: expect.objectContaining({
            where: { enabled: true },
            select: { capability: true }
          })
        }),
        take: 1000
      })
    );
    expect(db.bid.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierOrgId: { in: expect.arrayContaining(['supplier-top', 'supplier-budget', 'supplier-zero']) },
          status: expect.any(Object)
        },
        select: expect.objectContaining({
          supplierOrgId: true,
          tender: expect.any(Object)
        })
      })
    );
    expect(result?.success).toBe(true);
    expect(result?.data).toHaveLength(20);
    expect(result?.data[0]).toEqual({
      supplierOrgId: 'supplier-top',
      supplierName: 'Alpha Medical Supplies',
      matchScore: 100,
      matchReasons: [
        'Category or capability matches tender',
        'Tender type matches supplier profile',
        'Location matches supplier operating area',
        'Budget is within supplier capacity',
        'Previous relevant procurement history'
      ],
      categories: ['Health', 'Equipment'],
      locations: ['Dar es Salaam'],
      capabilitySummary: 'Medical equipment supplier'
    });
    expect(result?.data.some((row) => row.supplierOrgId === 'supplier-zero')).toBe(false);
    expect(Object.keys(result?.data[0] ?? {}).sort()).toEqual(
      ['capabilitySummary', 'categories', 'locations', 'matchReasons', 'matchScore', 'supplierName', 'supplierOrgId'].sort()
    );
    expect(tx.supplierMatchSignal.deleteMany).toHaveBeenCalledWith({
      where: {
        tenderId: 'tender-1',
        supplierOrgId: { in: result?.data.map((row) => row.supplierOrgId) }
      }
    });
    expect(tx.supplierMatchSignal.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenderId: 'tender-1',
          supplierOrgId: 'supplier-top',
          score: 100,
          payload: expect.objectContaining({
            scoringVersion: 'supplier-recommendations-v1',
            direction: 'buyer_supplier_recommendation',
            reasons: expect.arrayContaining(['Category or capability matches tender']),
            tenderReference: 'PX-2026-001'
          })
        })
      ])
    });
  });

  it('aggregates public marketplace analytics without exposing bid details', async () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const tenders = [
      analyticsTenderRecord({
        id: 'tender-open-1',
        status: TenderStatus.OPEN,
        type: TenderType.GOODS,
        budget: 50000000,
        location: 'Dar es Salaam',
        publishedAt: new Date('2026-01-15T08:00:00.000Z'),
        closingDate: soon,
        buyerOrg: { name: 'Medical Stores Department' },
        categories: [{ name: 'Health' }],
        _count: { bids: 0 }
      }),
      analyticsTenderRecord({
        id: 'tender-open-2',
        status: TenderStatus.OPEN,
        type: TenderType.SERVICE,
        budget: 250000000,
        location: 'Dodoma',
        publishedAt: new Date('2026-02-20T08:00:00.000Z'),
        closingDate: new Date('2099-09-30T00:00:00.000Z'),
        buyerOrg: { name: 'Roads Agency' },
        categories: [{ name: 'Services' }],
        _count: { bids: 5 }
      }),
      analyticsTenderRecord({
        id: 'tender-published-1',
        status: TenderStatus.PUBLISHED,
        type: TenderType.WORKS,
        budget: 1500000000,
        location: null,
        publishedAt: null,
        createdAt: new Date('2026-03-10T08:00:00.000Z'),
        closingDate: new Date('2099-10-30T00:00:00.000Z'),
        buyerOrg: { name: 'Roads Agency' },
        categories: [],
        _count: { bids: 2 }
      })
    ];
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValue(tenders)
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.marketplaceAnalytics();

    expect(db.tender.findMany).toHaveBeenCalledWith({
      where: {
        visibility: Visibility.PUBLIC_MARKETPLACE,
        status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] }
      },
      select: expect.objectContaining({
        id: true,
        type: true,
        status: true,
        budget: true,
        location: true,
        publishedAt: true,
        createdAt: true,
        closingDate: true,
        buyerOrg: { select: { name: true } },
        categories: { select: { name: true }, orderBy: { name: 'asc' } },
        _count: {
          select: {
            bids: {
              where: {
                status: { not: BidStatus.WITHDRAWN }
              }
            }
          }
        }
      }),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5000
    });
    const tenderSelect = db.tender.findMany.mock.calls[0][0].select;
    expect(tenderSelect).not.toHaveProperty('bids');
    expect(tenderSelect).not.toHaveProperty('bidVersions');
    expect(tenderSelect).not.toHaveProperty('evaluations');
    expect(result).toEqual({
      success: true,
      data: {
        openTenders: 2,
        publishedTenders: 1,
        closingSoon: 1,
        totalBudgetValue: 1800000000,
        averageTenderValue: 600000000,
        tendersByType: [
          { label: 'Works', value: 1, amount: 1500000000 },
          { label: 'Non Consultancy', value: 1, amount: 250000000 },
          { label: 'Goods', value: 1, amount: 50000000 }
        ],
        tendersByCategory: [
          { label: 'Works', value: 1, amount: 1500000000 },
          { label: 'Services', value: 1, amount: 250000000 },
          { label: 'Health', value: 1, amount: 50000000 }
        ],
        tendersByLocation: [
          { label: 'Tanzania', value: 1, amount: 1500000000 },
          { label: 'Dodoma', value: 1, amount: 250000000 },
          { label: 'Dar es Salaam', value: 1, amount: 50000000 }
        ],
        tendersByMonth: [
          { label: '2026-03', value: 1, amount: 1500000000 },
          { label: '2026-02', value: 1, amount: 250000000 },
          { label: '2026-01', value: 1, amount: 50000000 }
        ],
        budgetBands: {
          underHundredMillion: { value: 1, amount: 50000000 },
          hundredMillionToOneBillion: { value: 1, amount: 250000000 },
          billionPlus: { value: 1, amount: 1500000000 }
        },
        topBuyerOrganizations: [
          { label: 'Roads Agency', value: 2, amount: 1750000000 },
          { label: 'Medical Stores Department', value: 1, amount: 50000000 }
        ],
        competitionSignals: {
          averageBidsPerTender: 2.33,
          tendersWithNoBids: 1,
          highCompetitionTenders: 1
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain('supplierOrg');
    expect(JSON.stringify(result)).not.toContain('supplierName');
    expect(JSON.stringify(result)).not.toContain('payload');
    expect(JSON.stringify(result)).not.toContain('totalAmount');
    expect(JSON.stringify(result)).not.toContain('receiptHash');
    expect(JSON.stringify(result)).not.toContain('sealedHash');
    expect(JSON.stringify(result)).not.toContain('evaluation');
  });
});

function tenderRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    buyerOrgId: 'buyer-org-1',
    ownerUserId: 'user-2',
    title: 'Supply of medical equipment',
    description: 'Diagnostic equipment package',
    type: TenderType.GOODS,
    status: TenderStatus.OPEN,
    method: 'OPEN_TENDER',
    visibility: Visibility.PUBLIC_MARKETPLACE,
    budget: 250000000,
    currency: 'TZS',
    location: 'Dar es Salaam',
    contractType: null,
    closingDate: new Date('2099-08-30T00:00:00.000Z'),
    publishedAt: new Date('2026-07-01T08:00:00.000Z'),
    requirements: {},
    metadata: {},
    createdAt: new Date('2026-06-20T08:00:00.000Z'),
    updatedAt: new Date('2026-07-02T08:00:00.000Z'),
    buyerOrg: { id: 'buyer-org-1', name: 'Medical Stores Department' },
    categories: [{ name: 'Health' }, { name: 'Equipment' }],
    ...overrides
  };
}

function supplierRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'supplier-org-1',
    name: 'Supplier Org',
    kind: 'COMPANY',
    taxId: 'PRIVATE-TAX-ID',
    country: 'TZ',
    metadata: {},
    createdAt: new Date('2026-06-20T08:00:00.000Z'),
    updatedAt: new Date('2026-07-02T08:00:00.000Z'),
    supplierProfile: {
      bidLimit: 500000000,
      categories: ['Health']
    },
    profile: {
      summary: 'Supplier',
      payload: {
        categories: ['Health'],
        preferredTenderTypes: ['Goods'],
        operatingLocations: ['Dar es Salaam']
      }
    },
    capabilities: [{ capability: OrganizationCapabilityName.SUPPLIER }],
    ...overrides
  };
}

function analyticsTenderRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'analytics-tender-1',
    type: TenderType.GOODS,
    status: TenderStatus.OPEN,
    budget: 100000000,
    location: 'Dar es Salaam',
    publishedAt: new Date('2026-01-01T08:00:00.000Z'),
    createdAt: new Date('2025-12-20T08:00:00.000Z'),
    closingDate: new Date('2099-08-30T00:00:00.000Z'),
    buyerOrg: { name: 'Buyer Org' },
    categories: [{ name: 'Goods' }],
    _count: { bids: 0 },
    ...overrides
  };
}

function analyticsPayload() {
  return {
    openTenders: 0,
    publishedTenders: 0,
    closingSoon: 0,
    totalBudgetValue: 0,
    averageTenderValue: 0,
    tendersByType: [],
    tendersByCategory: [],
    tendersByLocation: [],
    tendersByMonth: [],
    budgetBands: {
      underHundredMillion: { value: 0, amount: 0 },
      hundredMillionToOneBillion: { value: 0, amount: 0 },
      billionPlus: { value: 0, amount: 0 }
    },
    topBuyerOrganizations: [],
    competitionSignals: {
      averageBidsPerTender: 0,
      tendersWithNoBids: 0,
      highCompetitionTenders: 0
    }
  };
}
