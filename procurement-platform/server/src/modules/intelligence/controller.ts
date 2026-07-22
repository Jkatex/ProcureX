/* Translates intelligence HTTP requests into service calls while normalizing responses and errors for Express. */
import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema, tenderParamsSchema } from './validators.js';
import { requestError } from '../shared/apiErrors.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService()) {}

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  recommendedTenders: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.recommendedTenders(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  marketplaceAnalytics: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.marketplaceAnalytics(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  supplierRecommendations: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid tender id.');
      res.json(await this.service.supplierRecommendations(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };
}

