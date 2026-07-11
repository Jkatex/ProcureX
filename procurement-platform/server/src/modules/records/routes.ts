import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/status', controller.status);
  router.get('/dashboard', controller.dashboard);
  router.get('/charts', controller.charts);
  router.get('/insights', controller.insights);
  router.get('/export/csv', controller.exportCsv);
  router.get('/export/pdf', controller.exportPdf);
  router.get('/:id', controller.detail);
  router.get('/', controller.records);

  return router;
}

