import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/status', controller.status);
  router.post('/contact', controller.publicContact);
  router.get('/tickets', controller.tickets);
  router.post('/tickets', controller.createTicket);
  router.get('/tickets/:id', controller.ticket);
  router.post('/tickets/:id/comments', controller.addComment);
  router.patch('/tickets/:id/status', controller.updateStatus);

  return router;
}
