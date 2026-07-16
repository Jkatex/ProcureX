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
    expect(workspace.stages.map((stage) => stage.id)).toEqual(['setup', 'delivery', 'inspections', 'finance', 'risk', 'changes', 'claims', 'documents', 'closeout', 'performance', 'history']);
    expect(workspace.stages.find((stage) => stage.id === 'delivery')?.records[0]).toMatchObject({ type: 'milestone', title: 'First delivery' });
    expect(workspace.stages.find((stage) => stage.id === 'finance')?.records[0]).toMatchObject({ type: 'invoice', title: 'INV-001' });
    expect(workspace.secondary.map((register) => register.id)).toEqual(['termination', 'securities', 'audit']);
    expect(workspace.actions.find((action) => action.key === 'activate-contract')).toMatchObject({ owner: 'BUYER' });
    expect(workspace.actions.find((action) => action.key === 'deliverable')).toMatchObject({ enabled: true, owner: 'SUPPLIER' });
    expect(workspace.actions.find((action) => action.key === 'inspection')).toMatchObject({ enabled: false, owner: 'BUYER' });
  });

  it('generates control workflow tasks and redacts buyer-private control payload fields for suppliers', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        changeRequests: [{
          id: 'change-1',
          type: 'change_request',
          title: 'Add backup generator',
          status: 'RAISED',
          supplierResponse: '',
          payload: {
            visibilityScope: 'SHARED',
            privateNote: 'Budget reserve is limited.',
            legalReview: 'Internal legal note.'
          },
          createdAt: '2026-07-10T00:00:00.000Z'
        }],
        variations: [{ id: 'variation-1', title: 'Generator variation', changeType: 'SCOPE', status: 'OPEN', payload: {}, createdAt: '2026-07-11T00:00:00.000Z' }],
        claims: [{ id: 'claim-1', claimReference: 'CLM-001', title: 'Delay cost claim', status: 'OPEN', payload: {}, createdAt: '2026-07-12T00:00:00.000Z' }],
        disputes: [{ id: 'dispute-1', title: 'Delay entitlement dispute', status: 'OPEN', payload: {}, createdAt: '2026-07-13T00:00:00.000Z' }],
        nonConformances: [{ id: 'ncr-1', title: 'Missing test certificate', status: 'OPEN', payload: {}, createdAt: '2026-07-14T00:00:00.000Z' }],
        access: {
          viewerRole: 'SUPPLIER',
          canSubmitSupplierActions: true,
          canManageBuyerActions: false,
          readOnlyReason: null
        }
      }))
    });

    const workspace = await service.workspace('contract-1', supplierContext);

    expect(workspace.supplierTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'change-request-respond', status: 'READY' }),
      expect.objectContaining({ actionKey: 'ncr-response', status: 'READY' }),
      expect.objectContaining({ actionKey: 'claim-response', status: 'READY' }),
      expect.objectContaining({ actionKey: 'dispute-response', status: 'READY' })
    ]));
    expect(workspace.currentBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'open-change-requests', actionKey: 'change-request-review' }),
      expect.objectContaining({ id: 'open-variations', actionKey: 'variation-review' }),
      expect.objectContaining({ id: 'open-claims', actionKey: 'claim-response' }),
      expect.objectContaining({ id: 'open-disputes', actionKey: 'dispute-resolve' }),
      expect.objectContaining({ id: 'open-ncr', actionKey: 'ncr-response' })
    ]));
    const changeRecord = workspace.workflowSections.find((section) => section.id === 'changes')?.records.find((record) => record.id === 'change-1');
    expect(changeRecord?.payload).toMatchObject({ visibilityScope: 'SHARED' });
    expect(changeRecord?.payload).not.toHaveProperty('privateNote');
    expect(changeRecord?.payload).not.toHaveProperty('legalReview');
  });

  it('computes Works-specific tasks, blockers, and invoiceable certified IPCs', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        title: 'District road works',
        payload: { procurementType: 'WORKS' },
        access: {
          viewerRole: 'BUYER',
          canSubmitSupplierActions: false,
          canManageBuyerActions: true,
          readOnlyReason: null
        },
        siteHandovers: [{ id: 'site-1', handoverReference: 'SITE-001', status: 'HANDED_OVER', createdAt: '2026-07-01T00:00:00.000Z' }],
        worksProgressReports: [{ id: 'progress-1', reportReference: 'WPR-001', status: 'SUBMITTED', createdAt: '2026-07-03T00:00:00.000Z' }],
        boqMeasurements: [{ id: 'boq-1', boqItemReference: 'BOQ-1', status: 'APPROVED', certifiedAmount: 100000, currency: 'TZS', createdAt: '2026-07-04T00:00:00.000Z' }],
        interimPaymentCertificates: [{ id: 'ipc-1', certificateNumber: 'IPC-001', status: 'CERTIFIED', netAmount: 95000, currency: 'TZS', createdAt: '2026-07-05T00:00:00.000Z' }],
        defects: [{ id: 'defect-1', title: 'Cracked culvert', status: 'OPEN', payload: { responsibleRole: 'SUPPLIER' }, createdAt: '2026-07-06T00:00:00.000Z' }],
        invoices: [],
        worksCompletionCertificates: []
      }))
    });

    const workspace = await service.workspace('contract-1', buyerContext);

    expect(workspace.procurementType).toBe('WORKS');
    expect(workspace.buyerTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'works-progress-review', status: 'READY' }),
      expect.objectContaining({ actionKey: 'ipc-certify', status: 'DONE' }),
      expect.objectContaining({ actionKey: 'works-completion-certificate', status: 'READY' })
    ]));
    expect(workspace.supplierTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'invoice', status: 'READY' }),
      expect.objectContaining({ actionKey: 'defect-response', status: 'READY' })
    ]));
    expect(workspace.currentBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'open-defects', actionKey: 'defect-response' })
    ]));
    expect(workspace.financialEligibility.invoiceableRecords).toEqual([
      expect.objectContaining({
        type: 'interim_payment_certificate',
        executionReferenceId: 'ipc-1',
        remainingInvoiceableAmount: 95000
      })
    ]);
  });

  it('computes Services-specific tasks, blockers, incidents, and invoiceable approved reports', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        title: 'Hospital cleaning services',
        payload: { procurementType: 'SERVICES' },
        access: {
          viewerRole: 'BUYER',
          canSubmitSupplierActions: false,
          canManageBuyerActions: true,
          readOnlyReason: null
        },
        serviceLevels: [{ id: 'sla-1', metricKey: 'response-time', title: 'Response time', status: 'ACTIVE', createdAt: '2026-07-01T00:00:00.000Z' }],
        servicePeriods: [{ id: 'period-1', periodKey: '2026-07', status: 'OPEN', startDate: '2026-07-01T00:00:00.000Z', endDate: '2026-07-31T00:00:00.000Z' }],
        serviceReports: [
          { id: 'report-1', reportReference: 'SR-001', status: 'SUBMITTED', periodId: 'period-1', createdAt: '2026-07-05T00:00:00.000Z' },
          { id: 'report-2', reportReference: 'SR-002', status: 'APPROVED', periodId: 'period-1', acceptedAmount: 180000, currency: 'TZS', createdAt: '2026-07-06T00:00:00.000Z' }
        ],
        serviceCredits: [{ id: 'credit-1', creditType: 'SERVICE_CREDIT', status: 'DRAFT', amount: 15000, currency: 'TZS', createdAt: '2026-07-07T00:00:00.000Z' }],
        serviceIncidents: [{ id: 'incident-1', incidentReference: 'SINC-001', title: 'Missed response target', status: 'OPEN', payload: { responsibleRole: 'SUPPLIER' }, createdAt: '2026-07-08T00:00:00.000Z' }],
        invoices: []
      }))
    });

    const workspace = await service.workspace('contract-1', buyerContext);

    expect(workspace.procurementType).toBe('SERVICES');
    expect(workspace.workflowSections.find((section) => section.id === 'delivery')?.steps.map((step) => step.label)).toEqual(expect.arrayContaining([
      'SLA setup',
      'Service periods',
      'Service reports',
      'SLA verification'
    ]));
    expect(workspace.workflowSections.find((section) => section.id === 'finance')?.steps.map((step) => step.label)).toEqual(expect.arrayContaining([
      'Credits and penalties',
      'Invoice',
      'Payment'
    ]));
    expect(workspace.buyerTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'service-report-review', status: 'READY' }),
      expect.objectContaining({ actionKey: 'service-credit-review', status: 'READY' }),
      expect.objectContaining({ actionKey: 'service-incident', status: 'READY' })
    ]));
    expect(workspace.supplierTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'service-report', status: 'READY' }),
      expect.objectContaining({ actionKey: 'service-incident-response', status: 'READY' }),
      expect.objectContaining({ actionKey: 'invoice', status: 'READY' })
    ]));
    expect(workspace.currentBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'services-report-review-waiting', actionKey: 'service-report-review' }),
      expect.objectContaining({ id: 'open-service-incidents', actionKey: 'service-incident-response' })
    ]));
    expect(workspace.financialEligibility.invoiceableRecords).toEqual([
      expect.objectContaining({
        type: 'service_report',
        executionReferenceId: 'report-2',
        remainingInvoiceableAmount: 180000
      })
    ]);
  });

  it('computes Consultancy-specific tasks, blockers, final report, and invoiceable approved reviews', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        title: 'Design supervision consultancy',
        payload: { procurementType: 'CONSULTANCY' },
        access: {
          viewerRole: 'BUYER',
          canSubmitSupplierActions: false,
          canManageBuyerActions: true,
          readOnlyReason: null
        },
        consultancyDeliverables: [{ id: 'deliverable-1', deliverableCode: 'D-001', title: 'Inception report', status: 'APPROVED', paymentEligible: true, acceptedAmount: 220000, createdAt: '2026-07-01T00:00:00.000Z' }],
        deliverableVersions: [
          { id: 'version-1', deliverableId: 'deliverable-1', versionNo: 1, status: 'APPROVED', createdAt: '2026-07-02T00:00:00.000Z' },
          { id: 'version-2', deliverableId: 'deliverable-1', versionNo: 2, status: 'REVISION_REQUESTED', createdAt: '2026-07-03T00:00:00.000Z' }
        ],
        deliverableReviews: [{ id: 'review-1', versionId: 'version-1', decision: 'APPROVED', paymentEligible: true, acceptedAmount: 220000, createdAt: '2026-07-04T00:00:00.000Z' }],
        consultancyFinalReports: [{ id: 'final-1', reportReference: 'CFR-001', status: 'SUBMITTED', createdAt: '2026-07-05T00:00:00.000Z' }],
        invoices: []
      }))
    });

    const workspace = await service.workspace('contract-1', buyerContext);

    expect(workspace.procurementType).toBe('CONSULTANCY');
    expect(workspace.workflowSections.find((section) => section.id === 'delivery')?.steps.map((step) => step.label)).toEqual(expect.arrayContaining([
      'Deliverable plan',
      'Versioned submissions'
    ]));
    expect(workspace.workflowSections.find((section) => section.id === 'closeout')?.steps.map((step) => step.label)).toEqual(expect.arrayContaining([
      'Final report',
      'Closeout'
    ]));
    expect(workspace.buyerTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'deliverable-payment-eligibility', status: 'DONE' }),
      expect.objectContaining({ actionKey: 'consultancy-final-report-review', status: 'READY' })
    ]));
    expect(workspace.supplierTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'deliverable-version', status: 'READY' }),
      expect.objectContaining({ actionKey: 'invoice', status: 'READY' })
    ]));
    expect(workspace.currentBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'consultancy-revision-waiting', actionKey: 'deliverable-version' }),
      expect.objectContaining({ id: 'consultancy-final-report-review-waiting', actionKey: 'consultancy-final-report-review' })
    ]));
    expect(workspace.financialEligibility.invoiceableRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'consultancy_deliverable',
        executionReferenceId: 'deliverable-1',
        remainingInvoiceableAmount: 220000
      }),
      expect.objectContaining({
        type: 'deliverable_review',
        executionReferenceId: 'review-1',
        remainingInvoiceableAmount: 220000
      })
    ]));
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

  it('allows supplier dispatch notices and returns them in the delivery stage', async () => {
    const createDispatchNotice = vi.fn().mockResolvedValue(contract({
      dispatchNotices: [{ id: 'dispatch-1', dispatchReference: 'DN-001', status: 'DISPATCHED' }]
    }));
    const service = serviceWithAwardContract({ createDispatchNotice });

    const workspace = await service.createDispatchNotice('contract-1', {
      dispatchReference: 'DN-001',
      dispatchedQuantity: 10,
      payload: {}
    }, supplierContext);

    expect(createDispatchNotice).toHaveBeenCalledWith('contract-1', expect.objectContaining({ dispatchReference: 'DN-001' }), supplierContext);
    expect(workspace.stages.find((stage) => stage.id === 'delivery')?.records).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'dispatch_notice', title: 'DN-001', status: 'DISPATCHED' })])
    );
  });

  it('blocks supplier users from buyer-only goods receipt actions', async () => {
    const createGoodsReceipt = vi.fn();
    const service = serviceWithAwardContract({ createGoodsReceipt });

    await expect(service.createGoodsReceipt('contract-1', {
      receiptReference: 'GRN-001',
      status: 'APPROVED',
      lines: [{ description: 'Received goods', receivedQuantity: 10, acceptedQuantity: 10 }],
      payload: {}
    }, supplierContext)).rejects.toMatchObject({ status: 403 });
    expect(createGoodsReceipt).not.toHaveBeenCalled();
  });

  it('creates a structured termination notice when the buyer starts termination', async () => {
    const buyerAccess = {
      viewerRole: 'BUYER',
      canSubmitSupplierActions: false,
      canManageBuyerActions: true,
      readOnlyReason: null
    };
    const termination = {
      id: 'termination-1',
      terminationType: 'SUPPLIER_DEFAULT',
      status: 'DRAFT',
      reason: 'Repeated failed deliveries',
      contractClause: 'GC 45',
      faultParty: 'SUPPLIER',
      noticeDate: null,
      cureDeadline: '2026-08-01',
      terminationEffectiveDate: null,
      supplierResponse: '',
      finalDecision: '',
      payload: {},
      notices: [],
      evidence: [],
      valuation: null,
      settlement: null,
      replacementProcurement: null,
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z'
    };
    const createTermination = vi.fn().mockResolvedValue(contract({ access: buyerAccess, status: 'TERMINATION_REVIEW', terminations: [termination] }));
    const addTerminationNotice = vi.fn().mockResolvedValue(contract({
      access: buyerAccess,
      status: 'TERMINATION_REVIEW',
      terminations: [{ ...termination, status: 'NOTICE_ISSUED', notices: [{ id: 'notice-1', title: 'TERMINATION_NOTICE', status: 'OPEN' }] }]
    }));
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({ access: buyerAccess })),
      createTermination,
      addTerminationNotice
    });

    const workspace = await service.createTermination('contract-1', {
      terminationType: 'SUPPLIER_DEFAULT',
      reason: 'Repeated failed deliveries',
      contractClause: 'GC 45',
      faultParty: 'SUPPLIER',
      cureDeadline: '2026-08-01',
      payload: {}
    } as never, buyerContext);

    expect(createTermination).toHaveBeenCalledWith('contract-1', expect.objectContaining({ reason: 'Repeated failed deliveries' }), buyerContext);
    expect(addTerminationNotice).toHaveBeenCalledWith('contract-1', 'termination-1', expect.objectContaining({
      noticeType: 'TERMINATION_NOTICE',
      contractClause: 'GC 45',
      deadline: '2026-08-01',
      note: 'Repeated failed deliveries',
      requiredAction: expect.stringContaining('2026-08-01')
    }), buyerContext);
    expect(workspace.detail?.terminations[0]?.status).toBe('NOTICE_ISSUED');
    expect(workspace.detail?.terminations[0]?.notices).toHaveLength(1);
  });

  it('maps post-award termination decisions to reject and final terminated statuses', async () => {
    const buyerAccess = {
      viewerRole: 'BUYER',
      canSubmitSupplierActions: false,
      canManageBuyerActions: true,
      readOnlyReason: null
    };
    const updateTermination = vi.fn().mockResolvedValue(contract({
      access: buyerAccess,
      status: 'TERMINATED',
      terminations: [{
        id: 'termination-1',
        terminationType: 'SUPPLIER_DEFAULT',
        status: 'TERMINATED',
        reason: 'Repeated failed deliveries',
        contractClause: 'GC 45',
        faultParty: 'SUPPLIER',
        noticeDate: null,
        cureDeadline: null,
        terminationEffectiveDate: '2026-07-20',
        supplierResponse: 'No cure possible',
        finalDecision: 'Terminate for default',
        payload: {},
        notices: [],
        evidence: [],
        valuation: null,
        settlement: null,
        replacementProcurement: null,
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z'
      }]
    }));
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({ access: buyerAccess })),
      updateTermination
    });

    await service.controlTermination('contract-1', 'termination-1', 'reject', { decision: 'Supplier cured default', payload: {} }, buyerContext);
    await service.controlTermination('contract-1', 'termination-1', 'terminate', { decision: 'Terminate for default', signatureKeyphrase: 'Signing123', payload: {} }, buyerContext);

    expect(updateTermination).toHaveBeenNthCalledWith(1, 'contract-1', 'termination-1', expect.objectContaining({
      status: 'REJECTED',
      finalDecision: 'Supplier cured default'
    }), buyerContext);
    expect(updateTermination).toHaveBeenNthCalledWith(2, 'contract-1', 'termination-1', expect.objectContaining({
      status: 'TERMINATED',
      finalDecision: 'Terminate for default',
      signatureKeyphrase: 'Signing123',
      terminationEffectiveDate: expect.any(String)
    }), buyerContext);
  });

  it('redacts buyer-private finance payloads from supplier workspaces', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        paymentApprovals: [{
          id: 'approval-1',
          type: 'payment_approval',
          title: 'Internal payment approval',
          status: 'MATCHED',
          note: 'Buyer internal payment note',
          amount: 500000,
          currency: 'TZS',
          payload: { visibilityScope: 'BUYER_PRIVATE', internalComment: 'Do not show supplier' },
          createdAt: '2026-07-10T00:00:00.000Z'
        }]
      }))
    });

    const workspace = await service.workspace('contract-1', supplierContext);
    const approval = workspace.workflowSections.find((section) => section.id === 'finance')?.records.find((record) => record.id === 'approval-1');

    expect(approval).toMatchObject({
      note: 'Private workflow record',
      amount: null,
      payload: { visibilityScope: 'BUYER_PRIVATE', redacted: true }
    });
  });

  it('computes finance depth queue, metrics, and closeout blockers', async () => {
    const service = serviceWithAwardContract({
      contract: vi.fn().mockResolvedValue(contract({
        access: {
          viewerRole: 'BUYER',
          canSubmitSupplierActions: false,
          canManageBuyerActions: true,
          readOnlyReason: null
        },
        invoices: [
          { id: 'invoice-review', reference: 'INV-REVIEW', status: 'SUBMITTED', amount: 100000, currency: 'TZS', createdAt: '2026-07-01T00:00:00.000Z' },
          { id: 'invoice-matched', reference: 'INV-MATCHED', status: 'MATCHED', amount: 250000, currency: 'TZS', createdAt: '2026-07-02T00:00:00.000Z' },
          { id: 'invoice-blocked', reference: 'INV-BLOCKED', status: 'BLOCKED', amount: 50000, currency: 'TZS', createdAt: '2026-07-03T00:00:00.000Z' }
        ],
        paymentApprovals: [
          { id: 'recommendation-1', invoiceId: 'invoice-matched', stepKey: 'payment-recommendation', role: 'FINANCE_REVIEWER', status: 'REVIEW', amountApproved: 250000, currency: 'TZS', payload: {}, createdAt: '2026-07-04T00:00:00.000Z' }
        ],
        payments: [
          { id: 'payment-1', invoiceId: 'invoice-paid', status: 'PAID', grossAmount: 120000, retentionAmount: 10000, advanceRecovery: 5000, liquidatedDamages: 0, taxWithholding: 0, netAmount: 105000, currency: 'TZS', paidAt: '2026-07-05T00:00:00.000Z', payload: {}, createdAt: '2026-07-05T00:00:00.000Z' }
        ],
        paymentConfirmations: [],
        penalties: [
          { id: 'penalty-1', penaltyType: 'LIQUIDATED_DAMAGES', status: 'DRAFT', amount: 15000, currency: 'TZS', payload: {}, createdAt: '2026-07-06T00:00:00.000Z' }
        ],
        worksCompletionCertificates: [{ id: 'final-account-1', certificateType: 'FINAL_ACCOUNT', retentionReleaseAmount: 2000, currency: 'TZS', status: 'APPROVED', createdAt: '2026-07-07T00:00:00.000Z' }],
        payload: { procurementType: 'WORKS', advancePaymentAmount: 30000 }
      }))
    });

    const workspace = await service.workspace('contract-1', buyerContext);

    expect(workspace.buyerTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'invoice-verify', status: 'READY' }),
      expect.objectContaining({ actionKey: 'payment-approval-review', status: 'READY' }),
      expect.objectContaining({ actionKey: 'finance-deduction-review', status: 'READY' }),
      expect.objectContaining({ actionKey: 'finance-retention', status: 'READY' }),
      expect.objectContaining({ actionKey: 'finance-advance-recovery', status: 'READY' })
    ]));
    expect(workspace.supplierTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'invoice-correction', status: 'READY' }),
      expect.objectContaining({ actionKey: 'payment-confirmation', status: 'READY' })
    ]));
    expect(workspace.financialEligibility.paymentQueue).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionKey: 'invoice-verify', invoiceId: 'invoice-review' }),
      expect.objectContaining({ actionKey: 'payment-approval-review', invoiceId: 'invoice-matched' }),
      expect.objectContaining({ actionKey: 'payment-confirmation', paymentId: 'payment-1' }),
      expect.objectContaining({ actionKey: 'finance-deduction-review', id: 'penalty-1' })
    ]));
    expect(workspace.financialEligibility.retentionSummary).toMatchObject({ retainedAmount: 10000, releasedAmount: 2000, remainingRetention: 8000 });
    expect(workspace.financialEligibility.advanceRecoverySummary).toMatchObject({ recoveredAmount: 5000, outstandingAmount: 25000 });
    expect(workspace.financialEligibility.financialCloseoutBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'finance-payment-workflow-open' }),
      expect.objectContaining({ id: 'finance-supplier-receipt-pending' }),
      expect.objectContaining({ id: 'finance-retention-open' }),
      expect.objectContaining({ id: 'finance-advance-open' }),
      expect.objectContaining({ id: 'finance-deductions-open' })
    ]));
  });
});
