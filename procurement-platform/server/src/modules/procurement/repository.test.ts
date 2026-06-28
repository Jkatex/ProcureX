import { BidStatus, TenderStatus, TenderType, Visibility, VerificationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleRepository } from './repository.js';

describe('procurement public welcome repository', () => {
  it('filters featured tenders to public open marketplace opportunities', async () => {
    const db = {
      organization: { count: vi.fn().mockResolvedValue(5) },
      tender: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([])
      },
      user: { count: vi.fn().mockResolvedValue(4) }
    };
    const repository = new ModuleRepository(db as any);

    await repository.getWelcomeData();

    expect(db.tender.count).toHaveBeenCalledWith({
      where: {
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE
      }
    });
    expect(db.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: TenderStatus.OPEN,
          visibility: Visibility.PUBLIC_MARKETPLACE
        },
        take: 3
      })
    );
    expect(db.user.count).toHaveBeenCalledWith({
      where: {
        verificationStatus: VerificationStatus.APPROVED
      }
    });
  });
});

describe('procurement marketplace repository', () => {
  it('maps marketplace payloads into the authenticated frontend contract', async () => {
    const buyerOrgId = 'buyer-org-1';
    const supplierOrgId = 'supplier-org-1';
    const publicTender = {
      id: 'tender-1',
      reference: 'PX-2026-001',
      buyerOrgId,
      ownerUserId: 'user-1',
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
      closingDate: new Date('2026-08-30T00:00:00.000Z'),
      publishedAt: new Date('2026-07-01T08:00:00.000Z'),
      requirements: {},
      metadata: {},
      createdAt: new Date('2026-06-20T08:00:00.000Z'),
      updatedAt: new Date('2026-07-02T08:00:00.000Z'),
      buyerOrg: { id: buyerOrgId, name: 'Medical Stores Department' },
      categories: [{ name: 'Health' }, { name: 'Goods' }],
      bids: []
    };
    const ownDraftTender = {
      ...publicTender,
      id: 'tender-2',
      reference: 'PX-2026-002',
      buyerOrgId: supplierOrgId,
      title: 'Draft road maintenance tender',
      type: TenderType.WORKS,
      status: TenderStatus.DRAFT,
      buyerOrg: { id: supplierOrgId, name: 'Supplier Works Ltd' },
      categories: [{ name: 'Works' }],
      updatedAt: new Date('2026-07-03T08:00:00.000Z')
    };
    const submittedBid = {
      id: 'bid-1',
      tenderId: publicTender.id,
      buyerOrgId,
      supplierOrgId,
      submittedByUserId: 'user-2',
      reference: 'BID-001',
      status: BidStatus.SUBMITTED,
      submittedAt: new Date('2026-07-10T08:00:00.000Z'),
      totalAmount: 225000000,
      currency: 'TZS',
      payload: {},
      createdAt: new Date('2026-07-09T08:00:00.000Z'),
      updatedAt: new Date('2026-07-10T09:00:00.000Z'),
      tender: publicTender,
      receipt: { receiptHash: 'hash-123' }
    };
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValueOnce([publicTender]).mockResolvedValueOnce([ownDraftTender])
      },
      bid: {
        findMany: vi.fn().mockResolvedValue([submittedBid])
      },
      savedTender: {
        findMany: vi.fn().mockResolvedValue([{ tenderId: publicTender.id }])
      }
    };
    const repository = new ModuleRepository(db as any);

    const payload = await repository.getMarketplaceData(
      { organizationId: supplierOrgId },
      { search: 'medical', type: 'Goods', budgetBand: 'hundred-million-plus', status: 'Open', sort: 'deadline', page: 1, limit: 20 }
    );

    expect(payload.tenders).toEqual([
      {
        id: 'tender-1',
        title: 'Supply of medical equipment',
        organization: 'Medical Stores Department',
        ownerOrganization: 'Medical Stores Department',
        type: 'Goods',
        category: 'Health / Goods',
        description: 'Diagnostic equipment package',
        location: 'Dar es Salaam',
        budget: 250000000,
        status: 'Open',
        reference: 'PX-2026-001',
        publishedAt: '2026-07-01T08:00:00.000Z',
        closingDate: '2026-08-30',
        createdByCurrentUser: false,
        isSaved: true
      }
    ]);
    expect(payload.tenders[0]).not.toHaveProperty('hasDraftBid');
    expect(payload.tenders[0]).not.toHaveProperty('hasSubmittedBid');
    expect(Object.keys(payload.tenders[0]).sort()).toEqual(
      [
        'budget',
        'category',
        'closingDate',
        'createdByCurrentUser',
        'description',
        'id',
        'isSaved',
        'location',
        'organization',
        'ownerOrganization',
        'publishedAt',
        'reference',
        'status',
        'title',
        'type'
      ].sort()
    );
    expect(payload.myTenders).toMatchObject([
      {
        id: 'tender-2',
        section: 'draft',
        title: 'Draft road maintenance tender',
        status: 'Draft',
        type: 'Works',
        nav: 'create-tender',
        actionLabel: 'Continue Draft'
      }
    ]);
    expect(payload.myTenders[0].tender.createdByCurrentUser).toBe(true);
    expect(payload.myTenders[0].tender.isSaved).toBe(false);
    expect(Object.keys(payload.myTenders[0]).sort()).toEqual(
      ['actionLabel', 'id', 'lastActivity', 'nav', 'section', 'status', 'tender', 'title', 'type'].sort()
    );
    expect(payload.myBids).toMatchObject([
      {
        id: 'bid-1',
        tenderId: 'tender-1',
        section: 'submitted',
        title: 'Supply of medical equipment',
        status: 'Submitted',
        amount: 'TZS 225,000,000',
        receiptHash: 'hash-123',
        nav: 'bidding-workspace',
        actionLabel: 'Open Bid'
      }
    ]);
    expect(Object.keys(payload.myBids[0]).sort()).toEqual(
      ['actionLabel', 'amount', 'id', 'lastActivity', 'nav', 'receiptHash', 'section', 'status', 'tender', 'tenderId', 'title'].sort()
    );
    expect(payload.myBids[0]).not.toHaveProperty('payload');
    expect(payload.myBids[0]).not.toHaveProperty('supplierOrgId');
    expect(payload.summary).toMatchObject({
      openTenders: 1,
      myTenders: 1,
      myBids: 1,
      totalBudgetValue: 250000000,
      closingSoon: 0
    });
    expect(payload.pagination).toEqual({
      page: 1,
      limit: 20,
      matching: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(payload.summary.categoryCounts).toEqual([{ label: 'Health / Goods', value: 1, amount: 250000000 }]);
    expect(db.tender.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 1000,
        include: expect.not.objectContaining({ bids: expect.anything() }),
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ visibility: Visibility.PUBLIC_MARKETPLACE }),
            expect.objectContaining({ type: { in: [TenderType.GOODS] } }),
            expect.objectContaining({ status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] } }),
            expect.objectContaining({ budget: { gte: 100000000, lt: 1000000000 } })
          ])
        })
      })
    );
  });

  it('sorts and paginates marketplace tenders while summarizing the full filtered result set', async () => {
    const baseTender = tenderDetailRecord({
      id: 'tender-1',
      reference: 'PX-2026-001',
      status: TenderStatus.OPEN,
      publishedAt: new Date('2026-07-01T08:00:00.000Z'),
      closingDate: new Date('2026-08-30T00:00:00.000Z'),
      categories: [{ name: 'Goods' }]
    });
    const secondTender = tenderDetailRecord({
      id: 'tender-2',
      reference: 'PX-2026-002',
      title: 'Road works package',
      type: TenderType.WORKS,
      status: TenderStatus.EVALUATION,
      budget: 1000000000,
      publishedAt: new Date('2026-07-05T08:00:00.000Z'),
      closingDate: new Date('2026-10-15T00:00:00.000Z'),
      categories: [{ name: 'Works' }]
    });
    const thirdTender = tenderDetailRecord({
      id: 'tender-3',
      reference: 'PX-2026-003',
      title: 'Consultancy support',
      type: TenderType.CONSULTANCY,
      status: TenderStatus.AWARDED,
      budget: 750000000,
      publishedAt: new Date('2026-07-03T08:00:00.000Z'),
      closingDate: new Date('2026-09-01T00:00:00.000Z'),
      categories: []
    });
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValue([secondTender, thirdTender, baseTender])
      }
    };
    const repository = new ModuleRepository(db as any);

    const payload = await repository.getMarketplaceData(
      {},
      { search: '', type: '', budgetBand: '', status: '', sort: 'deadline', page: 2, limit: 1 }
    );

    expect(payload.tenders).toHaveLength(1);
    expect(payload.tenders[0]).toMatchObject({
      id: 'tender-3',
      type: 'Consultancy',
      category: 'Consultancy',
      status: 'Awarded',
      createdByCurrentUser: false,
      isSaved: false
    });
    expect(payload.myTenders).toEqual([]);
    expect(payload.myBids).toEqual([]);
    expect(payload.summary).toMatchObject({
      openTenders: 1,
      myTenders: 0,
      myBids: 0,
      totalBudgetValue: 2000000000,
      closingSoon: 0
    });
    expect(payload.pagination).toEqual({
      page: 2,
      limit: 1,
      matching: 3,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true
    });
    expect(Object.keys(payload.summary).sort()).toEqual(
      ['categoryCounts', 'closingSoon', 'myBids', 'myTenders', 'openTenders', 'totalBudgetValue'].sort()
    );
    expect(payload.summary.categoryCounts).toEqual(
      expect.arrayContaining([
        { label: 'Goods', value: 1, amount: 250000000 },
        { label: 'Works', value: 1, amount: 1000000000 },
        { label: 'Consultancy', value: 1, amount: 750000000 }
      ])
    );
    expect(db.tender.findMany).toHaveBeenCalledTimes(1);
  });

  it('applies production marketplace sort modes to repository queries', async () => {
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.getMarketplaceData({}, { search: '', type: '', budgetBand: '', status: '', sort: 'deadline', page: 1, limit: 20 });
    await repository.getMarketplaceData({}, { search: '', type: '', budgetBand: '', status: '', sort: 'newest', page: 1, limit: 20 });
    await repository.getMarketplaceData({}, { search: '', type: '', budgetBand: '', status: '', sort: 'budget-desc', page: 1, limit: 20 });
    await repository.getMarketplaceData({}, { search: '', type: '', budgetBand: '', status: '', sort: 'budget-asc', page: 1, limit: 20 });

    expect(db.tender.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ orderBy: [{ closingDate: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }] }));
    expect(db.tender.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] }));
    expect(db.tender.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({ orderBy: [{ budget: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }] }));
    expect(db.tender.findMany).toHaveBeenNthCalledWith(4, expect.objectContaining({ orderBy: [{ budget: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }] }));
  });

  it('returns only public marketplace rows for unauthenticated requests', async () => {
    const publicTender = tenderDetailRecord({
      id: 'tender-1',
      buyerOrgId: 'org-owned-by-someone',
      status: TenderStatus.OPEN,
      publishedAt: new Date('2026-07-01T08:00:00.000Z')
    });
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValue([publicTender])
      }
    };
    const repository = new ModuleRepository(db as any);

    const payload = await repository.getMarketplaceData(
      {},
      { search: '', type: '', budgetBand: '', status: 'PUBLISHED', sort: 'newest', page: 1, limit: 20 }
    );

    expect(payload.tenders).toMatchObject([{ id: 'tender-1', status: 'Open', createdByCurrentUser: false, isSaved: false }]);
    expect(payload.myTenders).toEqual([]);
    expect(payload.myBids).toEqual([]);
    expect(payload.pagination).toEqual({
      page: 1,
      limit: 20,
      matching: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });
    expect(db.tender.findMany).toHaveBeenCalledTimes(1);
    expect(db.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] } })])
        })
      })
    );
  });

  it('normalizes frontend and enum-like marketplace filters before querying', async () => {
    const db = {
      tender: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.getMarketplaceData(
      {},
      {
        search: 'maintenance',
        type: 'SERVICES',
        budgetBand: 'billion-plus',
        status: 'UNDER_EVALUATION',
        sort: 'budget-desc',
        page: 1,
        limit: 20
      }
    );

    expect(db.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ budget: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ type: { in: [TenderType.SERVICE] } }),
            expect.objectContaining({ status: { in: [TenderStatus.EVALUATION] } }),
            expect.objectContaining({ budget: { gte: 1000000000 } }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { title: { contains: 'maintenance', mode: 'insensitive' } },
                { description: { contains: 'maintenance', mode: 'insensitive' } },
                { reference: { contains: 'maintenance', mode: 'insensitive' } },
                { location: { contains: 'maintenance', mode: 'insensitive' } },
                { buyerOrg: { name: { contains: 'maintenance', mode: 'insensitive' } } },
                { categories: { some: { name: { contains: 'maintenance', mode: 'insensitive' } } } }
              ])
            })
          ])
        })
      })
    );
  });
});

