import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { moduleStatusQuerySchema, recordsQuerySchema, saveWorkspaceBodySchema, workspaceParamsSchema } from './validators.js';
import type { EvaluationRequestContext } from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identityService = new IdentityService()) {}

  private async optionalContext(req: Parameters<RequestHandler>[0]): Promise<EvaluationRequestContext | undefined> {
    const token = bearerToken(req);
    if (token) {
      const session = await this.identityService.requireSession(token);
      const fallback = headerFallbackContext(req);
      return {
        userId: session.user.id || fallback.userId,
        organizationId: session.user.organizationId || fallback.organizationId,
        isAdmin: session.user.accountType === 'ADMIN'
      };
    }
    const fallback = headerFallbackContext(req);
    if (!fallback.userId && !fallback.organizationId) return undefined;
    return fallback;
  }

  private async permissionContext(req: Parameters<RequestHandler>[0]): Promise<EvaluationRequestContext> {
    const session = await this.identityService.requirePermission(bearerToken(req), 'evaluation.manage');
    const fallback = headerFallbackContext(req);
    return {
      userId: session.user.id || fallback.userId,
      organizationId: session.user.organizationId || fallback.organizationId,
      isAdmin: session.user.accountType === 'ADMIN'
    };
  }

  status: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.status());
    } catch (error) {
      next(error);
    }
  };

  dashboard: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.dashboard(await this.optionalContext(req)));
    } catch (error) {
      next(error);
    }
  };

  records: RequestHandler = async (req, res, next) => {
    try {
      const query = recordsQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid evaluation records query parameters.');
      res.json(await this.service.records(query.data, await this.optionalContext(req)));
    } catch (error) {
      next(error);
    }
  };

  drafts: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.drafts(await this.optionalContext(req)));
    } catch (error) {
      next(error);
    }
  };

  ready: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.ready(await this.optionalContext(req)));
    } catch (error) {
      next(error);
    }
  };

  workspace: RequestHandler = async (req, res, next) => {
    try {
      const params = workspaceParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid evaluation workspace tender id.');
      res.json(await this.service.workspace(params.data.tenderId, await this.optionalContext(req)));
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
      res.json(await this.service.saveWorkspace(params.data.tenderId, body.data, await this.permissionContext(req)));
    } catch (error) {
      next(error);
    }
  };
}

function headerFallbackContext(req: Parameters<RequestHandler>[0]): EvaluationRequestContext {
  return {
    userId: req.header('x-user-id') || undefined,
    organizationId: req.header('x-organization-id') || undefined
  };
}

function bearerToken(req: Parameters<RequestHandler>[0]) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}
