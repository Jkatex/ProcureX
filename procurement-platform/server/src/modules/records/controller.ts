import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema, recordsExportQuerySchema, recordsQuerySchema } from './validators.js';

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

  dashboard: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await this.service.dashboard());
    } catch (error) {
      next(error);
    }
  };

  records: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records query parameters.');
      res.json(await this.service.records(query.data));
    } catch (error) {
      next(error);
    }
  };

  charts: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records chart query parameters.');
      res.json(await this.service.charts(query.data));
    } catch (error) {
      next(error);
    }
  };

  insights: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records insight query parameters.');
      res.json(await this.service.insights(query.data));
    } catch (error) {
      next(error);
    }
  };

  exportCsv: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsExportQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records export query parameters.');
      const exportFile = await this.service.exportCsv(query.data);
      res.attachment(exportFile.filename).type('text/csv').send(exportFile.content);
    } catch (error) {
      next(error);
    }
  };

  exportPdf: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsExportQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid records export query parameters.');
      const exportFile = await this.service.exportPdf(query.data);
      res.attachment(exportFile.filename).type('application/pdf').send(exportFile.content);
    } catch (error) {
      next(error);
    }
  };
}