describe('procurement tender write repository', () => {
  it('creates draft tenders with owner context, generated reference, and categories', async () => {
    const createdTender = tenderDetailRecord({
      id: 'tender-1',
      reference: 'PX-GDS-2026-ABC-1234',
      buyerOrgId: 'org-1',
      ownerUserId: 'user-1',
      status: TenderStatus.DRAFT,
      publishedAt: null,
      categories: [{ name: 'Health' }, { name: 'Equipment' }]
    });
    const tx = {
      tender: {
        create: vi.fn().mockResolvedValue(createdTender)
      },
      tenderCategory: {
        createMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    };
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.createTender(
      {
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        description: 'Supply and delivery of diagnostic laboratory equipment.',
        budget: 250000000,
        currency: 'TZS',
        location: 'Dar es Salaam',
        closingDate: '2026-08-30',
        categories: ['Health', 'Equipment', 'health'],
        requirements: { technical: true },
        metadata: { source: 'test' }
      },
      { organizationId: 'org-1', userId: 'user-1' }
    );

    expect(tx.tender.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference: expect.stringMatching(/^PX-GDS-\d{4}-/),
        buyerOrgId: 'org-1',
        ownerUserId: 'user-1',
        title: 'Supply of laboratory equipment',
        type: TenderType.GOODS,
        status: TenderStatus.DRAFT,
        visibility: Visibility.PRIVATE,
        budget: 250000000,
        currency: 'TZS',
        location: 'Dar es Salaam',
        closingDate: new Date('2026-08-30T00:00:00.000Z'),
        requirements: { technical: true },
        metadata: { source: 'test' }
      })
    });
    expect(tx.tenderCategory.createMany).toHaveBeenCalledWith({
      data: [
        { tenderId: 'tender-1', name: 'Health' },
        { tenderId: 'tender-1', name: 'Equipment' }
      ],
      skipDuplicates: true
    });
    expect(result).toEqual({
      success: true,
      message: 'Tender draft created successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-ABC-1234',
        title: 'Supply of laboratory equipment',
        status: 'Draft',
        type: 'Goods',
        createdAt: '2026-06-20T08:00:00.000Z'
      }
    });
    expect(result.data).not.toHaveProperty('buyerOrgId');
    expect(result.data).not.toHaveProperty('ownerUserId');
    expect(result.data).not.toHaveProperty('visibility');
  });

  it('creates minimal drafts with provided references and optional budget dates', async () => {
    const createdTender = tenderDetailRecord({
      id: 'tender-2',
      reference: 'PX-CUSTOM-001',
      title: 'Draft consultancy support',
      type: TenderType.CONSULTANCY,
      budget: null,
      closingDate: null
    });
    const tx = {
      tender: {
        create: vi.fn().mockResolvedValue(createdTender)
      },
      tenderCategory: {
        createMany: vi.fn()
      }
    };
    const repository = new ModuleRepository({
      $transaction: vi.fn((callback) => callback(tx))
    } as any);

    const result = await repository.createTender(
      {
        title: 'Draft consultancy support',
        type: TenderType.CONSULTANCY,
        description: 'Advisory support for procurement planning.',
        currency: 'TZS',
        location: 'Dodoma',
        categories: [],
        requirements: {},
        metadata: {},
        reference: 'PX-CUSTOM-001'
      },
      { organizationId: 'org-1', userId: 'user-1' }
    );

    expect(tx.tender.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference: 'PX-CUSTOM-001',
        budget: null,
        closingDate: null,
        visibility: Visibility.PRIVATE,
        status: TenderStatus.DRAFT
      })
    });
    expect(tx.tenderCategory.createMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'tender-2',
        reference: 'PX-CUSTOM-001',
        status: 'Draft',
        type: 'Consultancy'
      }
    });
  });

  it('rejects duplicate provided tender references with a conflict', async () => {
    const repository = new ModuleRepository({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' })
    } as any);

    await expect(
      repository.createTender(
        {
          title: 'Supply of laboratory equipment',
          type: TenderType.GOODS,
          description: 'Supply and delivery of diagnostic laboratory equipment.',
          budget: 250000000,
          currency: 'TZS',
          location: 'Dar es Salaam',
          closingDate: '2026-08-30',
          categories: [],
          requirements: {},
          metadata: {},
          reference: 'PX-GDS-2026-001'
        },
        { organizationId: 'org-1', userId: 'user-1' }
      )
    ).rejects.toMatchObject({
      status: 409,
      message: 'Tender reference already exists.'
    });
  });

  it('updates owner draft tenders and replaces categories when provided', async () => {
    const updatedTender = tenderDetailRecord({
      id: 'tender-1',
      title: 'Supply of updated medical equipment',
      reference: 'PX-GDS-2026-ABC-1234',
      status: TenderStatus.DRAFT,
      updatedAt: new Date('2026-06-26T08:30:00.000Z')
    });
    const tx = {
      tender: {
        findUnique: vi.fn().mockResolvedValue({ id: 'tender-1', buyerOrgId: 'org-1', status: TenderStatus.DRAFT }),
        update: vi.fn().mockResolvedValue(updatedTender)
      },
      tenderCategory: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 })
      }
    };
    const repository = new ModuleRepository({
      $transaction: vi.fn((callback) => callback(tx))
    } as any);

    const result = await repository.updateTender(
      'tender-1',
      {
        title: 'Supply of updated medical equipment',
        type: TenderType.GOODS,
        budget: 275000000,
        closingDate: '2099-09-30',
        categories: ['Health', 'Equipment', 'health'],
        metadata: { source: 'buyer-workspace' }
      },
      { organizationId: 'org-1', userId: 'user-1' }
    );

    expect(tx.tender.findUnique).toHaveBeenCalledWith({
      where: { id: 'tender-1' },
      select: { id: true, buyerOrgId: true, status: true }
    });
    expect(tx.tenderCategory.deleteMany).toHaveBeenCalledWith({ where: { tenderId: 'tender-1' } });
    expect(tx.tenderCategory.createMany).toHaveBeenCalledWith({
      data: [
        { tenderId: 'tender-1', name: 'Health' },
        { tenderId: 'tender-1', name: 'Equipment' }
      ],
      skipDuplicates: true
    });
    expect(tx.tender.update).toHaveBeenCalledWith({
      where: { id: 'tender-1' },
      data: expect.objectContaining({
        title: 'Supply of updated medical equipment',
        type: TenderType.GOODS,
        budget: 275000000,
        closingDate: new Date('2099-09-30T00:00:00.000Z'),
        metadata: { source: 'buyer-workspace' }
      }),
      select: { id: true, reference: true, title: true, status: true, updatedAt: true }
    });
    expect(result).toEqual({
      success: true,
      message: 'Tender updated successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-ABC-1234',
        title: 'Supply of updated medical equipment',
        status: 'Draft',
        updatedAt: '2026-06-26T08:30:00.000Z'
      }
    });
    expect(result?.data).not.toHaveProperty('buyerOrgId');
    expect(result?.data).not.toHaveProperty('ownerUserId');
  });

  it('updates owner review tenders without touching categories when omitted', async () => {
    const updatedTender = tenderDetailRecord({
      id: 'tender-review',
      status: TenderStatus.REVIEW,
      updatedAt: new Date('2026-06-26T08:45:00.000Z')
    });
    const tx = {
      tender: {
        findUnique: vi.fn().mockResolvedValue({ id: 'tender-review', buyerOrgId: 'org-1', status: TenderStatus.REVIEW }),
        update: vi.fn().mockResolvedValue(updatedTender)
      },
      tenderCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn()
      }
    };
    const repository = new ModuleRepository({
      $transaction: vi.fn((callback) => callback(tx))
    } as any);

    const result = await repository.updateTender('tender-review', { location: 'Dodoma' }, { organizationId: 'org-1', userId: 'user-1' });

    expect(tx.tenderCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.tenderCategory.createMany).not.toHaveBeenCalled();
    expect(tx.tender.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { location: 'Dodoma' }
      })
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'tender-review',
        status: 'Draft',
        updatedAt: '2026-06-26T08:45:00.000Z'
      }
    });
  });

  it('returns null for missing update targets', async () => {
    const tx = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn()
      },
      tenderCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn()
      }
    };
    const repository = new ModuleRepository({
      $transaction: vi.fn((callback) => callback(tx))
    } as any);

    await expect(repository.updateTender('missing-tender', { title: 'Updated title' }, { organizationId: 'org-1', userId: 'user-1' })).resolves.toBeNull();
    expect(tx.tender.update).not.toHaveBeenCalled();
  });

  it('rejects update attempts from non-owner organizations', async () => {
    const tx = {
      tender: {
        findUnique: vi.fn().mockResolvedValue({ id: 'tender-1', buyerOrgId: 'org-2', status: TenderStatus.DRAFT }),
        update: vi.fn()
      },
      tenderCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn()
      }
    };
    const repository = new ModuleRepository({
      $transaction: vi.fn((callback) => callback(tx))
    } as any);

    await expect(repository.updateTender('tender-1', { title: 'Updated title' }, { organizationId: 'org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 403,
      message: 'Only the owner organization can update this tender.'
    });
    expect(tx.tender.update).not.toHaveBeenCalled();
  });

  it('rejects updates for published or open tenders', async () => {
    for (const status of [TenderStatus.OPEN, TenderStatus.PUBLISHED, TenderStatus.CLOSED, TenderStatus.EVALUATION, TenderStatus.AWARDED, TenderStatus.CANCELLED]) {
      const tx = {
        tender: {
          findUnique: vi.fn().mockResolvedValue({ id: 'tender-1', buyerOrgId: 'org-1', status }),
          update: vi.fn()
        },
        tenderCategory: {
          deleteMany: vi.fn(),
          createMany: vi.fn()
        }
      };
      const repository = new ModuleRepository({
        $transaction: vi.fn((callback) => callback(tx))
      } as any);

      await expect(repository.updateTender('tender-1', { title: 'Updated title' }, { organizationId: 'org-1', userId: 'user-1' })).rejects.toMatchObject({
        status: 409,
        message: 'Only draft or review tenders can be updated.'
      });
      expect(tx.tender.update).not.toHaveBeenCalled();
    }
  });

  it('publishes owner-scoped tenders as open marketplace records', async () => {
    const publishedTender = tenderDetailRecord({
      id: 'tender-1',
      buyerOrgId: 'org-1',
      status: TenderStatus.OPEN,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      publishedAt: new Date('2026-07-01T08:00:00.000Z')
    });
    const db = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(publishedTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.publishTender('tender-1', 'org-1');

    expect(db.tender.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tender-1',
        buyerOrgId: 'org-1',
        status: { in: [TenderStatus.DRAFT, TenderStatus.REVIEW] }
      },
      data: expect.objectContaining({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        publishedAt: expect.any(Date)
      })
    });
    expect(db.tender.findUnique).toHaveBeenCalledWith({
      where: { id: 'tender-1' },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        visibility: true,
        publishedAt: true,
        closingDate: true
      }
    });
    expect(result).toEqual({
      success: true,
      message: 'Tender published successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-001',
        title: 'Supply of laboratory equipment',
        status: 'Open',
        visibility: Visibility.PUBLIC_MARKETPLACE,
        publishedAt: '2026-07-01T08:00:00.000Z',
        closingDate: '2026-08-30'
      }
    });
    expect(result?.data).not.toHaveProperty('createdByCurrentUser');
    expect(result?.data).not.toHaveProperty('bidSummary');
    expect(result?.data).not.toHaveProperty('currentBid');
  });

  it('returns null when guarded publish update does not affect a draft or review tender', async () => {
    const db = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn()
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.publishTender('tender-1', 'org-1')).resolves.toBeNull();
    expect(db.tender.findUnique).not.toHaveBeenCalled();
  });

  it('closes owner open tenders without touching bids', async () => {
    const closedTender = tenderDetailRecord({
      id: 'tender-1',
      reference: 'PX-GDS-2026-ABC-1234',
      title: 'Supply of medical equipment',
      status: TenderStatus.CLOSED,
      closingDate: new Date('2099-09-30T00:00:00.000Z'),
      updatedAt: new Date('2026-06-26T09:00:00.000Z')
    });
    const db = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue(closedTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.closeTender('tender-1', 'org-1');

    expect(db.tender.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'tender-1',
        buyerOrgId: 'org-1',
        status: { in: [TenderStatus.OPEN, TenderStatus.PUBLISHED] }
      },
      data: {
        status: TenderStatus.CLOSED
      }
    });
    expect(db.tender.findUnique).toHaveBeenCalledWith({
      where: { id: 'tender-1' },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        closingDate: true,
        updatedAt: true
      }
    });
    expect(result).toEqual({
      success: true,
      message: 'Tender closed successfully',
      data: {
        id: 'tender-1',
        reference: 'PX-GDS-2026-ABC-1234',
        title: 'Supply of medical equipment',
        status: 'Closed',
        closingDate: '2099-09-30',
        updatedAt: '2026-06-26T09:00:00.000Z'
      }
    });
    expect(result?.data).not.toHaveProperty('bidSummary');
    expect(result?.data).not.toHaveProperty('currentBid');
  });

  it('returns null when guarded close update does not affect an open tender', async () => {
    const db = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn()
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.closeTender('tender-1', 'org-1')).resolves.toBeNull();
    expect(db.tender.findUnique).not.toHaveBeenCalled();
  });

  it('saves eligible public open tenders for the authenticated organization', async () => {
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tender-1',
          buyerOrgId: 'buyer-org-1',
          status: TenderStatus.OPEN,
          visibility: Visibility.PUBLIC_MARKETPLACE
        })
      },
      savedTender: {
        create: vi.fn().mockResolvedValue({ id: 'saved-1' })
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.saveTender('tender-1', { organizationId: 'supplier-org-1', userId: 'user-1' })).resolves.toEqual({
      success: true,
      message: 'Tender saved successfully'
    });
    expect(db.savedTender.create).toHaveBeenCalledWith({
      data: {
        tenderId: 'tender-1',
        organizationId: 'supplier-org-1',
        userId: 'user-1'
      }
    });
  });

  it('treats duplicate saved tenders as idempotent success', async () => {
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tender-1',
          buyerOrgId: 'buyer-org-1',
          status: TenderStatus.PUBLISHED,
          visibility: Visibility.PUBLIC_MARKETPLACE
        })
      },
      savedTender: {
        create: vi.fn().mockRejectedValue({ code: 'P2002' })
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.saveTender('tender-1', { organizationId: 'supplier-org-1', userId: 'user-1' })).resolves.toEqual({
      success: true,
      message: 'Tender saved successfully'
    });
  });

  it('rejects ineligible saved tender requests', async () => {
    const repositoryForTender = (tender: unknown) =>
      new ModuleRepository({
        tender: { findUnique: vi.fn().mockResolvedValue(tender) },
        savedTender: { create: vi.fn() }
      } as any);

    await expect(repositoryForTender(null).saveTender('missing-tender', { organizationId: 'supplier-org-1', userId: 'user-1' })).rejects.toMatchObject({
      status: 404
    });
    await expect(
      repositoryForTender({
        id: 'tender-1',
        buyerOrgId: 'supplier-org-1',
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE
      }).saveTender('tender-1', { organizationId: 'supplier-org-1', userId: 'user-1' })
    ).rejects.toMatchObject({
      status: 409,
      message: 'You cannot save your own tender.'
    });

    for (const tender of [
      { status: TenderStatus.DRAFT, visibility: Visibility.PUBLIC_MARKETPLACE },
      { status: TenderStatus.CLOSED, visibility: Visibility.PUBLIC_MARKETPLACE },
      { status: TenderStatus.AWARDED, visibility: Visibility.PUBLIC_MARKETPLACE },
      { status: TenderStatus.CANCELLED, visibility: Visibility.PUBLIC_MARKETPLACE },
      { status: TenderStatus.EVALUATION, visibility: Visibility.PUBLIC_MARKETPLACE },
      { status: TenderStatus.OPEN, visibility: Visibility.PRIVATE }
    ]) {
      await expect(
        repositoryForTender({
          id: 'tender-1',
          buyerOrgId: 'buyer-org-1',
          ...tender
        }).saveTender('tender-1', { organizationId: 'supplier-org-1', userId: 'user-1' })
      ).rejects.toMatchObject({
        status: 409,
        message: 'Only public open tenders can be saved.'
      });
    }
  });

  it('removes saved tenders idempotently', async () => {
    const db = {
      savedTender: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.unsaveTender('tender-1', 'supplier-org-1')).resolves.toEqual({
      success: true,
      message: 'Tender removed from saved tenders'
    });
    expect(db.savedTender.deleteMany).toHaveBeenCalledWith({
      where: {
        tenderId: 'tender-1',
        organizationId: 'supplier-org-1'
      }
    });
  });

  it('lists saved tenders as marketplace-compatible safe rows', async () => {
    const savedTender = {
      id: 'saved-1',
      tenderId: 'tender-1',
      organizationId: 'supplier-org-1',
      userId: 'user-1',
      createdAt: new Date('2026-07-15T08:00:00.000Z'),
      tender: tenderDetailRecord({
        id: 'tender-1',
        buyerOrgId: 'buyer-org-1',
        status: TenderStatus.OPEN,
        publishedAt: new Date('2026-07-01T08:00:00.000Z'),
        categories: [{ name: 'Health' }]
      })
    };
    const db = {
      savedTender: {
        findMany: vi.fn().mockResolvedValue([savedTender])
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.getSavedTenders('supplier-org-1');

    expect(db.savedTender.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'supplier-org-1',
        tender: {
          visibility: Visibility.PUBLIC_MARKETPLACE
        }
      },
      include: {
        tender: {
          include: expect.objectContaining({
            buyerOrg: { select: { id: true, name: true } },
            categories: { select: { name: true }, orderBy: { name: 'asc' } }
          })
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });
    expect(result.tenders).toMatchObject([
      {
        id: 'tender-1',
        status: 'Open',
        isSaved: true,
        createdByCurrentUser: false
      }
    ]);
    expect(Object.keys(result.tenders[0]).sort()).toEqual(
      [
        'budget',
        'category',
        'closingDate',
        'createdByCurrentUser',
        'description',
        'id',
        'isSaved',
        'location',
        'organization',
        'ownerOrganization',
        'publishedAt',
        'reference',
        'status',
        'title',
        'type'
      ].sort()
    );
  });
});

