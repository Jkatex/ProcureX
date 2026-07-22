/* Exercises procurement behavior so regressions are caught close to the domain workflow they protect. */
import { BidStatus, EvaluationStatus, RecommendationStatus, TenderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { AWARD_READY_BUYER_EMAIL, AWARD_READY_DEMO_DATASET, AWARD_READY_TENDER_REF, seedAwardReadyDemo } from '../../../prisma/seed-award-ready-demo.js';

const runDbSeedSmoke = process.env.RUN_AWARD_READY_DEMO_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('award-ready demo seed', () => {
  it('creates one completed evaluation with four bids and source documents idempotently', async () => {
    const db = prisma as any;

    await seedAwardReadyDemo();
    await seedAwardReadyDemo();

    const buyer = await db.user.findUnique({ where: { email: AWARD_READY_BUYER_EMAIL } });
    expect(buyer).toBeTruthy();

    const tender = await db.tender.findUnique({
      where: { reference: AWARD_READY_TENDER_REF },
      include: {
        documents: { include: { document: true } },
        bids: {
          include: {
            documents: { include: { document: true } },
            receipt: true,
            versions: true
          },
          orderBy: { reference: 'asc' }
        },
        evaluation: {
          include: {
            criteria: true,
            scores: true,
            recommendations: true
          }
        }
      }
    });

    expect(tender?.status).toBe(TenderStatus.EVALUATION);
    expect(tender?.metadata).toMatchObject({ demoDataset: AWARD_READY_DEMO_DATASET });
    expect(tender?.documents).toHaveLength(1);
    expect(tender?.documents[0]?.document.objectKey).toContain(AWARD_READY_DEMO_DATASET);
    expect(tender?.bids).toHaveLength(4);
    expect(tender?.evaluation?.status).toBe(EvaluationStatus.COMPLETED);
    expect(tender?.evaluation?.criteria).toHaveLength(3);
    expect(tender?.evaluation?.scores).toHaveLength(12);
    expect(tender?.evaluation?.recommendations).toHaveLength(1);
    expect(tender?.evaluation?.recommendations[0]?.status).toBe(RecommendationStatus.RECOMMENDED);

    for (const bid of tender?.bids ?? []) {
      expect(bid.status).toBe(BidStatus.UNDER_EVALUATION);
      expect(bid.receipt).toBeTruthy();
      expect(bid.versions).toHaveLength(1);
      expect(bid.documents).toHaveLength(3);
      expect(bid.documents.every((row: any) => row.document.objectKey.includes(AWARD_READY_DEMO_DATASET))).toBe(true);
    }
  }, 60000);
});

describe('award-ready demo seed metadata', () => {
  it('uses deterministic references and dataset markers', () => {
    expect(AWARD_READY_DEMO_DATASET).toBe('award-ready-evaluation-demo');
    expect(AWARD_READY_TENDER_REF).toBe('PX-AWARD-READY-2026-001');
    expect(AWARD_READY_BUYER_EMAIL).toBe('award-ready-buyer@procurex.tz');
  });
});
