import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/contracts', controller.contracts);
  router.get('/contracts/:contractId/actions', controller.actions);
  router.get('/contracts/:contractId/workspace', controller.workspace);
  router.post('/contracts/:contractId/documents', controller.uploadDocument);
  router.put('/contracts/:contractId/management-plan', controller.upsertManagementPlan);
  router.post('/contracts/:contractId/activation/items/:itemId/submit', controller.submitActivationItem);
  router.post('/contracts/:contractId/activation/items/:itemId/review', controller.reviewActivationItem);
  router.post('/contracts/:contractId/activate', controller.activateContract);
  router.post('/contracts/:contractId/obligations', controller.createObligation);
  router.post('/contracts/:contractId/evidence-requirements', controller.createEvidenceRequirement);
  router.post('/contracts/:contractId/goods/delivery-schedules', controller.createDeliverySchedule);
  router.post('/contracts/:contractId/goods/dispatch-notices', controller.createDispatchNotice);
  router.post('/contracts/:contractId/goods/receipts', controller.createGoodsReceipt);
  router.post('/contracts/:contractId/works/site-handovers', controller.createSiteHandover);
  router.post('/contracts/:contractId/works/progress-reports', controller.createWorksProgressReport);
  router.post('/contracts/:contractId/works/boq-measurements', controller.createBoqMeasurement);
  router.post('/contracts/:contractId/works/interim-payment-certificates', controller.createInterimPaymentCertificate);
  router.post('/contracts/:contractId/works/defects', controller.createContractDefect);
  router.post('/contracts/:contractId/services/levels', controller.createServiceLevel);
  router.post('/contracts/:contractId/services/periods', controller.createServicePeriod);
  router.post('/contracts/:contractId/services/reports', controller.createServiceReport);
  router.post('/contracts/:contractId/services/credits', controller.createServiceCredit);
  router.post('/contracts/:contractId/consultancy/deliverables', controller.createConsultancyDeliverable);
  router.post('/contracts/:contractId/consultancy/versions', controller.createDeliverableVersion);
  router.post('/contracts/:contractId/consultancy/reviews', controller.createDeliverableReview);
  router.post('/contracts/:contractId/claims', controller.createClaim);
  router.post('/contracts/:contractId/claim-responses', controller.createClaimResponse);
  router.post('/contracts/:contractId/extension-requests', controller.createExtensionRequest);
  router.post('/contracts/:contractId/amendments', controller.createAmendment);
  router.post('/contracts/:contractId/deliverables', controller.createDeliverable);
  router.post('/contracts/:contractId/milestones/:milestoneId/evidence', controller.addMilestoneEvidence);
  router.post('/contracts/:contractId/inspections', controller.createInspection);
  router.post('/contracts/:contractId/acceptances', controller.createAcceptance);
  router.post('/contracts/:contractId/invoices', controller.createInvoice);
  router.patch('/contracts/:contractId/invoices/:invoiceId/status', controller.updateInvoiceStatus);
  router.post('/contracts/:contractId/payments', controller.createPayment);
  router.post('/contracts/:contractId/issues', controller.createIssue);
  router.post('/contracts/:contractId/variations', controller.createVariation);
  router.put('/contracts/:contractId/closeout', controller.upsertCloseout);

  return router;
}
