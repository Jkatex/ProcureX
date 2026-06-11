import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { dashboardQuerySchema, moduleStatusQuerySchema } from './validators.js';

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

  workspace: RequestHandler = async (req, res, next) => {
    try {
      const query = dashboardQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid dashboard query parameters.');
      res.json(await this.service.workspaceDashboard(query.data));
    } catch (error) {
      next(error);
    }
  };
}
