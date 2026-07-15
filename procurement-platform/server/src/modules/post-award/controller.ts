import type { Request, RequestHandler } from 'express';
import { ModuleService as IdentityService } from '../identity/service.js';
import { ModuleService } from './service.js';
import {
  acceptanceBodySchema,
  amendmentBodySchema,
  boqMeasurementBodySchema,
  boqMeasurementReviewBodySchema,
  claimBodySchema,
  claimResponseBodySchema,
  closeoutBodySchema,
  consultancyDeliverableBodySchema,
  consultancyDeliverableReviewBodySchema,
  consultancyFinalReportBodySchema,
  consultancyFinalReportReviewBodySchema,
  contractActivateBodySchema,
  contractActivationItemReviewBodySchema,
  contractActivationItemSubmitBodySchema,
  contractDefectActionBodySchema,
  contractDefectBodySchema,
  contractDocumentUploadBodySchema,
  contractEvidenceRequirementBodySchema,
  contractManagementPlanBodySchema,
  contractManagementPlanDraftBodySchema,
  contractMeetingActionBodySchema,
  contractMeetingActionPatchBodySchema,
  contractMeetingBodySchema,
  contractMilestoneEvidenceBodySchema,
  contractNoticeActionBodySchema,
  contractNoticeBodySchema,
  contractObligationBodySchema,
  contractPaymentBodySchema,
  contractPenaltyBodySchema,
  contractSecurityActionBodySchema,
  contractSecurityBodySchema,
  contractChangeRequestBodySchema,
  deliverableReviewBodySchema,
  deliverableReviewPaymentEligibilityBodySchema,
  deliverableVersionBodySchema,
  deliveryScheduleBodySchema,
  deliverableBodySchema,
  dispatchNoticeBodySchema,
  extensionRequestBodySchema,
  goodsReceiptBodySchema,
  goodsInspectionBodySchema,
  inspectionBodySchema,
  interimPaymentCertificateBodySchema,
  interimPaymentCertificateCertifyBodySchema,
  invoiceBodySchema,
  invoiceStatusPatchBodySchema,
  lifecycleItemBodySchema,
  nonConformanceBodySchema,
  paymentApprovalBodySchema,
  paymentConfirmationBodySchema,
  requiredDocumentBodySchema,
  serviceCreditBodySchema,
  serviceCreditReviewBodySchema,
  serviceIncidentActionBodySchema,
  serviceIncidentBodySchema,
  serviceLevelBodySchema,
  servicePeriodBodySchema,
  serviceReportBodySchema,
  serviceReportReviewBodySchema,
  siteHandoverBodySchema,
  supplierPerformanceBodySchema,
  terminationBodySchema,
  threeWayMatchBodySchema,
  variationBodySchema,
  warrantyBodySchema,
  worksCompletionCertificateBodySchema,
  worksProgressReviewBodySchema,
  worksProgressReportBodySchema
} from '../award-contract/validators.js';
import { activationItemParamsSchema, closeoutStepParamsSchema, controlWorkflowActionBodySchema, financeWorkflowActionBodySchema, idParamsSchema, invoiceParamsSchema, milestoneParamsSchema, moduleStatusQuerySchema, recordParamsSchema } from './validators.js';
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

  private workspaceMutation(
    method: keyof ModuleService,
    bodySchema: { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false } },
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = idParamsSchema.safeParse(req.params);
        const body = bodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract id.');
        if (!body.success) throw requestError(invalidMessage);
        const action = this.service[method] as unknown as (contractId: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(201).json(await action.call(this.service, params.data.contractId, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  private workspaceRecordMutation(
    method: keyof ModuleService,
    bodySchema: { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false } },
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = recordParamsSchema.safeParse(req.params);
        const body = bodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract or record id.');
        if (!body.success) throw requestError(invalidMessage);
        const action = this.service[method] as unknown as (contractId: string, recordId: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(200).json(await action.call(this.service, params.data.contractId, params.data.recordId, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  private controlRecordMutation(
    method: keyof ModuleService,
    action: string,
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = recordParamsSchema.safeParse(req.params);
        const body = controlWorkflowActionBodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract or record id.');
        if (!body.success) throw requestError(invalidMessage);
        const handler = this.service[method] as unknown as (contractId: string, recordId: string, action: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(200).json(await handler.call(this.service, params.data.contractId, params.data.recordId, action, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  private financeInvoiceMutation(
    action: 'verify' | 'return' | 'reject' | 'correct',
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = invoiceParamsSchema.safeParse(req.params);
        const body = financeWorkflowActionBodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid invoice route.');
        if (!body.success) throw requestError(invalidMessage);
        const context = await this.requirePermissionContext(req, permission);
        res.status(200).json(action === 'correct'
          ? await this.service.correctInvoiceFinance(params.data.contractId, params.data.invoiceId, body.data, context)
          : await this.service.verifyInvoiceFinance(params.data.contractId, params.data.invoiceId, action, body.data, context));
      } catch (error) {
        next(error);
      }
    };
  }

  private financeRecordMutation(
    method: keyof ModuleService,
    action: string,
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = recordParamsSchema.safeParse(req.params);
        const body = financeWorkflowActionBodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract or record id.');
        if (!body.success) throw requestError(invalidMessage);
        const handler = this.service[method] as unknown as (contractId: string, recordId: string, action: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(200).json(await handler.call(this.service, params.data.contractId, params.data.recordId, action, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  private financeMutation(
    method: keyof ModuleService,
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = idParamsSchema.safeParse(req.params);
        const body = financeWorkflowActionBodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract id.');
        if (!body.success) throw requestError(invalidMessage);
        const action = this.service[method] as unknown as (contractId: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(201).json(await action.call(this.service, params.data.contractId, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  private operationalRecordMutation(
    method: keyof ModuleService,
    action: string,
    bodySchema: { safeParse: (value: unknown) => { success: true; data: unknown } | { success: false } },
    permission: Parameters<IdentityService['requirePermission']>[1],
    invalidMessage: string
  ): RequestHandler {
    return async (req, res, next) => {
      try {
        const params = recordParamsSchema.safeParse(req.params);
        const body = bodySchema.safeParse(req.body);
        if (!params.success) throw requestError('Invalid contract or record id.');
        if (!body.success) throw requestError(invalidMessage);
        const handler = this.service[method] as unknown as (contractId: string, recordId: string, action: string, input: unknown, context: PostAwardRequestContext) => Promise<unknown>;
        res.status(200).json(await handler.call(this.service, params.data.contractId, params.data.recordId, action, body.data, await this.requirePermissionContext(req, permission)));
      } catch (error) {
        next(error);
      }
    };
  }

  createDeliverySchedule = this.workspaceMutation('createDeliverySchedule', deliveryScheduleBodySchema, 'contract.manage', 'Invalid delivery schedule payload.');
  createDispatchNotice = this.workspaceMutation('createDispatchNotice', dispatchNoticeBodySchema, 'contract.track', 'Invalid dispatch notice payload.');
  createGoodsReceipt = this.workspaceMutation('createGoodsReceipt', goodsReceiptBodySchema, 'contract.manage', 'Invalid goods receipt payload.');
  createGoodsInspection = this.workspaceMutation('createGoodsInspection', goodsInspectionBodySchema, 'contract.manage', 'Invalid goods inspection payload.');
  createSiteHandover = this.workspaceMutation('createSiteHandover', siteHandoverBodySchema, 'contract.manage', 'Invalid site handover payload.');
  createWorksProgressReport = this.workspaceMutation('createWorksProgressReport', worksProgressReportBodySchema, 'contract.track', 'Invalid works progress report payload.');
  reviewWorksProgressReport = this.workspaceRecordMutation('reviewWorksProgressReport', worksProgressReviewBodySchema, 'contract.manage', 'Invalid works progress review payload.');
  createBoqMeasurement = this.workspaceMutation('createBoqMeasurement', boqMeasurementBodySchema, 'contract.manage', 'Invalid BOQ measurement payload.');
  reviewBoqMeasurement = this.workspaceRecordMutation('reviewBoqMeasurement', boqMeasurementReviewBodySchema, 'contract.manage', 'Invalid BOQ measurement review payload.');
  createInterimPaymentCertificate = this.workspaceMutation('createInterimPaymentCertificate', interimPaymentCertificateBodySchema, 'contract.manage', 'Invalid interim payment certificate payload.');
  certifyInterimPaymentCertificate = this.workspaceRecordMutation('certifyInterimPaymentCertificate', interimPaymentCertificateCertifyBodySchema, 'contract.manage', 'Invalid interim payment certificate certification payload.');
  createWorksCompletionCertificate = this.workspaceMutation('createWorksCompletionCertificate', worksCompletionCertificateBodySchema, 'contract.manage', 'Invalid Works completion certificate payload.');
  createContractDefect = this.workspaceMutation('createContractDefect', contractDefectBodySchema, 'contract.manage', 'Invalid defect payload.');
  respondToContractDefect = this.workspaceRecordMutation('respondToContractDefect', contractDefectActionBodySchema, 'contract.track', 'Invalid defect response payload.');
  verifyContractDefect = this.workspaceRecordMutation('verifyContractDefect', contractDefectActionBodySchema, 'contract.manage', 'Invalid defect verification payload.');
  closeContractDefect = this.workspaceRecordMutation('closeContractDefect', contractDefectActionBodySchema, 'contract.manage', 'Invalid defect closeout payload.');
  createServiceLevel = this.workspaceMutation('createServiceLevel', serviceLevelBodySchema, 'contract.manage', 'Invalid service level payload.');
  createServicePeriod = this.workspaceMutation('createServicePeriod', servicePeriodBodySchema, 'contract.manage', 'Invalid service period payload.');
  createServiceReport = this.workspaceMutation('createServiceReport', serviceReportBodySchema, 'contract.track', 'Invalid service report payload.');
  reviewServiceReport = this.workspaceRecordMutation('reviewServiceReport', serviceReportReviewBodySchema, 'contract.manage', 'Invalid service report review payload.');
  createServiceCredit = this.workspaceMutation('createServiceCredit', serviceCreditBodySchema, 'contract.manage', 'Invalid service credit payload.');
  reviewServiceCredit = this.workspaceRecordMutation('reviewServiceCredit', serviceCreditReviewBodySchema, 'contract.manage', 'Invalid service credit review payload.');
  createServiceIncident = this.workspaceMutation('createServiceIncident', serviceIncidentBodySchema, 'contract.manage', 'Invalid service incident payload.');
  respondToServiceIncident = this.workspaceRecordMutation('respondToServiceIncident', serviceIncidentActionBodySchema, 'contract.track', 'Invalid service incident response payload.');
  verifyServiceIncident = this.workspaceRecordMutation('verifyServiceIncident', serviceIncidentActionBodySchema, 'contract.manage', 'Invalid service incident verification payload.');
  closeServiceIncident = this.workspaceRecordMutation('closeServiceIncident', serviceIncidentActionBodySchema, 'contract.manage', 'Invalid service incident closeout payload.');
  createConsultancyDeliverable = this.workspaceMutation('createConsultancyDeliverable', consultancyDeliverableBodySchema, 'contract.manage', 'Invalid consultancy deliverable payload.');
  reviewConsultancyDeliverable = this.workspaceRecordMutation('reviewConsultancyDeliverable', consultancyDeliverableReviewBodySchema, 'contract.manage', 'Invalid consultancy deliverable review payload.');
  createDeliverableVersion = this.workspaceMutation('createDeliverableVersion', deliverableVersionBodySchema, 'contract.track', 'Invalid deliverable version payload.');
  reviewDeliverableVersion = this.workspaceRecordMutation('reviewDeliverableVersion', deliverableReviewBodySchema, 'contract.manage', 'Invalid deliverable version review payload.');
  createDeliverableReview = this.workspaceMutation('createDeliverableReview', deliverableReviewBodySchema, 'contract.manage', 'Invalid deliverable review payload.');
  confirmDeliverableReviewPaymentEligibility = this.workspaceRecordMutation('confirmDeliverableReviewPaymentEligibility', deliverableReviewPaymentEligibilityBodySchema, 'contract.manage', 'Invalid deliverable payment eligibility payload.');
  upsertConsultancyFinalReport = this.workspaceMutation('upsertConsultancyFinalReport', consultancyFinalReportBodySchema, 'contract.track', 'Invalid consultancy final report payload.');
  reviewConsultancyFinalReport = this.workspaceRecordMutation('reviewConsultancyFinalReport', consultancyFinalReportReviewBodySchema, 'contract.manage', 'Invalid consultancy final report review payload.');
  createClaim = this.workspaceMutation('createClaim', claimBodySchema, 'contract.track', 'Invalid claim payload.');
  createClaimResponse = this.workspaceMutation('createClaimResponse', claimResponseBodySchema, 'contract.track', 'Invalid claim response payload.');
  createExtensionRequest = this.workspaceMutation('createExtensionRequest', extensionRequestBodySchema, 'contract.track', 'Invalid extension request payload.');
  createAmendment = this.workspaceMutation('createAmendment', amendmentBodySchema, 'contract.manage', 'Invalid amendment payload.');
  createNonConformance = this.workspaceMutation('createNonConformance', nonConformanceBodySchema, 'contract.manage', 'Invalid non-conformance payload.');
  createContractSecurity = this.workspaceMutation('createContractSecurity', contractSecurityBodySchema, 'contract.manage', 'Invalid security payload.');
  reviewContractSecurity = this.operationalRecordMutation('controlContractSecurity', 'review', contractSecurityActionBodySchema, 'contract.manage', 'Invalid security review payload.');
  extendContractSecurity = this.operationalRecordMutation('controlContractSecurity', 'extend', contractSecurityActionBodySchema, 'contract.manage', 'Invalid security extension payload.');
  releaseContractSecurity = this.operationalRecordMutation('controlContractSecurity', 'release', contractSecurityActionBodySchema, 'contract.manage', 'Invalid security release payload.');
  claimContractSecurity = this.operationalRecordMutation('controlContractSecurity', 'claim', contractSecurityActionBodySchema, 'contract.manage', 'Invalid security claim payload.');
  waiveContractSecurity = this.operationalRecordMutation('controlContractSecurity', 'waive', contractSecurityActionBodySchema, 'contract.manage', 'Invalid security waiver payload.');
  createContractPenalty = this.workspaceMutation('createContractPenalty', contractPenaltyBodySchema, 'contract.manage', 'Invalid penalty payload.');
  createContractChangeRequest = this.workspaceMutation('createContractChangeRequest', contractChangeRequestBodySchema, 'contract.manage', 'Invalid change request payload.');
  upsertThreeWayMatch = this.workspaceMutation('upsertThreeWayMatch', threeWayMatchBodySchema, 'contract.manage', 'Invalid three-way match payload.');
  createPaymentApproval = this.workspaceMutation('createPaymentApproval', paymentApprovalBodySchema, 'contract.manage', 'Invalid payment approval payload.');
  verifyInvoiceFinance = this.financeInvoiceMutation('verify', 'contract.manage', 'Invalid invoice verification payload.');
  returnInvoiceFinance = this.financeInvoiceMutation('return', 'contract.manage', 'Invalid invoice return payload.');
  rejectInvoiceFinance = this.financeInvoiceMutation('reject', 'contract.manage', 'Invalid invoice rejection payload.');
  correctInvoiceFinance = this.financeInvoiceMutation('correct', 'contract.track', 'Invalid invoice correction payload.');
  createPaymentRecommendation = this.financeMutation('createPaymentRecommendation', 'contract.manage', 'Invalid payment recommendation payload.');
  reviewPaymentApproval = this.financeRecordMutation('reviewPaymentApproval', 'review', 'contract.manage', 'Invalid payment approval review payload.');
  approvePaymentApproval = this.financeRecordMutation('reviewPaymentApproval', 'approve', 'contract.manage', 'Invalid payment approval approval payload.');
  rejectPaymentApproval = this.financeRecordMutation('reviewPaymentApproval', 'reject', 'contract.manage', 'Invalid payment approval rejection payload.');
  initiatePayment = this.financeRecordMutation('controlPayment', 'initiate', 'contract.manage', 'Invalid payment initiation payload.');
  completePayment = this.financeRecordMutation('controlPayment', 'complete', 'contract.manage', 'Invalid payment completion payload.');
  createPaymentConfirmation = this.workspaceMutation('createPaymentConfirmation', paymentConfirmationBodySchema, 'contract.track', 'Invalid payment confirmation payload.');
  createFinanceDeduction = this.financeMutation('createFinanceDeduction', 'contract.manage', 'Invalid finance deduction payload.');
  createFinanceRetention = this.financeMutation('createFinanceRetention', 'contract.manage', 'Invalid retention payload.');
  createFinanceAdvanceRecovery = this.financeMutation('createFinanceAdvanceRecovery', 'contract.manage', 'Invalid advance recovery payload.');
  createFinanceLiquidatedDamages = this.financeMutation('createFinanceLiquidatedDamages', 'contract.manage', 'Invalid liquidated damages payload.');
  upsertWarranty = this.workspaceMutation('upsertWarranty', warrantyBodySchema, 'contract.manage', 'Invalid warranty payload.');
  respondToWarranty = this.operationalRecordMutation('controlWarranty', 'respond', controlWorkflowActionBodySchema, 'contract.track', 'Invalid warranty response payload.');
  verifyWarranty = this.operationalRecordMutation('controlWarranty', 'verify', controlWorkflowActionBodySchema, 'contract.manage', 'Invalid warranty verification payload.');
  closeWarranty = this.operationalRecordMutation('controlWarranty', 'close', controlWorkflowActionBodySchema, 'contract.manage', 'Invalid warranty closeout payload.');
  createContractNotice = this.workspaceMutation('createContractNotice', contractNoticeBodySchema, 'contract.track', 'Invalid notice payload.');
  acknowledgeContractNotice = this.operationalRecordMutation('controlContractNotice', 'acknowledge', contractNoticeActionBodySchema, 'contract.track', 'Invalid notice acknowledgement payload.');
  respondToContractNotice = this.operationalRecordMutation('controlContractNotice', 'respond', contractNoticeActionBodySchema, 'contract.track', 'Invalid notice response payload.');
  closeContractNotice = this.operationalRecordMutation('controlContractNotice', 'close', contractNoticeActionBodySchema, 'contract.manage', 'Invalid notice closeout payload.');
  createContractMeeting = this.workspaceMutation('createContractMeeting', contractMeetingBodySchema, 'contract.manage', 'Invalid meeting payload.');
  createContractMeetingAction = this.workspaceRecordMutation('createContractMeetingAction', contractMeetingActionBodySchema, 'contract.manage', 'Invalid meeting action payload.');
  completeContractMeetingAction = this.operationalRecordMutation('controlContractMeetingAction', 'complete', contractMeetingActionPatchBodySchema, 'contract.track', 'Invalid meeting action completion payload.');
  verifyContractMeetingAction = this.operationalRecordMutation('controlContractMeetingAction', 'verify', contractMeetingActionPatchBodySchema, 'contract.manage', 'Invalid meeting action verification payload.');
  closeContractMeetingAction = this.operationalRecordMutation('controlContractMeetingAction', 'close', contractMeetingActionPatchBodySchema, 'contract.manage', 'Invalid meeting action closeout payload.');
  upsertRequiredDocument = this.workspaceMutation('upsertRequiredDocument', requiredDocumentBodySchema, 'contract.track', 'Invalid required document payload.');
  upsertSupplierPerformance = this.workspaceMutation('upsertSupplierPerformance', supplierPerformanceBodySchema, 'contract.manage', 'Invalid supplier performance payload.');

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

  actions: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      res.json(await this.service.actions(params.data.contractId, await this.requireContext(req)));
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

  generateManagementPlanDraft: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractManagementPlanDraftBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid management plan draft payload.');
      res.json(await this.service.generateManagementPlanDraft(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  recalculateUrgentActions: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      res.json(await this.service.recalculateUrgentActions(params.data.contractId, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  submitActivationItem: RequestHandler = async (req, res, next) => {
    try {
      const params = activationItemParamsSchema.safeParse(req.params);
      const body = contractActivationItemSubmitBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid activation item route.');
      if (!body.success) throw requestError('Invalid activation item payload.');
      res.status(201).json(await this.service.submitActivationItem(params.data.contractId, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  reviewActivationItem: RequestHandler = async (req, res, next) => {
    try {
      const params = activationItemParamsSchema.safeParse(req.params);
      const body = contractActivationItemReviewBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid activation item route.');
      if (!body.success) throw requestError('Invalid activation review payload.');
      res.json(await this.service.reviewActivationItem(params.data.contractId, params.data.itemId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  activateContract: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractActivateBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid activation payload.');
      res.json(await this.service.activateContract(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createObligation: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractObligationBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid obligation payload.');
      res.status(201).json(await this.service.createObligation(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };

  createEvidenceRequirement: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = contractEvidenceRequirementBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid evidence requirement payload.');
      res.status(201).json(await this.service.createEvidenceRequirement(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
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

  createDispute: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      const body = lifecycleItemBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid contract id.');
      if (!body.success) throw requestError('Invalid dispute payload.');
      res.status(201).json(await this.service.createDispute(params.data.contractId, body.data, await this.requirePermissionContext(req, 'contract.track')));
    } catch (error) {
      next(error);
    }
  };

  createTermination = this.workspaceMutation('createTermination', terminationBodySchema, 'contract.manage', 'Invalid termination payload.');

  reviewChangeRequest = this.controlRecordMutation('controlChangeRequest', 'review', 'contract.manage', 'Invalid change request review payload.');
  respondToChangeRequest = this.controlRecordMutation('controlChangeRequest', 'respond', 'contract.track', 'Invalid change request response payload.');
  approveChangeRequest = this.controlRecordMutation('controlChangeRequest', 'approve', 'contract.manage', 'Invalid change request approval payload.');
  rejectChangeRequest = this.controlRecordMutation('controlChangeRequest', 'reject', 'contract.manage', 'Invalid change request rejection payload.');
  reviewVariation = this.controlRecordMutation('controlVariation', 'review', 'contract.manage', 'Invalid variation review payload.');
  approveVariation = this.controlRecordMutation('controlVariation', 'approve', 'contract.manage', 'Invalid variation approval payload.');
  rejectVariation = this.controlRecordMutation('controlVariation', 'reject', 'contract.manage', 'Invalid variation rejection payload.');
  reviewExtensionRequest = this.controlRecordMutation('controlExtensionRequest', 'review', 'contract.manage', 'Invalid extension review payload.');
  approveExtensionRequest = this.controlRecordMutation('controlExtensionRequest', 'approve', 'contract.manage', 'Invalid extension approval payload.');
  rejectExtensionRequest = this.controlRecordMutation('controlExtensionRequest', 'reject', 'contract.manage', 'Invalid extension rejection payload.');
  respondToClaim = this.controlRecordMutation('controlClaim', 'respond', 'contract.track', 'Invalid claim response payload.');
  reviewClaim = this.controlRecordMutation('controlClaim', 'review', 'contract.manage', 'Invalid claim review payload.');
  settleClaim = this.controlRecordMutation('controlClaim', 'settle', 'contract.manage', 'Invalid claim settlement payload.');
  rejectClaim = this.controlRecordMutation('controlClaim', 'reject', 'contract.manage', 'Invalid claim rejection payload.');
  escalateClaim = this.controlRecordMutation('controlClaim', 'escalate', 'contract.manage', 'Invalid claim escalation payload.');
  respondToNonConformance = this.controlRecordMutation('controlNonConformance', 'respond', 'contract.track', 'Invalid NCR response payload.');
  verifyNonConformance = this.controlRecordMutation('controlNonConformance', 'verify', 'contract.manage', 'Invalid NCR verification payload.');
  closeNonConformance = this.controlRecordMutation('controlNonConformance', 'close', 'contract.manage', 'Invalid NCR closeout payload.');
  reviewRisk = this.controlRecordMutation('controlRisk', 'review', 'contract.manage', 'Invalid risk review payload.');
  mitigateRisk = this.controlRecordMutation('controlRisk', 'mitigate', 'contract.manage', 'Invalid risk mitigation payload.');
  closeRisk = this.controlRecordMutation('controlRisk', 'close', 'contract.manage', 'Invalid risk closeout payload.');
  assignIssue = this.controlRecordMutation('controlIssue', 'assign', 'contract.manage', 'Invalid issue assignment payload.');
  resolveIssue = this.controlRecordMutation('controlIssue', 'resolve', 'contract.track', 'Invalid issue resolution payload.');
  closeIssue = this.controlRecordMutation('controlIssue', 'close', 'contract.manage', 'Invalid issue closeout payload.');
  respondToDispute = this.controlRecordMutation('controlDispute', 'respond', 'contract.track', 'Invalid dispute response payload.');
  resolveDispute = this.controlRecordMutation('controlDispute', 'resolve', 'contract.manage', 'Invalid dispute resolution payload.');
  closeDispute = this.controlRecordMutation('controlDispute', 'close', 'contract.manage', 'Invalid dispute closeout payload.');
  respondToTermination = this.controlRecordMutation('controlTermination', 'respond', 'contract.track', 'Invalid termination response payload.');
  decideTermination = this.controlRecordMutation('controlTermination', 'decide', 'contract.manage', 'Invalid termination decision payload.');
  settleTermination = this.controlRecordMutation('controlTermination', 'settle', 'contract.manage', 'Invalid termination settlement payload.');
  closeTermination = this.controlRecordMutation('controlTermination', 'close', 'contract.manage', 'Invalid termination closeout payload.');

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

  closeoutReadiness: RequestHandler = async (req, res, next) => {
    try {
      const params = idParamsSchema.safeParse(req.params);
      if (!params.success) throw requestError('Invalid contract id.');
      res.json(await this.service.closeoutReadiness(params.data.contractId, await this.requireContext(req)));
    } catch (error) {
      next(error);
    }
  };

  updateCloseoutStep: RequestHandler = async (req, res, next) => {
    try {
      const params = closeoutStepParamsSchema.safeParse(req.params);
      const body = controlWorkflowActionBodySchema.safeParse(req.body);
      if (!params.success) throw requestError('Invalid closeout step route.');
      if (!body.success) throw requestError('Invalid closeout step payload.');
      res.json(await this.service.updateCloseoutStep(params.data.contractId, params.data.stepId, body.data, await this.requirePermissionContext(req, 'contract.manage')));
    } catch (error) {
      next(error);
    }
  };
}
