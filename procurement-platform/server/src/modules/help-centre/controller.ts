import type { Request, RequestHandler } from 'express';
import { requestAuditContext } from '../shared/audit.js';
import { ModuleService } from './service.js';
import {
  categoryParamsSchema,
  faqListQuerySchema,
  faqParamsSchema,
  helpMessageSchema,
  moduleStatusQuerySchema,
  suggestionQuerySchema
} from './validators.js';

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
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

  categories: RequestHandler = (_req, res, next) => {
    try {
      res.json(this.service.categories());
    } catch (error) {
      next(error);
    }
  };

  faqs: RequestHandler = (req, res, next) => {
    try {
      const query = faqListQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid Help Centre FAQ query parameters.');
      res.json(this.service.listFaqs(query.data));
    } catch (error) {
      next(error);
    }
  };

  faq: RequestHandler = (req, res, next) => {
    try {
      const params = faqParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid Help Centre FAQ id.');
      res.json(this.service.getFaq(params.data.faqId));
    } catch (error) {
      next(error);
    }
  };

  popular: RequestHandler = (_req, res, next) => {
    try {
      res.json(this.service.popular());
    } catch (error) {
      next(error);
    }
  };

  category: RequestHandler = (req, res, next) => {
    try {
      const params = categoryParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid Help Centre category id.');
      res.json(this.service.byCategory(params.data.categoryId));
    } catch (error) {
      next(error);
    }
  };

  suggestions: RequestHandler = (req, res, next) => {
    try {
      const query = suggestionQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid Help Centre suggestion query parameters.');
      res.json(this.service.suggestions(query.data));
    } catch (error) {
      next(error);
    }
  };

  message: RequestHandler = async (req, res, next) => {
    try {
      const body = helpMessageSchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid Help Centre message payload.');
      res.json(await this.service.message(bearerToken(req), body.data, requestAuditContext(req)));
    } catch (error) {
      next(error);
    }
  };
}

