import { BidStatus, TenderStatus, Visibility } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleRepository, tenderAcceptsBids } from './repository.js';
import { ModuleService } from './service.js';

describe('bidding tender guards', () => {
  it('accepts public open tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('accepts published invited tenders before close', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.PUBLISHED,
        visibility: Visibility.INVITED,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(true);
  });

  it('rejects closed, private, or expired tenders', () => {
    expect(
      tenderAcceptsBids({
        status: TenderStatus.CLOSED,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PRIVATE,
        closingDate: new Date(Date.now() + 86400000)
      })
    ).toBe(false);
    expect(
      tenderAcceptsBids({
        status: TenderStatus.OPEN,
        visibility: Visibility.PUBLIC_MARKETPLACE,
        closingDate: new Date(Date.now() - 86400000)
      })
    ).toBe(false);
  });

  it('keeps withdrawn bids separate from active draft and submission states', () => {
    const activeStatuses = [BidStatus.DRAFT, BidStatus.SUBMITTED];
    expect(activeStatuses).not.toContain(BidStatus.WITHDRAWN);
  });
});

describe('bidding service rules', () => {
  it('rejects buyer organizations bidding on their own tenders', async () => {
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ buyerOrgId: 'org-1' })),
      saveDraft: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 403,
      message: 'Buyers cannot bid on their own tenders.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it('allows supplier organizations to bid tenders owned by a different buyer organization', async () => {
    const tender = tenderRecord({ buyerOrgId: 'buyer-org-1', bids: [] });
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(tender),
      saveDraft: vi.fn().mockResolvedValue({ id: 'bid-1' })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).resolves.toEqual({ id: 'bid-1' });
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tender,
        supplierOrgId: 'supplier-org-1',
        userId: 'user-1'
      })
    );
  });

  it('rejects non-open or expired tenders before draft creation', async () => {
    for (const tender of [
      tenderRecord({ status: TenderStatus.CLOSED }),
      tenderRecord({ visibility: Visibility.PRIVATE }),
      tenderRecord({ closingDate: new Date(Date.now() - 86400000) })
    ]) {
      const repository = {
        findTenderForBid: vi.fn().mockResolvedValue(tender),
        saveDraft: vi.fn()
      };
      const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

      await expect(service.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
        status: 409,
        message: 'This tender is not open for bid submission.'
      });
      expect(repository.saveDraft).not.toHaveBeenCalled();
    }
  });

  it('continues existing draft bids and rejects submitted bid edits', async () => {
    const draftTender = tenderRecord({ bids: [bidRecord({ status: BidStatus.DRAFT })] });
    const repository = {
      findTenderForBid: vi.fn().mockResolvedValue(draftTender),
      saveDraft: vi.fn().mockResolvedValue({ id: 'bid-1' })
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.saveDraft('token-1', 'tender-1', draftInput())).resolves.toEqual({ id: 'bid-1' });
    expect(repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        tender: draftTender,
        supplierOrgId: 'supplier-org-1',
        userId: 'user-1'
      })
    );

    const submittedRepository = {
      findTenderForBid: vi.fn().mockResolvedValue(tenderRecord({ bids: [bidRecord({ status: BidStatus.SUBMITTED })] })),
      saveDraft: vi.fn()
    };
    const submittedService = new ModuleService(submittedRepository as any, identityFor('supplier-org-1') as any);

    await expect(submittedService.saveDraft('token-1', 'tender-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'This bid has already been submitted.'
    });
    expect(submittedRepository.saveDraft).not.toHaveBeenCalled();
  });

  it('does not allow submitted bids to be patched or receive new documents', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord({ status: BidStatus.SUBMITTED })),
      findTenderForBid: vi.fn(),
      saveDraft: vi.fn(),
      addDocuments: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.patchBid('token-1', 'bid-1', draftInput())).rejects.toMatchObject({
      status: 409,
      message: 'Submitted bids cannot be edited.'
    });
    await expect(service.addDocuments('token-1', 'bid-1', [{ name: 'doc.pdf', documentType: 'PDF' }])).rejects.toMatchObject({
      status: 409,
      message: 'Submitted bids cannot be edited.'
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
    expect(repository.addDocuments).not.toHaveBeenCalled();
  });

  it('rejects submission when another submitted bid exists for the supplier and tender', async () => {
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      hasSubmittedBidForTenderSupplier: vi.fn().mockResolvedValue(true),
      submit: vi.fn()
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.submit('token-1', 'bid-1')).rejects.toMatchObject({
      status: 409,
      message: 'A submitted bid already exists for this tender.'
    });
    expect(repository.hasSubmittedBidForTenderSupplier).toHaveBeenCalledWith({
      tenderId: 'tender-1',
      supplierOrgId: 'supplier-org-1',
      excludingBidId: 'bid-1'
    });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it('returns the generated receipt when submitting a valid bid', async () => {
    const submittedBid = {
      ...bidRecord({ status: BidStatus.SUBMITTED, submittedAt: new Date('2026-07-01T08:00:00.000Z') }),
      receipt: {
        receiptRef: 'BID-PX-BID-2026-000001-01',
        receiptHash: 'hash-123',
        createdAt: '2026-07-01T08:00:01.000Z'
      }
    };
    const repository = {
      findBidForAccess: vi.fn().mockResolvedValue(bidRecord()),
      hasSubmittedBidForTenderSupplier: vi.fn().mockResolvedValue(false),
      submit: vi.fn().mockResolvedValue(submittedBid)
    };
    const service = new ModuleService(repository as any, identityFor('supplier-org-1') as any);

    await expect(service.submit('token-1', 'bid-1')).resolves.toMatchObject({
      receiptRef: 'BID-PX-BID-2026-000001-01',
      receiptHash: 'hash-123',
      bid: submittedBid
    });
  });
});

