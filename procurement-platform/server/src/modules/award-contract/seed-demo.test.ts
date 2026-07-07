import { describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { AWARD_CONTRACT_DEMO_PREFIX, seedAwardContractDemo } from '../../../prisma/seed-award-contract-demo.js';

const runDbSeedSmoke = process.env.RUN_AWARD_CONTRACT_DEMO_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('award-contract demo seed', () => {
  it('is idempotent and creates coverage for queues, detail collections, and compliance records', async () => {
    const db = prisma as any;
    await seedAwardContractDemo();
    await seedAwardContractDemo();

    const contracts = await db.contract.findMany({
      where: { reference: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } },
      include: {
        clauses: true,
        negotiations: true,
        signatures: true,
        managementPlan: true,
        mobilizationItems: true,
        milestones: true,
        inspections: true,
        invoices: true,
        payments: true,
        risks: true,
        variations: true,
        disputes: true,
        terminations: true,
        closeout: true,
        supplierPerformanceRecords: true
      }
    });

    expect(contracts).toHaveLength(12);
    expect(new Set(contracts.map((contract: any) => contract.status)).size).toBeGreaterThanOrEqual(12);

    const rich = contracts.find((contract: any) => contract.reference === `${AWARD_CONTRACT_DEMO_PREFIX}-CONTRACT-ACTIVE-GOODS`);
    expect(rich).toBeTruthy();
    expect(rich?.clauses.length).toBeGreaterThan(0);
    expect(rich?.negotiations.length).toBeGreaterThan(0);
    expect(rich?.signatures.length).toBeGreaterThan(0);
    expect(rich?.managementPlan).toBeTruthy();
    expect(rich?.mobilizationItems.length).toBeGreaterThan(0);
    expect(rich?.milestones.length).toBeGreaterThan(0);
    expect(rich?.inspections.length).toBeGreaterThan(0);
    await expect(db.goodsInspection.count({ where: { contractId: rich?.id } })).resolves.toBeGreaterThan(0);
    expect(rich?.invoices.length).toBeGreaterThanOrEqual(7);
    expect(rich?.payments.length).toBeGreaterThan(0);
    expect(rich?.risks.length).toBeGreaterThan(0);
    expect(rich?.variations.length).toBeGreaterThan(0);
    expect(rich?.disputes.length).toBeGreaterThan(0);
    expect(rich?.terminations.length).toBeGreaterThan(0);
    expect(rich?.closeout).toBeTruthy();
    expect(rich?.supplierPerformanceRecords.length).toBeGreaterThan(0);

    await expect(db.user.count({ where: { email: 'award-demo@procurex.tz' } })).resolves.toBe(1);
    await expect(
      db.user.count({
        where: {
          email: {
            in: [
              'award-admin@procurex.tz',
              'award-buyer@procurex.tz',
              'contract-manager@procurex.tz',
              'legal-review@procurex.tz',
              'finance-review@procurex.tz',
              'technical-review@procurex.tz',
              'award-supplier@procurex.tz',
              'declined-supplier@procurex.tz',
              'risky-supplier@procurex.tz',
              'terminated-supplier@procurex.tz',
              'closed-supplier@procurex.tz'
            ]
          }
        }
      })
    ).resolves.toBe(0);

    await expect(db.urgentAction.count({ where: { payload: { path: ['demoDataset'], equals: 'award-contract-full' } } })).resolves.toBeGreaterThan(0);
    await expect(db.collusionAlert.count({ where: { payload: { path: ['demoDataset'], equals: 'award-contract-full' } } })).resolves.toBeGreaterThan(0);
    await expect(db.complianceReview.count({ where: { payload: { path: ['demoDataset'], equals: 'award-contract-full' } } })).resolves.toBeGreaterThan(0);
    await expect(db.violationCase.count({ where: { payload: { path: ['demoDataset'], equals: 'award-contract-full' } } })).resolves.toBeGreaterThan(0);
  }, 60000);
});

describe('award-contract demo seed metadata', () => {
  it('uses the deterministic ProcureX award-contract demo prefix', () => {
    expect(AWARD_CONTRACT_DEMO_PREFIX).toBe('PX-DEMO-AC');
  });
});
