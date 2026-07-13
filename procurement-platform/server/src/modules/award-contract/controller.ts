import type { Request, RequestHandler } from 'express';
import { ModuleService } from './service.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  awardDecisionBodySchema,
  awardApprovalRouteBodySchema,
  awardApprovalStepBodySchema,
  awardNotificationBodySchema,
  awardNoticeResponseBodySchema,
  awardSettlementBodySchema,
  awardTieBreakerBodySchema,
  acceptanceBodySchema,
  budgetCommitmentBodySchema,
  closeoutBodySchema,
  clauseBodySchema,
  contractPaymentBodySchema,
  contractManagementPlanBodySchema,
  awardRecommendationQuerySchema,
  deliverableBodySchema,
  deliveryFeasibilityBodySchema,
  goodsInspectionBodySchema,
  invoiceBodySchema,
  inspectionBodySchema,
  invoiceParamsSchema,
  invoiceStatusPatchBodySchema,
  contractMilestoneBodySchema,
  contractMilestoneEvidenceBodySchema,
  contractMilestonePatchBodySchema,
  contractQuerySchema,
  contractSignatureRequestBodySchema,
  contractSignatureSignBodySchema,
  contractStatusPatchBodySchema,
  contractVersionBodySchema,
  idParamsSchema,
  lifecycleItemBodySchema,
  lifecycleItemParamsSchema,
  lifecycleItemPatchBodySchema,
  milestoneParamsSchema,
  moduleStatusQuerySchema,
  negotiationBodySchema,
  paymentApprovalBodySchema,
  paymentConfirmationBodySchema,
  paymentScheduleBodySchema,
  performanceScoreBodySchema,
  replacementProcurementBodySchema,
  requiredDocumentBodySchema,
  riskBodySchema,
  riskForecastBodySchema,
  signatureParamsSchema,
  standstillPeriodBodySchema,
  supplierPerformanceBodySchema,
  supplierRiskProfileBodySchema,
  terminationBodySchema,
  terminationEvidenceBodySchema,
  terminationNoticeBodySchema,
  terminationParamsSchema,
  terminationPatchBodySchema,
  terminationSettlementBodySchema,
  terminationValuationBodySchema,
  variationBodySchema,
  warrantyBodySchema,
  workflowApprovalBodySchema,
  threeWayMatchBodySchema
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

  dashboard: RequestHandler = async (req, res, next) => {
    try {
      moduleStatusQuerySchema.parse(req.query);
      res.json(await this.service.dashboard(await this.requireContext(req)));
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

  evaluationReport: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const report = await this.service.evaluationReport(params.data.id, await this.requireContext(req));
      if (req.query.download === 'true') res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
      res.type(report.contentType).send(report.body);
    } catch (error) {
      next(error);
    }
  };

  saveAwardDecisionDraft: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardDecisionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award draft payload.');
      res.json(await this.service.saveAwardDecisionDraft(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
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

  upsertAwardApprovalRoute: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardApprovalRouteBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award approval route payload.');
      res.json(await this.service.upsertAwardApprovalRoute(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertAwardApprovalStep: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardApprovalStepBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award approval step payload.');
      res.json(await this.service.upsertAwardApprovalStep(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  createAwardTieBreaker: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardTieBreakerBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award tie-breaker payload.');
      res.status(201).json(await this.service.createAwardTieBreaker(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertDeliveryFeasibility: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = deliveryFeasibilityBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid delivery feasibility payload.');
      res.json(await this.service.upsertDeliveryFeasibility(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertStandstillPeriod: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = standstillPeriodBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid standstill payload.');
      res.json(await this.service.upsertStandstillPeriod(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  createAwardNotification: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardNotificationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award notification payload.');
      res.status(201).json(await this.service.createAwardNotification(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  createBudgetCommitmentForRecommendation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = budgetCommitmentBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid budget commitment payload.');
      res.status(201).json(await this.service.createBudgetCommitmentForRecommendation(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertAwardClause: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = clauseBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award clause payload.');
      res.json(await this.service.upsertAwardClause(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  createAwardNegotiation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = negotiationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award negotiation payload.');
      res.status(201).json(await this.service.createAwardNegotiation(params.data.id, body.data, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  generateAwardBidPack: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      res.status(201).json(await this.service.generateAwardBidPack(params.data.id, await this.requirePermissionContext(req, 'award.manage')));
    } catch (error) {
      next(error);
    }
  };

  settleAwardGroup: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid award recommendation id.');
      const body = awardSettlementBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid award settlement payload.');
      res.json(await this.service.settleAwardGroup(params.data.id, body.data, await this.requirePermissionContext(req, 'award.manage')));
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

  upsertManagementPlan: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractManagementPlanBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract management plan payload.');
      res.json(await this.service.upsertManagementPlan(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  updateMobilizationItem: RequestHandler = async (req, res, next) => {
    try {
      const params = lifecycleItemParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid mobilization item id.');
      const body = lifecycleItemPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid mobilization item payload.');
      res.json(await this.service.updateMobilizationItem(params.data.id, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createInspection: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = inspectionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid inspection payload.');
      res.status(201).json(await this.service.createInspection(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createGoodsInspection: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = goodsInspectionBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid goods inspection payload.');
      res.status(201).json(await this.service.createGoodsInspection(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createInvoice: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = invoiceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid invoice payload.');
      res.status(201).json(await this.service.createInvoice(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  upsertThreeWayMatch: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = threeWayMatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid three-way match payload.');
      res.json(await this.service.upsertThreeWayMatch(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPaymentApproval: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = paymentApprovalBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid payment approval payload.');
      res.status(201).json(await this.service.createPaymentApproval(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPaymentConfirmation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = paymentConfirmationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid payment confirmation payload.');
      res.status(201).json(await this.service.createPaymentConfirmation(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPerformanceScore: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = performanceScoreBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid performance score payload.');
      res.status(201).json(await this.service.createPerformanceScore(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createRiskForecast: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = riskForecastBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid risk forecast payload.');
      res.status(201).json(await this.service.createRiskForecast(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertSupplierRiskProfile: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = supplierRiskProfileBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid supplier risk profile payload.');
      res.json(await this.service.upsertSupplierRiskProfile(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createRisk: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = riskBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid risk payload.');
      res.status(201).json(await this.service.createRisk(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  updateRisk: RequestHandler = async (req, res, next) => {
    try {
      const params = lifecycleItemParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid risk id.');
      const body = lifecycleItemPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid risk payload.');
      res.json(await this.service.updateRisk(params.data.id, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createVariation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = variationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid variation payload.');
      res.status(201).json(await this.service.createVariation(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  updateVariation: RequestHandler = async (req, res, next) => {
    try {
      const params = lifecycleItemParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid variation id.');
      const body = lifecycleItemPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid variation payload.');
      res.json(await this.service.updateVariation(params.data.id, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createIssue: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = lifecycleItemBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid issue payload.');
      res.status(201).json(await this.service.createIssue(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  updateIssue: RequestHandler = async (req, res, next) => {
    try {
      const params = lifecycleItemParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid issue id.');
      const body = lifecycleItemPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid issue payload.');
      res.json(await this.service.updateIssue(params.data.id, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createDispute: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = lifecycleItemBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid dispute payload.');
      res.status(201).json(await this.service.createDispute(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  updateDispute: RequestHandler = async (req, res, next) => {
    try {
      const params = lifecycleItemParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid dispute id.');
      const body = lifecycleItemPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid dispute payload.');
      res.json(await this.service.updateDispute(params.data.id, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createTermination: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = terminationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination payload.');
      res.status(201).json(await this.service.createTermination(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  updateTermination: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = terminationPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination update payload.');
      res.json(await this.service.updateTermination(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  addTerminationNotice: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = terminationNoticeBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination notice payload.');
      res.status(201).json(await this.service.addTerminationNotice(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  addTerminationEvidence: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = terminationEvidenceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination evidence payload.');
      res.status(201).json(await this.service.addTerminationEvidence(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  upsertTerminationValuation: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = terminationValuationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination valuation payload.');
      res.json(await this.service.upsertTerminationValuation(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertTerminationSettlement: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = terminationSettlementBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid termination settlement payload.');
      res.json(await this.service.upsertTerminationSettlement(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertReplacementProcurement: RequestHandler = async (req, res, next) => {
    try {
      const params = terminationParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid termination id.');
      const body = replacementProcurementBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid replacement procurement payload.');
      res.json(await this.service.upsertReplacementProcurement(params.data.id, params.data.terminationId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertCloseout: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = closeoutBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid close-out payload.');
      res.json(await this.service.upsertCloseout(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertSupplierPerformance: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = supplierPerformanceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid supplier performance payload.');
      res.json(await this.service.upsertSupplierPerformance(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  updateInvoiceStatus: RequestHandler = async (req, res, next) => {
    try {
      const params = invoiceParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid invoice id.');
      const body = invoiceStatusPatchBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid invoice status payload.');
      res.json(await this.service.updateInvoiceStatus(params.data.id, params.data.invoiceId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertClause: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = clauseBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract clause payload.');
      res.json(await this.service.upsertClause(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createNegotiation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = negotiationBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid negotiation payload.');
      res.status(201).json(await this.service.createNegotiation(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createDeliverable: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = deliverableBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid deliverable payload.');
      res.status(201).json(await this.service.createDeliverable(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createAcceptance: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = acceptanceBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid acceptance payload.');
      res.status(201).json(await this.service.createAcceptance(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPaymentSchedule: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = paymentScheduleBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid payment schedule payload.');
      res.status(201).json(await this.service.createPaymentSchedule(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createPayment: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = contractPaymentBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid contract payment payload.');
      res.status(201).json(await this.service.createPayment(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  upsertWarranty: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = warrantyBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid warranty payload.');
      res.json(await this.service.upsertWarranty(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  upsertRequiredDocument: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = requiredDocumentBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid required document payload.');
      res.json(await this.service.upsertRequiredDocument(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  upsertWorkflowApproval: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      const body = workflowApprovalBodySchema.safeParse(req.body);
      if (!body.success) throw requestError('Invalid workflow approval payload.');
      res.json(await this.service.upsertWorkflowApproval(params.data.id, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };
}
