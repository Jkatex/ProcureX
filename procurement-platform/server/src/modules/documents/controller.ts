import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { documentParamsSchema, moduleStatusQuerySchema } from './validators.js';
import type { DocumentRequestContext } from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function bearerToken(header = '') {
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identityService = new IdentityService()) {}

  private async requireContext(authorization = ''): Promise<DocumentRequestContext> {
    const session = await this.identityService.requireSession(bearerToken(authorization));
    return {
      userId: session.user.id,
      organizationId: session.user.organizationId,
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

  content: RequestHandler = async (req, res, next) => {
    try {
      const params = documentParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid document id.');
      const document = await this.service.content(params.data.id, await this.requireContext(req.header('authorization') ?? ''));
      if (req.query.download === 'true') res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
      res.type(document.contentType).send(document.body);
    } catch (error) {
      next(error);
    }
  };
}
