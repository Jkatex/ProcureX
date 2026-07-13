import { TenderStatus } from '@prisma/client';
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
});
