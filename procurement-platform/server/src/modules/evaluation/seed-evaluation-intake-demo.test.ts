/* Exercises evaluation behavior so regressions are caught close to the domain workflow they protect. */
import { BidStatus, EvaluationStatus, TenderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { EVALUATION_INTAKE_TENDER_REFS, seedEvaluationIntakeDemo } from '../../../prisma/seed-evaluation-intake-demo.js';

const runDbSeedSmoke = process.env.RUN_EVALUATION_INTAKE_DEMO_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('evaluation intake demo seed', () => {
  it('creates submitted and opened closed tenders idempotently for evaluation', async () => {
    const db = prisma as any;

    await seedEvaluationIntakeDemo();
    await seedEvaluationIntakeDemo();

    const tenders = await db.tender.findMany({
      where: { reference: { in: [...EVALUATION_INTAKE_TENDER_REFS] } },
      include: {
        bids: {
          include: {
            versions: true,
            receipt: true,
            documents: { include: { document: true } },
            submittedByUser: true,
            supplierOrg: true
          },
          orderBy: { reference: 'asc' }
        },
        evaluation: { include: { criteria: true } }
      },
      orderBy: { reference: 'asc' }
    });

    expect(tenders).toHaveLength(4);

    for (const tender of tenders) {
      expect(tender.status).toBe(TenderStatus.CLOSED);
      expect(tender.metadata).toMatchObject({ isDemo: true, bidOpeningStatus: 'COMPLETED', evaluationStatus: 'PENDING' });
      expect(tender.evaluation?.status).toBe(EvaluationStatus.NOT_STARTED);
      expect(tender.evaluation?.criteria).toHaveLength(5);
      expect(tender.evaluation?.criteria.map((criterion: any) => criterion.name)).toContain('Administrative Compliance');
      expect(tender.bids.length).toBeGreaterThanOrEqual(2);

      for (const bid of tender.bids) {
        expect(bid.status).toBe(BidStatus.SUBMITTED);
        expect(bid.submittedAt.getTime()).toBeLessThan(tender.closingDate.getTime());
        expect(bid.submittedByUserId).toBeTruthy();
        expect(bid.submittedByUser).toBeTruthy();
        expect(bid.supplierOrg).toBeTruthy();
        expect(bid.payload).toMatchObject({
          isDemo: true,
          submissionStatus: 'SUBMITTED',
          openingStatus: 'OPENED',
          administrativeStatus: 'PENDING',
          technicalStatus: 'PENDING',
          financialStatus: 'PENDING'
        });
        expect(bid.receipt).toBeTruthy();
        expect(bid.versions).toHaveLength(1);
        expect(bid.documents.length).toBeGreaterThanOrEqual(5);
        expect(bid.documents.map((row: any) => row.document.name)).toEqual(
          expect.arrayContaining(['Business Registration Certificate', 'Tax Clearance Certificate', 'Technical Proposal', 'Financial Proposal'])
        );
      }
    }

    const goods = tenders.find((tender: any) => tender.reference === 'PX-GDS-2026-001');
    const works = tenders.find((tender: any) => tender.reference === 'PX-WRK-2026-002');
    const services = tenders.find((tender: any) => tender.reference === 'PX-SRV-2026-003');
    const consultancy = tenders.find((tender: any) => tender.reference === 'PX-CON-2026-004');

    expect(works?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Similar project experience', 25],
        ['Construction methodology and work programme', 25],
        ['Key personnel, equipment, health and safety', 25],
        ['BOQ and financial proposal', 25]
      ])
    );
    expect(goods?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Technical specification compliance', 35],
        ['Warranty and after-sales support', 20],
        ['Delivery schedule and stock availability', 15],
        ['Financial proposal', 30]
      ])
    );
    expect(services?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Understanding of scope and service methodology', 25],
        ['Staffing, equipment and resources', 20],
        ['Service schedule and SLA controls', 25],
        ['Financial proposal', 30]
      ])
    );
    expect(consultancy?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Firm experience', 20],
        ['Technical approach, methodology and work plan', 35],
        ['Key experts qualifications and experience', 25],
        ['Financial proposal', 20]
      ])
    );
  }, 60000);
});

describe('evaluation intake demo seed metadata', () => {
  it('uses deterministic tender references', () => {
    expect(EVALUATION_INTAKE_TENDER_REFS).toEqual(['PX-GDS-2026-001', 'PX-WRK-2026-002', 'PX-SRV-2026-003', 'PX-CON-2026-004']);
  });
});
