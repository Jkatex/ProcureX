import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/public/welcome', controller.publicWelcome);
  router.get('/master-data', controller.masterData);
  router.get('/master-data/:group', controller.masterDataGroup);
  router.get('/design/taxonomy', controller.taxonomy);
  router.post('/design/standardize-category', controller.standardizeCategory);
  router.post('/design/scan-language', controller.scanLanguage);
  router.get('/design/form-schemas', controller.designFormSchemas);
  router.get('/design/form-schemas/:type', controller.designFormSchema);
  router.get('/marketplace', controller.marketplace);
  router.get('/admin/tender-review', controller.listTenderReviews);
  router.get('/admin/tender-review/:tenderId', controller.getTenderReview);
  router.post('/admin/tender-review/:tenderId/pass', controller.passTenderReview);
  router.post('/admin/tender-review/:tenderId/fail', controller.failTenderReview);
  router.post('/tenders', controller.createTender);
  router.patch('/tenders/:tenderId', controller.updateTender);
  router.delete('/tenders/:tenderId/draft', controller.deleteTenderDraft);
  router.patch('/tenders/:tenderId/buyer-notice', controller.updateTenderBuyerNotice);
  router.get('/saved-tenders', controller.savedTenders);
  router.get('/tenders/:tenderId/documents/:documentId/open', controller.openTenderDocument);
  router.get('/tenders/:tenderId/documents/:documentId/download', controller.downloadTenderDocument);
  router.post('/tenders/:tenderId/documents/:documentId/download', controller.recordTenderDocumentDownload);
  router.get('/tenders/:tenderId/amendments', controller.listTenderAmendments);
  router.post('/tenders/:tenderId/amendments', controller.createTenderAmendment);
  router.patch('/tenders/:tenderId/amendments/:amendmentId', controller.updateTenderAmendment);
  router.post('/tenders/:tenderId/amendments/:amendmentId/publish', controller.publishTenderAmendment);
  router.post('/tenders/:tenderId/amendments/:amendmentId/cancel', controller.cancelTenderAmendment);
  router.post('/tenders/:tenderId/evaluation/open', controller.openEvaluation);
  router.get('/tenders/:tenderId', controller.getTenderDetail);
  router.post('/tenders/:tenderId/save', controller.saveTender);
  router.delete('/tenders/:tenderId/save', controller.unsaveTender);
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
