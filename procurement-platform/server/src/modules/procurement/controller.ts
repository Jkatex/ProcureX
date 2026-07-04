import type { RequestHandler, Response } from 'express';
import type { ZodError } from 'zod';
import { MARKETPLACE_UNAVAILABLE_CODE, MARKETPLACE_UNAVAILABLE_MESSAGE, ModuleService } from './service.js';
import {
  createTenderBodySchema,
  moduleStatusQuerySchema,
  marketplaceQuerySchema,
  patchPlanLineBodySchema,
  planLineBodySchema,
  planLineParamsSchema,
  planParamsSchema,
  planningQuerySchema,
  publicWelcomeQuerySchema,
  publishTenderBodySchema,
  saveAnnualPlanBodySchema,
  tenderParamsSchema,
  updateTenderBodySchema,
  updatePlanBodySchema
} from './validators.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function validationResponse(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }))
  });
}

function isMarketplaceUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; status?: unknown; message?: unknown };
  return candidate.code === MARKETPLACE_UNAVAILABLE_CODE && candidate.status === 503;
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

  publicWelcome: RequestHandler = async (req, res, next) => {
    try {
      publicWelcomeQuerySchema.parse(req.query);
      res.json(await this.service.publicWelcome());
    } catch (error) {
      next(error);
    }
  };

  marketplace: RequestHandler = async (req, res, next) => {
    try {
      const query = marketplaceQuerySchema.safeParse(req.query);
      if (!query.success) return validationResponse(res, query.error);
      res.json(await this.service.marketplace(bearerToken(req), query.data));
    } catch (error) {
      if (isMarketplaceUnavailableError(error)) {
        res.status(503).json({
          success: false,
          message: MARKETPLACE_UNAVAILABLE_MESSAGE
        });
        return;
      }
      next(error);
    }
  };

  createTender: RequestHandler = async (req, res, next) => {
    try {
      const body = createTenderBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      res.status(201).json(await this.service.createTender(bearerToken(req), body.data));
    } catch (error) {
      next(error);
    }
  };

  updateTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = updateTenderBodySchema.safeParse(req.body);
      if (!body.success) return validationResponse(res, body.error);
      const tender = await this.service.updateTender(params.data.tenderId, bearerToken(req), body.data);
      if (!tender) throw requestError('Tender was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  getTenderDetail: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const tender = await this.service.getTenderDetail(params.data.tenderId, bearerToken(req));
      if (!tender) throw requestError('Tender was not found.', 404);
      res.json(tender);
    } catch (error) {
      next(error);
    }
  };

  savedTenders: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.savedTenders(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  saveTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.saveTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  unsaveTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.unsaveTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  publishTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      const body = publishTenderBodySchema.safeParse(req.body ?? {});
      if (!body.success) return validationResponse(res, body.error);
      res.json(await this.service.publishTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  closeTender: RequestHandler = async (req, res, next) => {
    try {
      const params = tenderParamsSchema.safeParse(req.params);
      if (!params.success) return validationResponse(res, params.error);
      res.json(await this.service.closeTender(params.data.tenderId, bearerToken(req)));
    } catch (error) {
      next(error);
    }
  };

  planning: RequestHandler = async (req, res, next) => {
    try {
      const query = planningQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid procurement planning query parameters.');
      res.json(await this.service.planning(query.data));
    } catch (error) {
      next(error);
    }
  };

  planningSummary: RequestHandler = async (req, res, next) => {
    try {
      const query = planningQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid procurement planning summary query parameters.');
      res.json(await this.service.planningSummary(query.data));
    } catch (error) {
      next(error);
    }
  };

  saveAnnualPlan: RequestHandler = async (req, res, next) => {
    try {
      const body = saveAnnualPlanBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid annual procurement plan payload.');
      res.status(201).json(await this.service.saveAnnualPlan(body.data));
    } catch (error) {
      next(error);
    }
  };

  getPlan: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const plan = await this.service.getPlan(params.data.planId);
      if (!plan) throw requestError('Procurement plan was not found.', 404);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  };

  updatePlan: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const body = updatePlanBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan update payload.');
      const plan = await this.service.updatePlan(params.data.planId, body.data);
      if (!plan) throw requestError('Procurement plan was not found.', 404);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  };

  createPlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan id.');
      const body = planLineBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan line payload.');
      const line = await this.service.createPlanLine(params.data.planId, body.data);
      if (!line) throw requestError('Procurement plan was not found.', 404);
      res.status(201).json(line);
    } catch (error) {
      next(error);
    }
  };

  updatePlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planLineParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan line id.');
      const body = patchPlanLineBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid procurement plan line update payload.');
      const line = await this.service.updatePlanLine(params.data.lineId, body.data);
      if (!line) throw requestError('Procurement plan line was not found.', 404);
      res.json(line);
    } catch (error) {
      next(error);
    }
  };

  deletePlanLine: RequestHandler = async (req, res, next) => {
    try {
      const params = planLineParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid procurement plan line id.');
      const line = await this.service.deletePlanLine(params.data.lineId);
      if (!line) throw requestError('Procurement plan line was not found.', 404);
      res.json(line);
    } catch (error) {
      next(error);
    }
  };
}

function bearerToken(req: Parameters<RequestHandler>[0]) {
  const header = req.header('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return undefined;
  return header.slice(7).trim();
}
