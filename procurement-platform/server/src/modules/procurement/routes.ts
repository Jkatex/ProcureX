import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createApiMutationRateLimitOptions, createAuthRateLimitOptions } from '../../security/rateLimit.js';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();
  const procurementMutationLimit = rateLimit(createApiMutationRateLimitOptions('procurement-mutation'));
  const procurementContactLimit = rateLimit(createAuthRateLimitOptions('procurement-contact-verification'));

  router.get('/', controller.status);
  router.get('/public/welcome', controller.publicWelcome);
  router.get('/master-data', controller.masterData);
  router.get('/master-data/:group', controller.masterDataGroup);
  router.get('/design/taxonomy', controller.taxonomy);
  router.post('/design/standardize-category', procurementMutationLimit, controller.standardizeCategory);
  router.post('/design/scan-language', procurementMutationLimit, controller.scanLanguage);
  router.get('/design/form-schemas', controller.designFormSchemas);
  router.get('/design/form-schemas/:type', controller.designFormSchema);
  router.get('/marketplace', controller.marketplace);
  router.get('/admin/tender-review', controller.listTenderReviews);
  router.get('/admin/tender-review/:tenderId', controller.getTenderReview);
  router.post('/admin/tender-review/:tenderId/pass', procurementMutationLimit, controller.passTenderReview);
  router.post('/admin/tender-review/:tenderId/fail', procurementMutationLimit, controller.failTenderReview);
  router.post('/contact-verifications', procurementContactLimit, controller.startContactVerification);
  router.post('/contact-verifications/verify', procurementContactLimit, controller.verifyContactVerification);
  router.post('/tenders', procurementMutationLimit, controller.createTender);
  router.patch('/tenders/:tenderId', procurementMutationLimit, controller.updateTender);
  router.delete('/tenders/:tenderId/draft', procurementMutationLimit, controller.deleteTenderDraft);
  router.patch('/tenders/:tenderId/buyer-notice', procurementMutationLimit, controller.updateTenderBuyerNotice);
  router.get('/saved-tenders', controller.savedTenders);
  router.get('/tenders/:tenderId/buyer-logo', controller.tenderBuyerLogo);
  router.get('/tenders/:tenderId/documents/:documentId/open', controller.openTenderDocument);
  router.get('/tenders/:tenderId/documents/:documentId/download', controller.downloadTenderDocument);
  router.post('/tenders/:tenderId/documents/:documentId/download', procurementMutationLimit, controller.recordTenderDocumentDownload);
  router.get('/tenders/:tenderId/amendments', controller.listTenderAmendments);
  router.post('/tenders/:tenderId/amendments', procurementMutationLimit, controller.createTenderAmendment);
  router.patch('/tenders/:tenderId/amendments/:amendmentId', procurementMutationLimit, controller.updateTenderAmendment);
  router.post('/tenders/:tenderId/amendments/:amendmentId/publish', procurementMutationLimit, controller.publishTenderAmendment);
  router.post('/tenders/:tenderId/amendments/:amendmentId/cancel', procurementMutationLimit, controller.cancelTenderAmendment);
  router.post('/tenders/:tenderId/evaluation/open', procurementMutationLimit, controller.openEvaluation);
  router.get('/tenders/:tenderId', controller.getTenderDetail);
  router.post('/tenders/:tenderId/save', procurementMutationLimit, controller.saveTender);
  router.delete('/tenders/:tenderId/save', procurementMutationLimit, controller.unsaveTender);
  router.post('/tenders/:tenderId/publish', procurementMutationLimit, controller.publishTender);
  router.post('/tenders/:tenderId/close', procurementMutationLimit, controller.closeTender);
  router.get('/planning', controller.planning);
  router.get('/planning/summary', controller.planningSummary);
  router.post('/planning/annual-plan', procurementMutationLimit, controller.saveAnnualPlan);
  router.get('/planning/plans/:planId', controller.getPlan);
  router.put('/planning/plans/:planId', procurementMutationLimit, controller.updatePlan);
  router.post('/planning/plans/:planId/lines', procurementMutationLimit, controller.createPlanLine);
  router.patch('/planning/lines/:lineId', procurementMutationLimit, controller.updatePlanLine);
  router.delete('/planning/lines/:lineId', procurementMutationLimit, controller.deletePlanLine);

  return router;
}
