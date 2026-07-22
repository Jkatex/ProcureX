/* Exercises evaluation behavior so regressions are caught close to the domain workflow they protect. */
import { EvaluationStage, EvaluationStatus, TenderStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ModuleRepository } from '../repository.js';
import { ModuleService } from '../service.js';

describe('evaluation service readiness', () => {
  it('opens a closed tender for evaluation even when the scheduled closing date is still in the future', async () => {
    const service = new ModuleService({
      listReadyTenders: vi.fn().mockResolvedValue([
        {
          id: 'tender-1',
          reference: 'PX-TEST-001',
          title: 'Closed early tender',
          type: 'GOODS',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2099-01-01T00:00:00.000Z'),
          requirements: [],
          metadata: {},
          requirementRows: [],
          buyerOrg: {
            name: 'Buyer Org'
          },
          evaluation: null,
          bids: [
            {
              id: 'bid-1'
            }
          ]
        }
      ])
    } as any);

    const response = await service.ready();

    expect(response.tenders[0]).toMatchObject({
      tenderId: 'tender-1',
      ready: true,
      status: 'NOT_STARTED',
      bidCount: 1,
      hasClosed: true,
      openingStatus: 'COMPLETED',
      evaluationStatus: 'NOT_STARTED',
      canStartEvaluation: true,
      canContinueEvaluation: false,
      lockReason: null,
      tenderStatus: TenderStatus.CLOSED,
      bidOpeningStatus: 'Opening Completed',
      readinessReason: null
    });
  });

  it('opens a past-closing published tender when bid opening is complete', async () => {
    const service = new ModuleService({
      listReadyTenders: vi.fn().mockResolvedValue([
        {
          id: 'tender-2',
          reference: 'PX-TEST-002',
          title: 'Past closing tender',
          type: 'GOODS',
          status: TenderStatus.PUBLISHED,
          closingDate: new Date('2020-01-01T00:00:00.000Z'),
          requirements: [],
          metadata: {
            bidOpeningStatus: 'COMPLETED'
          },
          requirementRows: [],
          buyerOrg: {
            name: 'Buyer Org'
          },
          evaluation: null,
          bids: [
            {
              id: 'bid-1'
            }
          ]
        }
      ])
    } as any);

    const response = await service.ready();

    expect(response.tenders[0]).toMatchObject({
      hasClosed: true,
      openingStatus: 'COMPLETED',
      evaluationStatus: 'NOT_STARTED',
      canStartEvaluation: true,
      canContinueEvaluation: false,
      lockReason: null
    });
  });

  it('returns explicit lock reasons for closed tenders without bids or opening completion', async () => {
    const service = new ModuleService({
      listReadyTenders: vi.fn().mockResolvedValue([
        {
          id: 'tender-3',
          reference: 'PX-TEST-003',
          title: 'No bids tender',
          type: 'GOODS',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2020-01-01T00:00:00.000Z'),
          requirements: [],
          metadata: {},
          requirementRows: [],
          buyerOrg: { name: 'Buyer Org' },
          evaluation: null,
          bids: []
        },
        {
          id: 'tender-4',
          reference: 'PX-TEST-004',
          title: 'Opening pending tender',
          type: 'GOODS',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2020-01-01T00:00:00.000Z'),
          requirements: [],
          metadata: { bidOpeningStatus: 'PENDING' },
          requirementRows: [],
          buyerOrg: { name: 'Buyer Org' },
          evaluation: null,
          bids: [{ id: 'bid-1' }]
        }
      ])
    } as any);

    const response = await service.ready();

    expect(response.tenders[0]).toMatchObject({
      canStartEvaluation: false,
      lockReason: 'No bids available for evaluation'
    });
    expect(response.tenders[1]).toMatchObject({
      canStartEvaluation: false,
      openingStatus: 'PENDING',
      lockReason: 'Complete bid opening first'
    });
  });

  it('returns tender design data and saved section drafts in the workspace DTO', async () => {
    const service = new ModuleService({
      getWorkspaceByTenderId: vi.fn().mockResolvedValue({
        tender: {
          id: 'tender-workspace',
          reference: 'PX-TEST-WS',
          title: 'Workspace tender',
          type: 'CONSULTANCY',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2026-01-01T10:00:00.000Z'),
          currency: 'TZS',
          requirements: {
            consultancy: {
              fields: {
                otherEligibilityRequirements: [
                  { requirementName: 'Signed conflict of interest declaration', mandatory: true, notes: 'Required from every consultant.' }
                ]
              }
            },
            scope: 'Advisory services'
          },
          metadata: { bidOpeningStatus: 'COMPLETED' },
          requirementRows: [
            { id: 'req-1', section: 'TOR', payload: { title: 'Methodology' } }
          ],
          commercialItems: [
            { id: 'line-1', itemNo: '1', description: 'Professional fees', quantity: 1, unit: 'Lot', rate: 100, total: 100, payload: { note: 'fees' } }
          ],
          buyerOrg: { name: 'Buyer Org' },
          evaluation: {
            id: 'workspace-1',
            status: 'IN_PROGRESS',
            currentStage: 'CLARIFICATIONS',
            progress: 25,
            payload: {
              activeStageId: 'technical',
              sectionDraft: { technical: { 'bid-1': { 'requirement-req-1': { decision: 'Pass', remark: 'Responsive.' } } } }
            },
            updatedAt: new Date('2026-01-02T10:00:00.000Z'),
            criteria: [],
            scores: [],
            recommendations: []
          },
          bids: [
            {
              id: 'bid-1',
              reference: 'PX-BID-1',
              status: 'SUBMITTED',
              submittedAt: new Date('2026-01-01T11:00:00.000Z'),
              totalAmount: 100,
              currency: 'TZS',
              payload: {},
              supplierOrg: { name: 'Supplier One' },
              receipt: { receiptRef: 'BID-PX-BID-1-01', receiptHash: 'hash-1' },
              documents: [],
              responses: []
            }
          ]
        },
        auditEvents: []
      })
    } as any);

    const workspace = await service.workspace('tender-workspace');

    expect(workspace.tender).toMatchObject({
      requirements: {
        consultancy: {
          fields: {
            otherEligibilityRequirements: [
              { requirementName: 'Signed conflict of interest declaration', mandatory: true, notes: 'Required from every consultant.' }
            ]
          }
        },
        scope: 'Advisory services'
      },
      metadata: { bidOpeningStatus: 'COMPLETED' },
      requirementRows: [{ id: 'req-1', section: 'TOR', payload: { title: 'Methodology' } }],
      commercialItems: [{ id: 'line-1', description: 'Professional fees', quantity: 1, total: 100 }]
    });
    expect(workspace.bids[0]).toMatchObject({
      receiptRef: 'BID-PX-BID-1-01',
      receiptHash: 'hash-1'
    });
    expect(workspace.sectionDraft).toEqual({ technical: { 'bid-1': { 'requirement-req-1': { decision: 'Pass', remark: 'Responsive.' } } } });
    expect(workspace.summary.activeStageId).toBe('technical');
    expect(workspace.evaluationConfiguration).toMatchObject({
      procurementCategory: 'CONSULTANCY',
      evaluationMethod: 'Manual Buyer Review',
      stages: expect.arrayContaining([{ id: 'technical', label: 'Custom Evaluation Criteria' }]),
      evaluationCriteria: [],
      sections: expect.arrayContaining([
        expect.objectContaining({
          id: 'preliminary',
          items: expect.arrayContaining([
            expect.objectContaining({ title: 'Signed conflict of interest declaration', source: 'Eligibility' })
          ])
        }),
        expect.objectContaining({
          id: 'technical',
          items: expect.arrayContaining([
            expect.objectContaining({ title: 'Methodology', source: 'TOR' })
          ])
        }),
        expect.objectContaining({
          id: 'financial',
          items: expect.arrayContaining([
            expect.objectContaining({ title: '1 - Professional fees', source: 'Commercial schedule' })
          ])
        })
      ])
    });
  });

  it.each([
    ['GOODS', ['opening', 'preliminary', 'technical', 'financial', 'verification', 'ranking', 'report']],
    ['WORKS', ['opening', 'preliminary', 'technical', 'financial', 'verification', 'ranking', 'report']],
    ['SERVICE', ['opening', 'preliminary', 'technical', 'financial', 'verification', 'ranking', 'report']],
    ['CONSULTANCY', ['opening', 'preliminary', 'technical', 'financial', 'verification', 'ranking', 'report']]
  ])('returns the procurex-ui stage order for %s evaluation', async (type, expectedStages) => {
    const service = new ModuleService({
      getWorkspaceByTenderId: vi.fn().mockResolvedValue({
        tender: {
          id: `tender-${type}`,
          reference: `PX-${type}`,
          title: `${type} tender`,
          type,
          method: 'OPEN_TENDER',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2026-01-01T10:00:00.000Z'),
          currency: 'TZS',
          requirements: {},
          metadata: { bidOpeningStatus: 'COMPLETED' },
          requirementRows: [],
          commercialItems: [],
          documents: [],
          buyerOrg: { name: 'Buyer Org' },
          evaluation: null,
          bids: []
        },
        auditEvents: []
      })
    } as any);

    const workspace = await service.workspace(`tender-${type}`);

    expect(workspace.evaluationConfiguration?.stages.map((stage) => stage.id)).toEqual(expectedStages);
  });
});