describe('bidding repository rules', () => {
  it('scopes tender bid lookup to the current supplier organization', async () => {
    const db = {
      tender: {
        findUnique: vi.fn().mockResolvedValue(tenderRecord())
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.findTenderForBid('tender-1', 'supplier-org-1');

    expect(db.tender.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tender-1' },
        include: expect.objectContaining({
          bids: expect.objectContaining({
            where: { supplierOrgId: 'supplier-org-1' }
          })
        })
      })
    );
  });

  it('checks for another submitted bid by tender and supplier', async () => {
    const db = {
      bid: {
        findFirst: vi.fn().mockResolvedValue({ id: 'bid-2' })
      }
    };
    const repository = new ModuleRepository(db as any);

    await expect(
      repository.hasSubmittedBidForTenderSupplier({
        tenderId: 'tender-1',
        supplierOrgId: 'supplier-org-1',
        excludingBidId: 'bid-1'
      })
    ).resolves.toBe(true);
    expect(db.bid.findFirst).toHaveBeenCalledWith({
      where: {
        tenderId: 'tender-1',
        supplierOrgId: 'supplier-org-1',
        status: BidStatus.SUBMITTED,
        id: { not: 'bid-1' }
      },
      select: { id: true }
    });
  });

  it('maps active bid unique conflicts to a clean draft conflict', async () => {
    const repository = new ModuleRepository({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' })
    } as any);

    await expect(
      repository.saveDraft({
        tender: tenderRecord() as any,
        supplierOrgId: 'supplier-org-1',
        supplierName: 'Supplier',
        userId: 'user-1',
        draft: draftInput()
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'A bid already exists for this tender.'
    });
  });

  it('updates an existing draft instead of creating a second active bid', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    const tender = tenderRecord({ bids: [bidRecord({ id: 'bid-existing', status: BidStatus.DRAFT })] });
    tx.bid.update.mockResolvedValue({ id: 'bid-existing' });
    tx.bid.findUniqueOrThrow.mockResolvedValue(bidRecord({ id: 'bid-existing' }));
    const repository = new ModuleRepository(db as any);

    await expect(
      repository.saveDraft({
        tender: tender as any,
        supplierOrgId: 'supplier-org-1',
        supplierName: 'Supplier',
        userId: 'user-1',
        draft: draftInput()
      })
    ).resolves.toMatchObject({ id: 'bid-existing', status: BidStatus.DRAFT });

    expect(tx.bid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bid-existing' }
      })
    );
    expect(tx.bid.create).not.toHaveBeenCalled();
  });

  it('submits bids by creating a sealed version and receipt hash', async () => {
    const tx = transactionMock();
    const db = {
      $transaction: vi.fn((callback) => callback(tx))
    };
    const draftBid = bidRecord();
    const submittedBid = bidRecord({
      status: BidStatus.SUBMITTED,
      submittedAt: new Date('2026-07-01T08:00:00.000Z'),
      receipt: {
        receiptRef: 'BID-PX-BID-2026-000001-01',
        receiptHash: 'hash-123',
        createdAt: new Date('2026-07-01T08:00:01.000Z')
      }
    });
    tx.bid.findUniqueOrThrow.mockResolvedValueOnce(draftBid).mockResolvedValueOnce(submittedBid);
    tx.bidVersion.count.mockResolvedValue(0);
    const repository = new ModuleRepository(db as any);

    const result = await repository.submit({ bid: draftBid as any, userId: 'user-1' });

    expect(tx.bidVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bidId: 'bid-1',
          envelope: 'COMBINED',
          sealedHash: expect.any(String)
        })
      })
    );
    expect(tx.bidReceipt.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bidId: 'bid-1' },
        create: expect.objectContaining({
          bidId: 'bid-1',
          receiptHash: expect.any(String)
        })
      })
    );
    expect(result.receipt?.receiptHash).toBe('hash-123');
  });

  it('maps submit unique conflicts to a clean duplicate submission conflict', async () => {
    const repository = new ModuleRepository({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' })
    } as any);

    await expect(repository.submit({ bid: bidRecord() as any, userId: 'user-1' })).rejects.toMatchObject({
      status: 409,
      message: 'A submitted bid already exists for this tender.'
    });
  });
});

