import { AccountType } from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

const keepUserEmails = ['demo@procurex.tz', 'admin@procurex.tz'];
const keepOrganizationNames = ['Kilimanjaro Supplies Limited', 'ProcureX Platform'];

async function main() {
  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    await tx.integrationEvent.deleteMany();
    await tx.integrationSyncRun.deleteMany();
    await tx.externalSystem.deleteMany();

    await tx.marketSnapshot.deleteMany();
    await tx.priceBenchmark.deleteMany();
    await tx.supplierMatchSignal.deleteMany();
    await tx.riskSignal.deleteMany();

    await tx.communicationAttachment.deleteMany();
    await tx.communicationItem.deleteMany();
    await tx.recordEntry.deleteMany();

    await tx.invoice.deleteMany();
    await tx.purchaseOrder.deleteMany();
    await tx.contractVersion.deleteMany();
    await tx.contract.deleteMany();

    await tx.approvalStep.deleteMany();
    await tx.awardRecommendation.deleteMany();
    await tx.evaluationScore.deleteMany();
    await tx.evaluationCriterion.deleteMany();
    await tx.workflowAssignment.deleteMany();
    await tx.evaluationWorkspace.deleteMany();

    await tx.bidReceipt.deleteMany();
    await tx.bidResponse.deleteMany();
    await tx.bidDocument.deleteMany();
    await tx.bidVersion.deleteMany();
    await tx.bid.deleteMany();

    await tx.tenderDocument.deleteMany();
    await tx.tenderCommercialItem.deleteMany();
    await tx.tenderMilestone.deleteMany();
    await tx.tenderRequirement.deleteMany();
    await tx.tenderCategory.deleteMany({ where: { tenderId: { not: null } } });
    await tx.tender.deleteMany();

    await tx.complianceCase.deleteMany();
    await tx.adminAction.deleteMany();
    await tx.auditEvent.deleteMany();

    await tx.documentObject.deleteMany({
      where: {
        verificationDocuments: { none: {} }
      }
    });

    await tx.session.deleteMany();
    await tx.identityChallenge.deleteMany();

    await tx.user.deleteMany({
      where: {
        email: { notIn: keepUserEmails }
      }
    });

    await tx.organization.deleteMany({
      where: {
        name: { notIn: keepOrganizationNames }
      }
    });
  }, prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('ProcureX demo/admin-only cleanup completed.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
