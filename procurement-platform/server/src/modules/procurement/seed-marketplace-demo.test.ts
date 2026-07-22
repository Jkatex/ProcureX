/* Exercises procurement behavior so regressions are caught close to the domain workflow they protect. */
import { BidStatus, EvaluationStatus, RecommendationStatus, TenderStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { MARKETPLACE_DEMO_PREFIX, seedMarketplaceDemo } from '../../../prisma/seed-marketplace-demo.js';

const runDbSeedSmoke = process.env.RUN_MARKETPLACE_DEMO_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('marketplace demo seed', () => {
  it('creates Huui-owned evaluation and awarding workflow tenders idempotently', async () => {
    const db = prisma as any;

    await seedMarketplaceDemo();
    await seedMarketplaceDemo();

    const huui = await db.user.findUnique({
      where: { email: 'huui@gmail.com' },
      include: { memberships: { include: { organization: true } } }
    });
    expect(huui).toBeTruthy();
    expect(huui?.memberships.some((membership: any) => membership.organization.name === 'Huui Demo Buyer Authority')).toBe(true);

    const tenders = await db.tender.findMany({
      where: {
        reference: {
          in: [`${MARKETPLACE_DEMO_PREFIX}-HUUI-EVALUATION-ICT-SUPPORT`, `${MARKETPLACE_DEMO_PREFIX}-HUUI-AWARDING-OFFICE-FITOUT`]
        }
      },
      include: {
        bids: true,
        evaluation: {
          include: {
            assignments: true,
            criteria: true,
            scores: true,
            recommendations: true
          }
        }
      },
      orderBy: { reference: 'asc' }
    });

    expect(tenders).toHaveLength(2);
    expect(tenders.every((tender: any) => tender.ownerUserId === huui?.id)).toBe(true);

    const evaluationTender = tenders.find((tender: any) => tender.reference.endsWith('HUUI-EVALUATION-ICT-SUPPORT'));
    expect(evaluationTender?.status).toBe(TenderStatus.EVALUATION);
    expect(evaluationTender?.bids).toHaveLength(2);
    expect(evaluationTender?.bids.every((bid: any) => bid.status === BidStatus.UNDER_EVALUATION)).toBe(true);
    expect(evaluationTender?.evaluation?.status).toBe(EvaluationStatus.IN_PROGRESS);
    expect(evaluationTender?.evaluation?.criteria).toHaveLength(2);
    expect(evaluationTender?.evaluation?.scores.length).toBeGreaterThan(0);
    expect(evaluationTender?.evaluation?.assignments.some((assignment: any) => assignment.userId === huui?.id)).toBe(true);

    const awardingTender = tenders.find((tender: any) => tender.reference.endsWith('HUUI-AWARDING-OFFICE-FITOUT'));
    expect(awardingTender?.status).toBe(TenderStatus.EVALUATION);
    expect(awardingTender?.bids).toHaveLength(2);
    expect(awardingTender?.evaluation?.status).toBe(EvaluationStatus.COMPLETED);
    expect(awardingTender?.evaluation?.recommendations).toHaveLength(1);
    expect(awardingTender?.evaluation?.recommendations[0]?.status).toBe(RecommendationStatus.RECOMMENDED);
  }, 60000);
});

describe('marketplace demo seed metadata', () => {
  it('uses the deterministic marketplace demo prefix', () => {
    expect(MARKETPLACE_DEMO_PREFIX).toBe('PX-MKT-DEMO');
  });
});
