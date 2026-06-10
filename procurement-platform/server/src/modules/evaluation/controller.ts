import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { moduleStatusQuerySchema, recordsQuerySchema, saveWorkspaceBodySchema, workspaceParamsSchema } from './validators.js';
import type { EvaluationRequestContext } from './types.js';

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
      if (!query.success) throw requestError('Invalid evaluation records query parameters.');
      res.json(await this.service.records(query.data));
    } catch (error) {
      next(error);
    }
  };

  drafts: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await this.service.drafts());
    } catch (error) {
      next(error);
    }
  };

  ready: RequestHandler = async (_req, res, next) => {
    try {
      res.json(await this.service.ready());
    } catch (error) {
      next(error);
    }
  };

  workspace: RequestHandler = async (req, res, next) => {
    try {
      const params = workspaceParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid evaluation workspace tender id.');
      res.json(await this.service.workspace(params.data.tenderId, requestContext(req)));
    } catch (error) {
      next(error);
    }
  };

  saveWorkspace: RequestHandler = async (req, res, next) => {
    try {
      const params = workspaceParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid evaluation workspace tender id.');
      const body = saveWorkspaceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid evaluation workspace payload.');
      res.json(await this.service.saveWorkspace(params.data.tenderId, body.data, requestContext(req)));
    } catch (error) {
      next(error);
    }
  };
}

function requestContext(req: Parameters<RequestHandler>[0]): EvaluationRequestContext | undefined {
  const userId = req.header('x-user-id') || undefined;
  const organizationId = req.header('x-organization-id') || undefined;
  if (!userId && !organizationId) return undefined;
  return { userId, organizationId };
}
