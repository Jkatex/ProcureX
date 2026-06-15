import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);

  router.get('/recommendations', controller.listRecommendations);
  router.get('/recommendations/:id', controller.recommendation);
  router.post('/recommendations/:id/approve', controller.approveRecommendation);
  router.post('/recommendations/:id/return', controller.returnRecommendation);

  router.post('/notices/:id/respond', controller.respondToNotice);

  router.get('/contracts', controller.listContracts);
  router.get('/contracts/:id', controller.contract);
  router.post('/contracts/:id/versions', controller.createContractVersion);
  router.post('/contracts/:id/signatures', controller.createSignatureRequests);
  router.post('/contracts/:id/signatures/:signatureId/sign', controller.signContractSignature);
  router.post('/contracts/:id/milestones', controller.createMilestone);
  router.patch('/contracts/:id/milestones/:milestoneId', controller.updateMilestone);
  router.post('/contracts/:id/milestones/:milestoneId/evidence', controller.addMilestoneEvidence);
  router.patch('/contracts/:id/status', controller.updateContractStatus);

  return router;
}
