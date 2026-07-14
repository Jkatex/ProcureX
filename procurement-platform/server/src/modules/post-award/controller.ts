import type { Request, RequestHandler } from 'express';
import { ModuleService as IdentityService } from '../identity/service.js';
import { ModuleService } from './service.js';
import {
  acceptanceBodySchema,
  closeoutBodySchema,
  contractDocumentUploadBodySchema,
  contractManagementPlanBodySchema,
  contractMilestoneEvidenceBodySchema,
  contractPaymentBodySchema,
  deliverableBodySchema,
  inspectionBodySchema,
  invoiceBodySchema,
  invoiceStatusPatchBodySchema,
  lifecycleItemBodySchema,
  variationBodySchema
} from '../award-contract/validators.js';
import { idParamsSchema, invoiceParamsSchema, milestoneParamsSchema, moduleStatusQuerySchema } from './validators.js';
import type { PostAwardRequestContext } from './types.js';

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

function headerFallbackContext(req: Request): Partial<PostAwardRequestContext> {
  return {
    userId: req.header('x-user-id') || undefined,
    organizationId: req.header('x-organization-id') || undefined
  };
}

export class ModuleController {
  constructor(private readonly service = new ModuleService(), private readonly identity = new IdentityService()) {}

  private async requireContext(req: Request): Promise<PostAwardRequestContext> {
    const session = await this.identity.requireSession(bearerToken(req));
    const fallback = headerFallbackContext(req);
    return {
      userId: session.user.id || fallback.userId,
      organizationId: session.user.organizationId || fallback.organizationId,
      isAdmin: session.user.accountType === 'ADMIN'
    };
  }

  private async requirePermissionContext(req: Request, permission: Parameters<IdentityService['requirePermission']>[1]): Promise<PostAwardRequestContext> {
    const session = await this.identity.requirePermission(bearerToken(req), permission);
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

  contracts: RequestHandler = async (req, res, next) => {
    try {
      res.json(await this.service.contracts(await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  workspace: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      res.json(await this.service.workspace(params.data.contractId, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  uploadDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractDocumentUploadBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid document payload.');
      res.status(201).json(await this.service.uploadDocument(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  upsertManagementPlan: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractManagementPlanBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid management plan payload.');
      res.json(await this.service.upsertManagementPlan(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createDeliverable: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = deliverableBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid deliverable payload.');
      res.status(201).json(await this.service.createDeliverable(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  addMilestoneEvidence: RequestHandler = async (req, res, next) => {
    try {
      const params = milestoneParamsSchema.safeParse(req.params);
      const body = contractMilestoneEvidenceBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid milestone evidence route.');
      if (!body.success) throw requestError('Invalid milestone evidence payload.');
      res.status(201).json(await this.service.addMilestoneEvidence(params.data.contractId, params.data.milestoneId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createInspection: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = inspectionBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid inspection payload.');
      res.status(201).json(await this.service.createInspection(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createAcceptance: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = acceptanceBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid acceptance payload.');
      res.status(201).json(await this.service.createAcceptance(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createInvoice: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = invoiceBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid invoice payload.');
      res.status(201).json(await this.service.createInvoice(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  updateInvoiceStatus: RequestHandler = async (req, res, next) => {
    try {
      const params = invoiceParamsSchema.safeParse(req.params);
      const body = invoiceStatusPatchBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid invoice route.');
      if (!body.success) throw requestError('Invalid invoice status payload.');
      res.json(await this.service.updateInvoiceStatus(params.data.contractId, params.data.invoiceId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPayment: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractPaymentBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid payment payload.');
      res.status(201).json(await this.service.createPayment(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createIssue: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = lifecycleItemBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid issue payload.');
      res.status(201).json(await this.service.createIssue(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createVariation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = variationBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid variation payload.');
      res.status(201).json(await this.service.createVariation(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertCloseout: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = closeoutBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid close-out payload.');
      res.json(await this.service.upsertCloseout(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };
}
