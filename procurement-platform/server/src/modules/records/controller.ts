import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema, recordParamsSchema, recordsExportQuerySchema, recordsQuerySchema } from './validators.js';
import type { RecordsRequestContext } from './types.js';
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

  dashboard: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await this.service.dashboard(requestContext(_req)));
    } catch (error) {
      next(error);
    }
  };

  records: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records query parameters.');
      res.json(await this.service.records(query.data, requestContext(req)));
    } catch (error) {
      next(error);
    }
  };

  charts: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records chart query parameters.');
      res.json(await this.service.charts(query.data, requestContext(req)));
    } catch (error) {
      next(error);
    }
  };

  insights: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records insight query parameters.');
      res.json(await this.service.insights(query.data, requestContext(req)));
    } catch (error) {
      next(error);
    }
  };

  detail: RequestHandler = async (req, res, next) => {
    try {
      const params = recordParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid record identifier.');
      const detail = await this.service.detail(params.data.id, requestContext(req));
      if (!detail) throw requestError('Record was not found.', 404);
      res.json(detail);
    } catch (error) {
      next(error);
    }
  };

  exportCsv: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsExportQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records export query parameters.');
      const exportFile = await this.service.exportCsv(query.data, requestContext(req));
      res.attachment(exportFile.filename).type('text/csv').send(exportFile.content);
    } catch (error) {
      next(error);
    }
  };

  exportPdf: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsExportQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records export query parameters.');
      const exportFile = await this.service.exportPdf(query.data, requestContext(req));
      res.attachment(exportFile.filename).type('application/pdf').send(exportFile.content);
    } catch (error) {
      next(error);
    }
  };
}

function requestContext(req: Request): RecordsRequestContext {
  return {
    token: bearerToken(req),
    userId: req.header('x-user-id') || undefined,
    organizationId: req.header('x-organization-id') || undefined,
    isAdmin: req.header('x-account-type') === 'ADMIN'
  };
}

