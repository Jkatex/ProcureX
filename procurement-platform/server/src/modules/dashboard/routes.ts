/* Registers dashboard HTTP routes and keeps transport concerns separate from controller behavior. */
import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/status', controller.status);
  router.get('/workspace', controller.workspace);

  return router;
}
