import type { RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { dashboardQuerySchema, moduleStatusQuerySchema } from './validators.js';
import { requestError } from '../shared/apiErrors.js';

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identityService = new IdentityService()) {}

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
      const header = req.header('authorization') ?? '';
      const [scheme, token] = header.split(/\s+/);
      const session = await this.identityService.requireSession(scheme?.toLowerCase() === 'bearer' ? token : undefined);
      const requestedOrganizationId = query.data.organizationId;
      if (requestedOrganizationId && requestedOrganizationId !== session.user.organizationId && session.user.accountType !== 'ADMIN') {
        throw requestError('You can only view dashboard data for your organization.', 403);
      }
      res.json(await this.service.workspaceDashboard({
        ...query.data,
        organizationId: requestedOrganizationId || session.user.organizationId || ''
      }));
    } catch (error) {
      next(error);
    }
  };
}
