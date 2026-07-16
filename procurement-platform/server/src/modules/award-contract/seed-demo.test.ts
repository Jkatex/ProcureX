import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prisma } from '../../db/prisma.js';
import { AWARD_CONTRACT_DEMO_PREFIX, POST_AWARD_DEMO_CONTRACT_REFERENCE, seedAwardContractDemo } from '../../../prisma/seed-award-contract-demo.js';
import { ModuleRepository } from './repository.js';
import { ModuleService as PostAwardService } from '../post-award/service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const runDbSeedSmoke = process.env.RUN_AWARD_CONTRACT_DEMO_SEED_TEST === 'true';
const describeDb = runDbSeedSmoke ? describe : describe.skip;

describeDb('award-contract demo seed', () => {
  it('is idempotent and creates coverage for queues, detail collections, and compliance records', async () => {
    const db = prisma as any;
    await seedAwardContractDemo();
    await seedAwardContractDemo();

    const contracts = await db.contract.findMany({
      where: {
        OR: [
          { reference: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } },
          { reference: POST_AWARD_DEMO_CONTRACT_REFERENCE }
        ]
      },
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

    expect(contracts.length).toBeGreaterThanOrEqual(12);
    expect(new Set(contracts.map((contract: any) => contract.status)).size).toBeGreaterThanOrEqual(12);

    const rich = contracts.find((contract: any) => contract.reference === POST_AWARD_DEMO_CONTRACT_REFERENCE);
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

    const groups = await db.awardGroup.findMany({
      where: { reference: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } },
      include: {
        winners: true,
        clauses: true,
        negotiations: true,
        bidPacks: true
      }
    });
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.some((group: any) => group.reference === `${AWARD_CONTRACT_DEMO_PREFIX}-GROUP-NEGOTIATION-WATER` && group.winners.length >= 2 && group.clauses.length >= 3 && group.negotiations.length >= 2)).toBe(true);
    expect(groups.some((group: any) => group.reference === `${AWARD_CONTRACT_DEMO_PREFIX}-GROUP-SETTLED-CLINIC` && group.winners.length >= 2 && group.bidPacks.length >= 1 && group.winners.every((winner: any) => winner.noticeId && winner.contractId))).toBe(true);
    await expect(db.bidDocument.count({ where: { document: { objectKey: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } } } })).resolves.toBeGreaterThan(0);

    const demoUser = await db.user.findUnique({
      where: { email: 'demo@procurex.tz' },
      include: { memberships: { where: { status: 'ACTIVE', isDefault: true } } }
    });
    expect(demoUser).toBeTruthy();
    const demoOrgId = demoUser?.memberships[0]?.organizationId;
    expect(demoOrgId).toBeTruthy();
    if (!demoOrgId) throw new Error('Demo user default organization was not seeded.');
    const demoDashboard = await new ModuleRepository(db).dashboard({ userId: demoUser!.id, organizationId: demoOrgId, isAdmin: false });
    expect(demoDashboard.queues['awarding-in-progress'].length).toBeGreaterThan(0);
    expect(demoDashboard.queues['awards-received'].length).toBeGreaterThan(0);
    expect(demoDashboard.queues['contracts-in-progress'].length).toBeGreaterThan(0);
    expect(demoDashboard.queues['contract-signing'].length).toBeGreaterThan(0);
    expect(demoDashboard.queues).not.toHaveProperty('active-contracts');
    expect(demoDashboard.queues).not.toHaveProperty('closed-contracts');
    const postAwardContext = { userId: demoUser!.id, organizationId: demoOrgId, isAdmin: false };
    const postAwardService = new PostAwardService();
    const postAwardRows = await postAwardService.contracts(postAwardContext);
    const postAwardContract = postAwardRows.find((row) => row.reference === POST_AWARD_DEMO_CONTRACT_REFERENCE);
    expect(postAwardContract).toMatchObject({
      reference: POST_AWARD_DEMO_CONTRACT_REFERENCE,
      status: 'ACTIVE',
      viewerRole: 'SUPPLIER'
    });
    const postAwardWorkspace = await postAwardService.workspace(postAwardContract!.id, postAwardContext);
    expect(postAwardWorkspace.procurementType).toBe('GOODS');
    expect(postAwardWorkspace.workflowSections.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.buyerTasks.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.supplierTasks.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.detail?.milestones.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.detail?.inspections.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.detail?.invoices.length).toBeGreaterThanOrEqual(7);
    expect(postAwardWorkspace.detail?.risks.length).toBeGreaterThan(0);
    expect(postAwardWorkspace.detail?.variations.length).toBeGreaterThan(0);
    await expect(db.user.count({ where: { email: 'award-demo@procurex.tz' } })).resolves.toBe(0);
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
  it('is not invoked by the default Prisma seed', () => {
    const defaultSeedSource = readFileSync(resolve(__dirname, '../../../prisma/seed.ts'), 'utf8');

    expect(defaultSeedSource).not.toContain('seedAwardContractDemo');
  });

  it('uses the deterministic ProcureX award-contract demo prefix', () => {
    expect(AWARD_CONTRACT_DEMO_PREFIX).toBe('PX-DEMO-AC');
  });
});