describe('procurement tender detail repository', () => {
  it('returns public open tender details with only frontend-safe fields', async () => {
    const publicTender = tenderDetailRecord({
      id: 'tender-public',
      status: TenderStatus.OPEN,
      publishedAt: new Date('2026-07-01T08:00:00.000Z'),
      requirements: { technical: ['ISO 13485 certification'] },
      categories: [{ name: 'Health' }, { name: 'Goods' }],
      documents: [
        {
          label: 'Tender document',
          document: { id: 'doc-1', name: 'Medical equipment tender.pdf', documentType: 'PDF' }
        }
      ]
    });
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(publicTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.getTenderDetail('tender-public', {});

    expect(db.tender.findUnique).toHaveBeenCalledWith({
      where: { id: 'tender-public' },
      include: expect.objectContaining({
        buyerOrg: { select: { id: true, name: true } },
        categories: { select: { name: true }, orderBy: { name: 'asc' } },
        bids: expect.objectContaining({
          where: { supplierOrgId: '00000000-0000-0000-0000-000000000000' },
          select: { supplierOrgId: true, status: true }
        }),
        documents: expect.any(Object)
      })
    });
    expect(Object.keys(result ?? {}).sort()).toEqual(
      [
        'budget',
        'canBid',
        'category',
        'closingDate',
        'createdByCurrentUser',
        'currency',
        'description',
        'documents',
        'hasDraftBid',
        'hasSubmittedBid',
        'id',
        'location',
        'organization',
        'ownerOrganization',
        'publishedAt',
        'reference',
        'requirements',
        'status',
        'title',
        'type',
        'visibility'
      ].sort()
    );
    expect(result).toMatchObject({
      id: 'tender-public',
      title: 'Supply of laboratory equipment',
      reference: 'PX-GDS-2026-001',
      organization: 'Medical Stores Department',
      ownerOrganization: 'Medical Stores Department',
      type: 'Goods',
      category: 'Health / Goods',
      budget: 250000000,
      currency: 'TZS',
      status: 'Open',
      visibility: Visibility.PUBLIC_MARKETPLACE,
      publishedAt: '2026-07-01T08:00:00.000Z',
      closingDate: '2026-08-30',
      requirements: { technical: ['ISO 13485 certification'] },
      documents: [{ id: 'doc-1', name: 'Medical equipment tender.pdf', documentType: 'PDF', label: 'Tender document' }],
      createdByCurrentUser: false,
      canBid: false,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
    expect(result).not.toHaveProperty('isSaved');
    expect(result).not.toHaveProperty('buyerOrgId');
    expect(result).not.toHaveProperty('ownerUserId');
    expect(result).not.toHaveProperty('method');
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('requirementRows');
    expect(result).not.toHaveProperty('milestones');
    expect(result).not.toHaveProperty('commercialItems');
    expect(result).not.toHaveProperty('bidSummary');
    expect(result).not.toHaveProperty('currentBid');
  });

  it('hides draft and private tenders from public and non-owner users', async () => {
    const draftTender = tenderDetailRecord({
      id: 'tender-draft',
      status: TenderStatus.DRAFT,
      visibility: Visibility.PUBLIC_MARKETPLACE
    });
    const privateTender = tenderDetailRecord({
      id: 'tender-private',
      status: TenderStatus.OPEN,
      visibility: Visibility.PRIVATE
    });
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValueOnce(draftTender).mockResolvedValueOnce(draftTender).mockResolvedValueOnce(privateTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.getTenderDetail('tender-draft', {})).resolves.toBeNull();
    await expect(repository.getTenderDetail('tender-draft', { organizationId: 'supplier-org-1' })).resolves.toBeNull();
    await expect(repository.getTenderDetail('tender-private', { organizationId: 'supplier-org-1' })).resolves.toBeNull();
  });

  it('allows owner organizations to view their own draft details', async () => {
    const draftTender = tenderDetailRecord({
      id: 'tender-owned-draft',
      buyerOrgId: 'owner-org-1',
      status: TenderStatus.DRAFT,
      publishedAt: null,
      buyerOrg: { id: 'owner-org-1', name: 'Owner Authority' }
    });
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(draftTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    const result = await repository.getTenderDetail('tender-owned-draft', { organizationId: 'owner-org-1' });

    expect(result).toMatchObject({
      id: 'tender-owned-draft',
      organization: 'Owner Authority',
      status: 'Draft',
      publishedAt: '',
      createdByCurrentUser: true,
      canBid: false,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
  });

  it('computes supplier bid flags and canBid from current organization bids only', async () => {
    const supplierOrgId = 'supplier-org-1';
    const openTender = tenderDetailRecord({
      id: 'tender-open',
      buyerOrgId: 'buyer-org-1',
      status: TenderStatus.OPEN,
      publishedAt: new Date('2026-07-01T08:00:00.000Z'),
      closingDate: new Date('2099-08-30T00:00:00.000Z'),
      bids: []
    });
    const draftBidTender = tenderDetailRecord({
      ...openTender,
      bids: [{ supplierOrgId, status: BidStatus.DRAFT }]
    });
    const submittedBidTender = tenderDetailRecord({
      ...openTender,
      bids: [{ supplierOrgId, status: BidStatus.SUBMITTED }]
    });
    const expiredTender = tenderDetailRecord({
      ...openTender,
      closingDate: new Date('2020-08-30T00:00:00.000Z'),
      bids: []
    });
    const buyerTender = tenderDetailRecord({
      ...openTender,
      buyerOrgId: supplierOrgId,
      bids: []
    });
    const closedTender = tenderDetailRecord({
      ...openTender,
      buyerOrgId: supplierOrgId,
      status: TenderStatus.CLOSED,
      bids: []
    });
    const privateTender = tenderDetailRecord({
      ...openTender,
      visibility: Visibility.PRIVATE,
      bids: []
    });
    const db = {
      tender: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(openTender)
          .mockResolvedValueOnce(draftBidTender)
          .mockResolvedValueOnce(submittedBidTender)
          .mockResolvedValueOnce(expiredTender)
          .mockResolvedValueOnce(buyerTender)
          .mockResolvedValueOnce(closedTender)
          .mockResolvedValueOnce(privateTender)
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: true,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: true,
      hasDraftBid: true,
      hasSubmittedBid: false
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: false,
      hasDraftBid: false,
      hasSubmittedBid: true
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: false,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: false,
      createdByCurrentUser: true,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toMatchObject({
      canBid: false,
      hasDraftBid: false,
      hasSubmittedBid: false
    });
    await expect(repository.getTenderDetail('tender-open', { organizationId: supplierOrgId })).resolves.toBeNull();
    expect(db.tender.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          bids: expect.objectContaining({
            where: { supplierOrgId }
          })
        })
      })
    );
  });
});

function tenderDetailRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tender-1',
    reference: 'PX-GDS-2026-001',
    buyerOrgId: 'org-1',
    ownerUserId: 'user-1',
    title: 'Supply of laboratory equipment',
    description: 'Supply and delivery of diagnostic laboratory equipment.',
    type: TenderType.GOODS,
    status: TenderStatus.DRAFT,
    method: 'OPEN_TENDER',
    visibility: Visibility.PUBLIC_MARKETPLACE,
    budget: 250000000,
    currency: 'TZS',
    location: 'Dar es Salaam',
    contractType: null,
    closingDate: new Date('2026-08-30T00:00:00.000Z'),
    publishedAt: null,
    requirements: {},
    metadata: {},
    createdAt: new Date('2026-06-20T08:00:00.000Z'),
    updatedAt: new Date('2026-06-20T08:00:00.000Z'),
    buyerOrg: { id: 'org-1', name: 'Medical Stores Department' },
    categories: [],
    bids: [],
    documents: [],
    requirementRows: [],
    milestones: [],
    commercialItems: [],
    ...overrides
  };
}
