import { Router } from 'express';
import { createHelpCentreRateLimit } from './rateLimit.js';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();
  const messageLimit = createHelpCentreRateLimit('message');

  router.get('/', controller.status);
  router.get('/categories', controller.categories);
  router.get('/faqs', controller.faqs);
  router.get('/faqs/:faqId', controller.faq);
  router.get('/popular', controller.popular);
  router.get('/category/:categoryId', controller.category);
  router.get('/suggestions', controller.suggestions);
  router.post('/message', messageLimit, controller.message);

  return router;
}

