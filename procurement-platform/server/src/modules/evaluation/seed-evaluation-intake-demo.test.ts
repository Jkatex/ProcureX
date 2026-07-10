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

    expect(tenders).toHaveLength(3);

    for (const tender of tenders) {
      expect(tender.status).toBe(TenderStatus.CLOSED);
      expect(tender.metadata).toMatchObject({ isDemo: true, bidOpeningStatus: 'COMPLETED', evaluationStatus: 'PENDING' });
      expect(tender.evaluation?.status).toBe(EvaluationStatus.NOT_STARTED);
      expect(tender.evaluation?.criteria).toHaveLength(5);
      expect(tender.evaluation?.criteria.map((criterion: any) => criterion.name)).toContain('Administrative Compliance');
      expect(tender.bids).toHaveLength(3);

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

    const works = tenders.find((tender: any) => tender.reference === 'PX-WRK-2026-001');
    const goods = tenders.find((tender: any) => tender.reference === 'PX-GDS-2026-002');
    const services = tenders.find((tender: any) => tender.reference === 'PX-SRV-2026-003');

    expect(works?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Technical Experience', 30],
        ['Methodology and Work Plan', 25],
        ['Equipment and Personnel', 20],
        ['Financial Proposal', 25]
      ])
    );
    expect(goods?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Technical Specification Compliance', 40],
        ['Warranty and After-Sales Support', 20],
        ['Delivery Period', 15],
        ['Financial Proposal', 25]
      ])
    );
    expect(services?.evaluation?.criteria.map((criterion: any) => [criterion.name, Number(criterion.weight?.toString() ?? 0)])).toEqual(
      expect.arrayContaining([
        ['Company Experience', 25],
        ['Staff Qualification', 20],
        ['Service Methodology', 25],
        ['Financial Proposal', 30]
      ])
    );
  }, 60000);
});

describe('evaluation intake demo seed metadata', () => {
  it('uses deterministic tender references', () => {
    expect(EVALUATION_INTAKE_TENDER_REFS).toEqual(['PX-WRK-2026-001', 'PX-GDS-2026-002', 'PX-SRV-2026-003']);
  });
});
