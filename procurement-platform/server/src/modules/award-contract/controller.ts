import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  awardDecisionBodySchema,
  awardNoticeResponseBodySchema,
  awardRecommendationQuerySchema,
  contractMilestoneBodySchema,
  contractMilestoneEvidenceBodySchema,
  contractMilestonePatchBodySchema,
  contractQuerySchema,
  contractSignatureRequestBodySchema,
  contractSignatureSignBodySchema,
  contractStatusPatchBodySchema,
  contractVersionBodySchema,
  idParamsSchema,
  milestoneParamsSchema,
  moduleStatusQuerySchema,
  signatureParamsSchema
} from './validators.js';
import type { AwardContractRequestContext } from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function bearerToken(req: Request) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function headerFallbackContext(req: Request): Partial<AwardContractRequestContext> {
  return {
    userId: req.header('x-user-id') || undefined,
    organizationId: req.header('x-organization-id') || undefined
  };
}

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identityService = new IdentityService()) {}

  private async requireContext(req: Request): Promise<AwardContractRequestContext> {
    const session = await this.identityService.requireSession(bearerToken(req));
    const fallback = headerFallbackContext(req);
    return {
      userId: session.user.id || fallback.userId,
      organizationId: session.user.organizationId || fallback.organizationId,
      isAdmin: session.user.accountType === 'ADMIN'
    };
  }

  private async requirePermissionContext(req: Request, permission: Parameters<IdentityService['requirePermission']>[1]): Promise<AwardContractRequestContext> {
    const session = await this.identityService.requirePermission(bearerToken(req), permission);
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

  listRecommendations: RequestHandler = async (req, res, next) => {
    try {
      const query = awardRecommendationQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid award recommendation query parameters.');
      res.json(await this.service.listRecommendations(query.data, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  recommendation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      res.json(await this.service.recommendation(params.data.id, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  approveRecommendation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardDecisionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award approval payload.');
      res.json(await this.service.approveRecommendation(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  returnRecommendation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardDecisionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award return payload.');
      res.json(await this.service.returnRecommendation(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  respondToNotice: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award notice id.');
      const body = awardNoticeResponseBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award notice response payload.');
      res.json(await this.service.respondToNotice(params.data.id, body.data, await this.requirePermissionContext(req, 'award.respond')));
    } catch (error) {
      next(error);
    }
  };

  listContracts: RequestHandler = async (req, res, next) => {
    try {
      const query = contractQuerySchema.safeParse(req.query);
      if (!query.success) throw requestError('Invalid contract query parameters.');
      res.json(await this.service.listContracts(query.data, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  contract: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      res.json(await this.service.contract(params.data.id, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  createContractVersion: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractVersionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract version payload.');
      res.status(201).json(await this.service.createContractVersion(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createSignatureRequests: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractSignatureRequestBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract signature request payload.');
      res.status(201).json(await this.service.createSignatureRequests(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  signContractSignature: RequestHandler = async (req, res, next) => {
    try {
      const params = signatureParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract signature id.');
      const body = contractSignatureSignBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract signature payload.');
      res.json(await this.service.signContractSignature(params.data.id, params.data.signatureId, body.data, await this.requirePermissionContext(req, 'contract.sign')));
    } catch (error) {
      next(error);
    }
  };

  createMilestone: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractMilestoneBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract milestone payload.');
      res.status(201).json(await this.service.createMilestone(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  updateMilestone: RequestHandler = async (req, res, next) => {
    try {
      const params = milestoneParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract milestone id.');
      const body = contractMilestonePatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract milestone update payload.');
      res.json(await this.service.updateMilestone(params.data.id, params.data.milestoneId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  addMilestoneEvidence: RequestHandler = async (req, res, next) => {
    try {
      const params = milestoneParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract milestone id.');
      const body = contractMilestoneEvidenceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract milestone evidence payload.');
      res.status(201).json(await this.service.addMilestoneEvidence(params.data.id, params.data.milestoneId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  updateContractStatus: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractStatusPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract status payload.');
      res.json(await this.service.updateContractStatus(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };
}