function identityFor(organizationId?: string) {
  return {
    requirePermission: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId,
        organization: 'Supplier'
      }
    }),
    requireSession: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        organizationId,
        organization: 'Supplier'
      }
    })
  };
}

function tenderRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    title: 'Supply of medical equipment',
    status: TenderStatus.OPEN,
    visibility: Visibility.PUBLIC_MARKETPLACE,
    closingDate: new Date(Date.now() + 86400000),
    currency: 'TZS',
    buyerOrgId: 'buyer-org-1',
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    bids: [],
    ...overrides
  };
}

function bidRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bid-1',
    tenderId: 'tender-1',
    tenderReference: 'PX-2026-001',
    tenderTitle: 'Supply of medical equipment',
    buyerOrgId: 'buyer-org-1',
    buyerName: 'Buyer Org',
    supplierOrgId: 'supplier-org-1',
    supplierName: 'Supplier Org',
    reference: 'PX-BID-2026-000001',
    status: BidStatus.DRAFT,
    submittedAt: null,
    totalAmount: 250000000,
    currency: 'TZS',
    payload: {
      administrative: {
        eligible: true,
        authorized: true
      },
      declarations: {
        confirmAccuracy: true,
        acceptTerms: true
      }
    },
    responses: [{ requirementKey: 'technical', response: { answer: 'Compliant' }, createdAt: new Date('2026-06-26T08:00:00.000Z') }],
    documents: [
      {
        id: 'bid-doc-1',
        documentId: 'doc-1',
        envelope: 'TECHNICAL',
        reviewStatus: 'UPLOADED',
        createdAt: new Date('2026-06-26T08:00:00.000Z'),
        document: { id: 'doc-1', name: 'technical-proposal.pdf', documentType: 'TECHNICAL_PROPOSAL', checksum: 'hash-doc-1', metadata: {} }
      }
    ],
    receipt: null,
    createdAt: new Date('2026-06-26T08:00:00.000Z'),
    updatedAt: new Date('2026-06-26T08:00:00.000Z'),
    tender: tenderRecord(),
    buyerOrg: { id: 'buyer-org-1', name: 'Buyer Org' },
    supplierOrg: { id: 'supplier-org-1', name: 'Supplier Org' },
    ...overrides
  };
}

function draftInput() {
  return {
    administrative: { eligible: true, authorized: true },
    technical: {},
    financial: {
      items: [{ quantity: 1, rate: 250000000 }]
    },
    declarations: {
      confirmAccuracy: true,
      acceptTerms: true
    },
    responses: [{ requirementKey: 'technical', response: { answer: 'Compliant' } }],
    documents: [{ name: 'technical-proposal.pdf', documentType: 'TECHNICAL_PROPOSAL', envelope: 'TECHNICAL' as const, checksum: 'hash-doc-1' }],
    totalAmount: 250000000,
    currency: 'TZS'
  };
}

function transactionMock() {
  return {
    bid: {
      update: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    bidVersion: {
      count: vi.fn(),
      create: vi.fn()
    },
    bidReceipt: {
      upsert: vi.fn()
    },
    bidResponse: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    bidDocument: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    documentObject: {
      create: vi.fn().mockResolvedValue({ id: 'doc-1' })
    },
    auditEvent: {
      create: vi.fn()
    }
  };
}
