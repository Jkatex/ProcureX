import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/status', controller.status);
  router.get('/messages', controller.messages);
  router.post('/messages', controller.compose);
  router.get('/messages/:messageId', controller.message);
  router.patch('/messages/:messageId', controller.patch);
  router.post('/messages/:messageId/read', controller.markRead);
  router.post('/messages/:messageId/archive', controller.archive);
  router.post('/messages/:messageId/replies', controller.reply);
  router.get('/recipients', controller.recipients);
  router.get('/tenders', controller.tenderLinks);

  return router;
}
