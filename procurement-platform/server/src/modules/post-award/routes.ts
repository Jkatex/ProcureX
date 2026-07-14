import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/contracts', controller.contracts);
  router.get('/contracts/:contractId/workspace', controller.workspace);
  router.post('/contracts/:contractId/documents', controller.uploadDocument);
  router.put('/contracts/:contractId/management-plan', controller.upsertManagementPlan);
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
