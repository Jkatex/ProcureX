import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/pages/:pageKey', controller.getPage);
  router.get('/legal/current', controller.currentLegalVersions);

  return router;
}
