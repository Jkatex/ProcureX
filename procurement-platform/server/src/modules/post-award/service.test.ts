import { describe, expect, it, vi } from 'vitest';
import { ModuleService } from './service.js';

const buyerContext = { organizationId: 'buyer-org', userId: 'buyer-user', isAdmin: false };
const supplierContext = { organizationId: 'supplier-org', userId: 'supplier-user', isAdmin: false };

function contract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    reference: 'PX-C-001',
    title: 'Clinic delivery contract',
    status: 'ACTIVE',
    buyerName: 'Arusha City Council',
    supplierName: 'Moshi Medical Supplies',
    amount: 1200000,
    currency: 'TZS',
    tenderId: 'tender-1',
    tenderReference: 'TDR-001',
    milestones: [{ id: 'milestone-1', title: 'First delivery', status: 'OPEN', dueDate: '2026-07-30T00:00:00.000Z' }],
    managementPlan: null,
    commencements: [],
    mobilizationItems: [],
    deliverables: [],
    inspections: [],
    goodsInspections: [],
    acceptances: [],
    invoices: [{ id: 'invoice-1', reference: 'INV-001', status: 'SUBMITTED', amount: 500000, currency: 'TZS' }],
    paymentSchedules: [],
    payments: [],
    paymentApprovals: [],
    paymentConfirmations: [],
    issues: [],
    variations: [],
    changeRequests: [],
    audit: [{ id: 'audit-1', event: 'CONTRACT_SIGNED', createdAt: '2026-07-01T00:00:00.000Z' }],
    notifications: [],
    terminations: [],
    requiredDocuments: [],
    warranties: [],
    supplierPerformanceRecords: [],
    performanceScores: [],
    supplierRiskProfile: null,
    securities: [],
    risks: [],
    closeout: null,
    access: {
      viewerRole: 'SUPPLIER',
      canSubmitSupplierActions: true,
      canManageBuyerActions: false,
      readOnlyReason: null
    },
    ...overrides
  };
}

function serviceWithAwardContract(overrides: Record<string, unknown>) {
  return new ModuleService({
    listContracts: vi.fn().mockResolvedValue({
      contracts: [
        {
          id: 'contract-1',
          reference: 'PX-C-001',
          title: 'Clinic delivery contract',
          status: 'ACTIVE',
          buyerOrgId: 'buyer-org',
          buyerName: 'Arusha City Council',
          supplierOrgId: 'supplier-org',
          supplierName: 'Moshi Medical Supplies',
          amount: 1200000,
          currency: 'TZS'
        },
        {
          id: 'contract-2',
          reference: 'PX-C-002',
          title: 'Completed supply contract',
          status: 'CLOSED',
          buyerOrgId: 'supplier-org',
          buyerName: 'Buyer org',
          supplierOrgId: 'dodoma-supplier',
          supplierName: 'Dodoma Supplier',
          amount: 700000,
          currency: 'TZS'
        },
        {
          id: 'draft-contract',
          reference: 'PX-C-003',
          title: 'Not post award',
          status: 'DRAFT',
          buyerOrgId: 'buyer-org',
          buyerName: 'Buyer org',
          supplierOrgId: 'supplier-org',
          supplierName: 'Moshi Medical Supplies',
          amount: null,
          currency: 'TZS'
        }
      ]
    }),
    contract: vi.fn().mockResolvedValue(contract()),
    createDeliverable: vi.fn().mockResolvedValue(contract({ deliverables: [{ id: 'deliverable-1', title: 'Batch one', status: 'SUBMITTED' }] })),
    createInspection: vi.fn().mockResolvedValue(contract()),
    ...overrides
  } as never);
}

describe('post-award ModuleService', () => {
  it('lists only active and closed post-award contracts visible to the viewer', async () => {
    const service = serviceWithAwardContract({});

    const rows = await service.contracts(supplierContext);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'contract-1',
      viewerRole: 'SUPPLIER',
      buyerName: 'Arusha City Council',
      supplierName: 'Your organization',
      nextAction: 'Monitor execution'
    });
    expect(rows[1]).toMatchObject({
      id: 'contract-2',
      viewerRole: 'BUYER',
      buyerName: 'Your organization',
      supplierName: 'Dodoma Supplier'
    });
  });

  it('groups a contract workspace into primary stages and secondary registers', async () => {
    const service = serviceWithAwardContract({});

    const workspace = await service.workspace('contract-1', supplierContext);

    expect(workspace.contract.reference).toBe('PX-C-001');
    expect(workspace.stages.map((stage) => stage.id)).toEqual(['setup', 'delivery', 'acceptance', 'finance', 'issues', 'variations', 'closeout', 'history']);
    expect(workspace.stages.find((stage) => stage.id === 'delivery')?.records[0]).toMatchObject({ type: 'milestone', title: 'First delivery' });
    expect(workspace.stages.find((stage) => stage.id === 'finance')?.records[0]).toMatchObject({ type: 'invoice', title: 'INV-001' });
    expect(workspace.secondary.map((register) => register.id)).toEqual(['termination', 'documents', 'performance', 'securities', 'audit']);
    expect(workspace.actions.find((action) => action.key === 'deliverable')).toMatchObject({ enabled: true, owner: 'SUPPLIER' });
    expect(workspace.actions.find((action) => action.key === 'inspection')).toMatchObject({ enabled: false, owner: 'BUYER' });
  });

  it('enforces buyer ownership for buyer-only post-award actions', async () => {
    const createInspection = vi.fn();
    const service = serviceWithAwardContract({ createInspection });

    await expect(service.createInspection('contract-1', { title: 'Site inspection', inspectionType: 'site', payload: {} }, supplierContext)).rejects.toMatchObject({ status: 403 });
    expect(createInspection).not.toHaveBeenCalled();
  });

  it('allows supplier-owned deliverable submission and returns the refreshed workspace', async () => {
    const service = serviceWithAwardContract({});

    const workspace = await service.createDeliverable('contract-1', { title: 'Batch one', status: 'SUBMITTED', payload: {} }, supplierContext);

    expect(workspace.stages.find((stage) => stage.id === 'delivery')?.records).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'deliverable', title: 'Batch one', status: 'SUBMITTED' })])
    );
  });
});