describe('evaluation repository readiness maintenance', () => {
  it('marks elapsed published or open tenders closed before returning the evaluation queue', async () => {
    const db = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.listReadyTenders();

    expect(db.tender.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [TenderStatus.PUBLISHED, TenderStatus.OPEN] },
        closingDate: { lte: expect.any(Date) }
      },
      data: {
        status: TenderStatus.CLOSED
      }
    });
  });

  it('lists explicit saved drafts and legacy score drafts without listing unsaved auto-created workspaces', async () => {
    const db = {
      evaluationWorkspace: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };
    const repository = new ModuleRepository(db as any);

    await repository.listDrafts({ organizationId: 'buyer-org-1' });

    expect(db.evaluationWorkspace.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        buyerOrgId: 'buyer-org-1',
        status: { in: [EvaluationStatus.IN_PROGRESS, EvaluationStatus.RETURNED] },
        OR: [
          { payload: { path: ['draftSaved'], equals: true } },
          { scores: { some: {} } }
        ]
      }
    }));
  });

  it('marks explicit non-final saves as drafts even when only section draft data is saved', async () => {
    const updateWorkspace = vi.fn().mockResolvedValue({});
    const tx = {
      tender: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'tender-draft-1',
          buyerOrgId: 'buyer-org-1',
          status: TenderStatus.CLOSED,
          closingDate: new Date('2020-01-01T00:00:00.000Z'),
          metadata: { bidOpeningStatus: 'COMPLETED' },
          evaluation: {
            id: 'workspace-draft-1',
            status: EvaluationStatus.IN_PROGRESS,
            currentStage: EvaluationStage.OPENING,
            payload: {},
            criteria: [],
            scores: []
          },
          bids: [
            {
              id: 'bid-1',
              totalAmount: 100,
              currency: 'TZS',
              supplierOrg: { id: 'supplier-org-1' }
            }
          ]
        })
      },
      evaluationCriterion: {
        findMany: vi.fn().mockResolvedValue([])
      },
      evaluationScore: {
        findMany: vi.fn().mockResolvedValue([])
      },
      evaluationWorkspace: {
        update: updateWorkspace
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const db = {
      $transaction: vi.fn(async (callback) => callback(tx))
    };
    const repository = new ModuleRepository(db as any);

    await repository.saveWorkspace('tender-draft-1', {
      scores: [],
      decisions: [],
      activeStageId: 'technical',
      selectedBidId: 'bid-1',
      sectionDraft: {
        technical: {
          'bid-1': {
            'requirement-1': {
              decision: 'Pass',
              remark: 'Responsive.'
            }
          }
        }
      },
      complete: false
    });

    expect(updateWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: EvaluationStatus.IN_PROGRESS,
        currentStage: EvaluationStage.TECHNICAL,
        payload: expect.objectContaining({
          draftSaved: true,
          activeStageId: 'technical',
          selectedBidId: 'bid-1',
          sectionDraft: expect.objectContaining({
            technical: expect.any(Object)
          })
        })
      })
    }));
  });
});
