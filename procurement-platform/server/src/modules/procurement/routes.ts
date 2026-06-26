import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/public/welcome', controller.publicWelcome);
  router.get('/marketplace', controller.marketplace);
  router.post('/tenders', controller.createTender);
  router.patch('/tenders/:tenderId', controller.updateTender);
  router.get('/tenders/:tenderId', controller.getTenderDetail);
  router.post('/tenders/:tenderId/publish', controller.publishTender);
  router.post('/tenders/:tenderId/close', controller.closeTender);
  router.get('/planning', controller.planning);
  router.get('/planning/summary', controller.planningSummary);
  router.post('/planning/annual-plan', controller.saveAnnualPlan);
  router.get('/planning/plans/:planId', controller.getPlan);
  router.put('/planning/plans/:planId', controller.updatePlan);
  router.post('/planning/plans/:planId/lines', controller.createPlanLine);
  router.patch('/planning/lines/:lineId', controller.updatePlanLine);
  router.delete('/planning/lines/:lineId', controller.deletePlanLine);

  return router;
}
