import { Router } from 'express';
import { ModuleController } from './controller.js';

export function createModuleRouter() {
  const router = Router();
  const controller = new ModuleController();

  router.get('/', controller.status);
  router.get('/marketplace/analytics', controller.marketplaceAnalytics);
  router.get('/marketplace/recommended-tenders', controller.recommendedTenders);
  router.get('/tenders/:tenderId/supplier-recommendations', controller.supplierRecommendations);

  return router;
}

