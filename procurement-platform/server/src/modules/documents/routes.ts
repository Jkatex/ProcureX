/* Registers documents HTTP routes and keeps transport concerns separate from controller behavior. */
import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.post('/uploads', controller.upload);
  router.get('/official/templates', controller.officialTemplates);
  router.post('/official/generate', controller.generateOfficialDocument);
  router.get('/official/:id/open', controller.openOfficialDocument);
  router.get('/official/:id/download', controller.downloadOfficialDocument);
  router.get('/official/:id/versions', controller.officialDocumentVersions);
  router.post('/official/:id/approve', controller.approveOfficialDocument);
  router.post('/official/:id/sign', controller.signOfficialDocument);
  router.post('/:id/approve', controller.approveDocument);
  router.post('/:id/sign', controller.signDocument);
  router.get('/:id/content', controller.content);

  return router;
}
