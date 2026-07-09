import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/my', controller.listMine);
  router.get('/tenders/:tenderId/draft', controller.getTenderDraft);
  router.post('/tenders/:tenderId/draft', controller.saveTenderDraft);
  router.get('/:bidId', controller.getBid);
  router.patch('/:bidId', controller.patchBid);
  router.post('/:bidId/documents', controller.addDocuments);
  router.delete('/:bidId/documents/:documentId', controller.deleteDocument);
  router.post('/:bidId/samples', controller.createSample);
  router.get('/:bidId/samples', controller.listSamples);
  router.patch('/:bidId/samples/:sampleId', controller.patchSample);
  router.post('/:bidId/submit', controller.submit);
  router.post('/:bidId/withdraw', controller.withdraw);

  return router;
}
