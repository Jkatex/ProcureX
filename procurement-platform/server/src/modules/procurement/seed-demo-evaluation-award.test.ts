import { AwardResponseAction, EvaluationStatus, RecommendationStatus, TenderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { ModuleRepository } from '../award-contract/repository.js';
import {
  DEMO_EVALUATION_AWARD_BUYER_EMAIL,
  DEMO_EVALUATION_AWARD_DATASET,
  DEMO_EVALUATION_AWARD_KEYPHRASE,
  DEMO_EVALUATION_AWARD_TENDER_REF,
  DEMO_EVALUATION_AWARD_WINNER_EMAIL,
  seedDemoEvaluationAward
} from '../../../prisma/seed-demo-evaluation-award.js';

const runDbSeedSmoke = process.env.RUN_DEMO_EVALUATION_AWARD_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('two-user demo evaluation award seed', () => {
  it('creates a ready-to-award completed evaluation and exposes the normal buyer/supplier queues', async () => {
    const db = prisma as any;

    await seedDemoEvaluationAward();
    await seedDemoEvaluationAward();

    const tender = await db.tender.findUnique({
      where: { reference: DEMO_EVALUATION_AWARD_TENDER_REF },
      include: {
        bids: { include: { supplierOrg: true, receipt: true, versions: true, documents: { include: { document: true } } }, orderBy: { reference: 'asc' } },
        evaluation: { include: { criteria: true, scores: true, recommendations: { include: { bid: true, supplierOrg: true } } } }
      }
    });
    expect(tender?.status).toBe(TenderStatus.EVALUATION);
    expect(tender?.metadata).toMatchObject({ demoDataset: DEMO_EVALUATION_AWARD_DATASET });
    expect(tender?.bids).toHaveLength(2);
    expect(tender?.evaluation?.status).toBe(EvaluationStatus.COMPLETED);
    expect(tender?.evaluation?.criteria).toHaveLength(3);
    expect(tender?.evaluation?.scores).toHaveLength(6);
    expect(tender?.evaluation?.recommendations).toHaveLength(1);

    const recommendation = tender!.evaluation!.recommendations[0]!;
    expect(recommendation.status).toBe(RecommendationStatus.RECOMMENDED);
    expect(recommendation.supplierOrgId).toBe(tender!.bids[0]!.supplierOrgId);

    for (const bid of tender?.bids ?? []) {
      expect(bid.receipt).toBeTruthy();
      expect(bid.versions).toHaveLength(1);
      expect(bid.documents).toHaveLength(3);
      expect(bid.documents.every((row: any) => row.document.objectKey.includes(DEMO_EVALUATION_AWARD_DATASET))).toBe(true);
    }

    const buyer = await db.user.findUnique({ where: { email: DEMO_EVALUATION_AWARD_BUYER_EMAIL }, include: { memberships: { where: { status: 'ACTIVE' }, include: { organization: true } } } });
    const supplier = await db.user.findUnique({ where: { email: DEMO_EVALUATION_AWARD_WINNER_EMAIL }, include: { memberships: { where: { status: 'ACTIVE' }, include: { organization: true } } } });
    const buyerContext = { userId: buyer!.id, organizationId: buyer!.memberships[0]!.organizationId };
    const supplierContext = { userId: supplier!.id, organizationId: supplier!.memberships[0]!.organizationId };
    const repository = new ModuleRepository(prisma);

    const buyerDashboard = await repository.dashboard(buyerContext);
    expect(buyerDashboard.queues['awarding-in-progress'].some((item) => item.awardId === recommendation.id)).toBe(true);

    const supplierDashboardBeforeNotice = await repository.dashboard(supplierContext);
    expect(supplierDashboardBeforeNotice.queues['awards-received'].some((item) => item.awardId === recommendation.id)).toBe(false);

    await repository.approveRecommendation(recommendation.id, {
      selectedSupplier: recommendation.supplierOrg.name,
      awardAmount: Number(recommendation.amount),
      currency: recommendation.currency,
      reason: 'Best evaluated responsive bidder.',
      conditions: 'Submit delivery schedule and signatory authorization before contract signing.',
      note: 'Demo award approved.',
      signatureKeyphrase: DEMO_EVALUATION_AWARD_KEYPHRASE
    }, buyerContext);
    await repository.settleAwardGroup(recommendation.id, {
      note: 'Demo award notice sent.',
      payload: { source: 'demo-evaluation-award-test' },
      signatureKeyphrase: DEMO_EVALUATION_AWARD_KEYPHRASE
    }, buyerContext);

    const supplierDashboardAfterNotice = await repository.dashboard(supplierContext);
    const receivedAward = supplierDashboardAfterNotice.queues['awards-received'].find((item) => item.awardId === recommendation.id);
    expect(receivedAward?.noticeId).toBeTruthy();

    await repository.respondToNotice(receivedAward!.noticeId!, {
      action: AwardResponseAction.ACCEPT,
      note: 'Accepted for demo flow.',
      payload: { source: 'demo-evaluation-award-test' },
      signatureKeyphrase: DEMO_EVALUATION_AWARD_KEYPHRASE
    }, supplierContext);

    const accepted = await db.awardNotice.findUnique({ where: { id: receivedAward!.noticeId } });
    expect(accepted?.contractId).toBeTruthy();
  }, 60000);
});

describe('two-user demo evaluation award seed metadata', () => {
  it('uses deterministic references and credentials', () => {
    expect(DEMO_EVALUATION_AWARD_DATASET).toBe('demo-evaluation-award-two-user');
    expect(DEMO_EVALUATION_AWARD_TENDER_REF).toBe('PX-DEMO-EVAL-AWARD-2026-001');
    expect(DEMO_EVALUATION_AWARD_BUYER_EMAIL).toBe('demo@procurex.tz');
    expect(DEMO_EVALUATION_AWARD_WINNER_EMAIL).toBe('josefmmbaga@gmail.com');
    expect(DEMO_EVALUATION_AWARD_KEYPHRASE).toBe('DemoAward123!');
  });
});
