import { ContractLifecycleItemStatus, ContractTerminationStatus, InvoiceStatus, type ContractStatus } from '@prisma/client';
import { ModuleService as AwardContractService } from '../award-contract/service.js';
import { moduleDefinition, type ModuleStatus, type PostAwardActionDto, type PostAwardBlockerDto, type PostAwardCloseoutReadinessDto, type PostAwardCommunicationSummaryDto, type PostAwardContractRowDto, type PostAwardFinancialEligibilityDto, type PostAwardHealthDto, type PostAwardMeetingActionSummaryDto, type PostAwardOperationalReadinessDto, type PostAwardPerformanceReadinessDto, type PostAwardProcurementType, type PostAwardRecordDto, type PostAwardRequestContext, type PostAwardSecurityExpirySummaryDto, type PostAwardStageDto, type PostAwardTaskDto, type PostAwardUrgentActionDto, type PostAwardVisibilityScope, type PostAwardWarrantySummaryDto, type PostAwardWorkflowSectionDto, type PostAwardWorkspaceDto } from './types.js';
import type { ContractDetailDto, ContractListItemDto, ControlWorkflowActionInput, FinanceWorkflowActionInput } from '../award-contract/types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

const activeStatuses = new Set(['SIGNED', 'PENDING_ACTIVATION', 'MOBILIZATION', 'ACTIVE', 'SUSPENDED', 'AT_RISK', 'COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING', 'TERMINATION_REVIEW', 'TERMINATED', 'CLOSED']);

export class ModuleService {
  constructor(private readonly awardContracts = new AwardContractService()) {}

  async status(): Promise<ModuleStatus> {
    return { ...moduleDefinition, status: 'ready' };
  }

  async contracts(context: PostAwardRequestContext): Promise<PostAwardContractRowDto[]> {
    const pageSize = 100;
    const firstPage = await this.awardContracts.listContracts({ organizationId: context.organizationId ?? '', status: 'all', search: '', page: 1, pageSize }, context);
    const contracts = [...firstPage.contracts];
    for (let page = 2; page <= Number(firstPage.totalPages ?? 1); page += 1) {
      const nextPage = await this.awardContracts.listContracts({ organizationId: context.organizationId ?? '', status: 'all', search: '', page, pageSize }, context);
      contracts.push(...nextPage.contracts);
    }
    return contracts.filter((row) => activeStatuses.has(String(row.status))).map((row) => {
      const viewerRole = contractViewerRole(row, context);
      return {
        id: row.id,
        reference: row.reference,
        title: row.title,
        status: row.status,
        buyerName: viewerRole === 'BUYER' ? 'Your organization' : row.buyerName,
        supplierName: viewerRole === 'SUPPLIER' ? 'Your organization' : row.supplierName,
        viewerRole,
        amount: row.amount,
        currency: row.currency,
        stage: stageLabel(row.status),
        nextAction: row.status === 'COMPLETED' || row.status === 'WARRANTY_DEFECTS' ? 'Prepare close-out' : 'Monitor execution',
        dueDate: null,
        riskLevel: 'Low'
      };
    });
  }

  async workspace(contractId: string, context: PostAwardRequestContext): Promise<PostAwardWorkspaceDto> {
    const contract = await this.awardContracts.contract(contractId, context);
    if (!activeStatuses.has(String(contract.status))) {
      throw requestError('Post-award starts after the contract is signed or active.', 409);
    }
    return workspaceDto(contract);
  }

  async actions(contractId: string, context: PostAwardRequestContext): Promise<PostAwardActionDto[]> {
    return (await this.workspace(contractId, context)).actions;
  }

  async uploadDocument(contractId: string, input: Parameters<AwardContractService['uploadContractDocument']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return this.awardContracts.uploadContractDocument(contractId, input, context);
  }

  async upsertManagementPlan(contractId: string, input: Parameters<AwardContractService['upsertManagementPlan']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertManagementPlan(contractId, input, context)));
  }

  async generateManagementPlanDraft(contractId: string, input: Parameters<AwardContractService['generateManagementPlanDraft']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.generateManagementPlanDraft(contractId, input, context)));
  }

  async submitActivationItem(contractId: string, itemId: string, input: Parameters<AwardContractService['submitActivationItem']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.submitActivationItem(contractId, itemId, input, context)));
  }

  async reviewActivationItem(contractId: string, itemId: string, input: Parameters<AwardContractService['reviewActivationItem']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewActivationItem(contractId, itemId, input, context)));
  }

  async activateContract(contractId: string, input: Parameters<AwardContractService['activateContract']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.activateContract(contractId, input, context)));
  }

  async createObligation(contractId: string, input: Parameters<AwardContractService['createObligation']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createObligation(contractId, input, context)));
  }

  async createEvidenceRequirement(contractId: string, input: Parameters<AwardContractService['createEvidenceRequirement']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createEvidenceRequirement(contractId, input, context)));
  }

  async createDeliverySchedule(contractId: string, input: Parameters<AwardContractService['createDeliverySchedule']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverySchedule(contractId, input, context)));
  }

  async createDispatchNotice(contractId: string, input: Parameters<AwardContractService['createDispatchNotice']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDispatchNotice(contractId, input, context)));
  }

  async createGoodsReceipt(contractId: string, input: Parameters<AwardContractService['createGoodsReceipt']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createGoodsReceipt(contractId, input, context)));
  }

  async createGoodsInspection(contractId: string, input: Parameters<AwardContractService['createGoodsInspection']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createGoodsInspection(contractId, input, context)));
  }

  async createSiteHandover(contractId: string, input: Parameters<AwardContractService['createSiteHandover']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createSiteHandover(contractId, input, context)));
  }

  async createWorksProgressReport(contractId: string, input: Parameters<AwardContractService['createWorksProgressReport']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createWorksProgressReport(contractId, input, context)));
  }

  async reviewWorksProgressReport(contractId: string, reportId: string, input: Parameters<AwardContractService['reviewWorksProgressReport']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewWorksProgressReport(contractId, reportId, input, context)));
  }

  async createBoqMeasurement(contractId: string, input: Parameters<AwardContractService['createBoqMeasurement']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createBoqMeasurement(contractId, input, context)));
  }

  async reviewBoqMeasurement(contractId: string, measurementId: string, input: Parameters<AwardContractService['reviewBoqMeasurement']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewBoqMeasurement(contractId, measurementId, input, context)));
  }

  async createInterimPaymentCertificate(contractId: string, input: Parameters<AwardContractService['createInterimPaymentCertificate']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInterimPaymentCertificate(contractId, input, context)));
  }

  async certifyInterimPaymentCertificate(contractId: string, certificateId: string, input: Parameters<AwardContractService['certifyInterimPaymentCertificate']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.certifyInterimPaymentCertificate(contractId, certificateId, input, context)));
  }

  async createWorksCompletionCertificate(contractId: string, input: Parameters<AwardContractService['createWorksCompletionCertificate']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createWorksCompletionCertificate(contractId, input, context)));
  }

  async createContractDefect(contractId: string, input: Parameters<AwardContractService['createContractDefect']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractDefect(contractId, input, context)));
  }

  async respondToContractDefect(contractId: string, defectId: string, input: Parameters<AwardContractService['respondToContractDefect']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.respondToContractDefect(contractId, defectId, input, context)));
  }

  async verifyContractDefect(contractId: string, defectId: string, input: Parameters<AwardContractService['verifyContractDefect']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.verifyContractDefect(contractId, defectId, input, context)));
  }

  async closeContractDefect(contractId: string, defectId: string, input: Parameters<AwardContractService['closeContractDefect']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.closeContractDefect(contractId, defectId, input, context)));
  }

  async createServiceLevel(contractId: string, input: Parameters<AwardContractService['createServiceLevel']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceLevel(contractId, input, context)));
  }

  async createServicePeriod(contractId: string, input: Parameters<AwardContractService['createServicePeriod']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServicePeriod(contractId, input, context)));
  }

  async createServiceReport(contractId: string, input: Parameters<AwardContractService['createServiceReport']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceReport(contractId, input, context)));
  }

  async reviewServiceReport(contractId: string, reportId: string, input: Parameters<AwardContractService['reviewServiceReport']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewServiceReport(contractId, reportId, input, context)));
  }

  async createServiceCredit(contractId: string, input: Parameters<AwardContractService['createServiceCredit']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceCredit(contractId, input, context)));
  }

  async reviewServiceCredit(contractId: string, creditId: string, input: Parameters<AwardContractService['reviewServiceCredit']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewServiceCredit(contractId, creditId, input, context)));
  }

  async createServiceIncident(contractId: string, input: Parameters<AwardContractService['createServiceIncident']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createServiceIncident(contractId, input, context)));
  }

  async respondToServiceIncident(contractId: string, incidentId: string, input: Parameters<AwardContractService['respondToServiceIncident']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.respondToServiceIncident(contractId, incidentId, input, context)));
  }

  async verifyServiceIncident(contractId: string, incidentId: string, input: Parameters<AwardContractService['verifyServiceIncident']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.verifyServiceIncident(contractId, incidentId, input, context)));
  }

  async closeServiceIncident(contractId: string, incidentId: string, input: Parameters<AwardContractService['closeServiceIncident']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.closeServiceIncident(contractId, incidentId, input, context)));
  }

  async createConsultancyDeliverable(contractId: string, input: Parameters<AwardContractService['createConsultancyDeliverable']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createConsultancyDeliverable(contractId, input, context)));
  }

  async reviewConsultancyDeliverable(contractId: string, deliverableId: string, input: Parameters<AwardContractService['reviewConsultancyDeliverable']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewConsultancyDeliverable(contractId, deliverableId, input, context)));
  }

  async createDeliverableVersion(contractId: string, input: Parameters<AwardContractService['createDeliverableVersion']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverableVersion(contractId, input, context)));
  }

  async reviewDeliverableVersion(contractId: string, versionId: string, input: Parameters<AwardContractService['reviewDeliverableVersion']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewDeliverableVersion(contractId, versionId, input, context)));
  }

  async createDeliverableReview(contractId: string, input: Parameters<AwardContractService['createDeliverableReview']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverableReview(contractId, input, context)));
  }

  async confirmDeliverableReviewPaymentEligibility(contractId: string, reviewId: string, input: Parameters<AwardContractService['confirmDeliverableReviewPaymentEligibility']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.confirmDeliverableReviewPaymentEligibility(contractId, reviewId, input, context)));
  }

  async upsertConsultancyFinalReport(contractId: string, input: Parameters<AwardContractService['upsertConsultancyFinalReport']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertConsultancyFinalReport(contractId, input, context)));
  }

  async reviewConsultancyFinalReport(contractId: string, reportId: string, input: Parameters<AwardContractService['reviewConsultancyFinalReport']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewConsultancyFinalReport(contractId, reportId, input, context)));
  }

  async createClaim(contractId: string, input: Parameters<AwardContractService['createClaim']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createClaim(contractId, input, context)));
  }

  async createClaimResponse(contractId: string, input: Parameters<AwardContractService['createClaimResponse']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createClaimResponse(contractId, input, context)));
  }

  async createExtensionRequest(contractId: string, input: Parameters<AwardContractService['createExtensionRequest']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createExtensionRequest(contractId, input, context)));
  }

  async createAmendment(contractId: string, input: Parameters<AwardContractService['createAmendment']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createAmendment(contractId, input, context)));
  }

  async createNonConformance(contractId: string, input: Parameters<AwardContractService['createNonConformance']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createNonConformance(contractId, input, context)));
  }

  async createContractSecurity(contractId: string, input: Parameters<AwardContractService['createContractSecurity']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractSecurity(contractId, input, context)));
  }

  async controlContractSecurity(contractId: string, securityId: string, action: 'review' | 'extend' | 'release' | 'claim' | 'waive', input: Parameters<AwardContractService['controlContractSecurity']>[3], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlContractSecurity(contractId, securityId, action, input, context)));
  }

  async createContractPenalty(contractId: string, input: Parameters<AwardContractService['createContractPenalty']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractPenalty(contractId, input, context)));
  }

  async createContractChangeRequest(contractId: string, input: Parameters<AwardContractService['createContractChangeRequest']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractChangeRequest(contractId, input, context)));
  }

  async createDeliverable(contractId: string, input: Parameters<AwardContractService['createDeliverable']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createDeliverable(contractId, input, context)));
  }

  async addMilestoneEvidence(contractId: string, milestoneId: string, input: Parameters<AwardContractService['addMilestoneEvidence']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.addMilestoneEvidence(contractId, milestoneId, input, context)));
  }

  async createInspection(contractId: string, input: Parameters<AwardContractService['createInspection']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInspection(contractId, input, context)));
  }

  async createAcceptance(contractId: string, input: Parameters<AwardContractService['createAcceptance']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createAcceptance(contractId, input, context)));
  }

  async createInvoice(contractId: string, input: Parameters<AwardContractService['createInvoice']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.createInvoice(contractId, input, context)));
  }

  async upsertThreeWayMatch(contractId: string, input: Parameters<AwardContractService['upsertThreeWayMatch']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertThreeWayMatch(contractId, input, context)));
  }

  async createPaymentApproval(contractId: string, input: Parameters<AwardContractService['createPaymentApproval']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createPaymentApproval(contractId, input, context)));
  }

  async verifyInvoiceFinance(contractId: string, invoiceId: string, action: 'verify' | 'return' | 'reject', input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.verifyInvoiceFinance(contractId, invoiceId, action, input, context)));
  }

  async correctInvoiceFinance(contractId: string, invoiceId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SUPPLIER');
    return workspaceDto(requireContractResult(await this.awardContracts.correctInvoiceFinance(contractId, invoiceId, input, context)));
  }

  async createPaymentRecommendation(contractId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createPaymentRecommendation(contractId, input, context)));
  }

  async reviewPaymentApproval(contractId: string, approvalId: string, action: 'review' | 'approve' | 'reject', input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.reviewPaymentApproval(contractId, approvalId, action, input, context)));
  }

  async updateInvoiceStatus(contractId: string, invoiceId: string, input: Parameters<AwardContractService['updateInvoiceStatus']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.updateInvoiceStatus(contractId, invoiceId, input, context)));
  }

  async createPayment(contractId: string, input: Parameters<AwardContractService['createPayment']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    const workspace = await this.workspace(contractId, context);
    const invoiceId = String((input as Record<string, unknown>).invoiceId ?? '');
    if (invoiceId) {
      const financeRecords = workspace.stages.find((stageItem) => stageItem.id === 'finance')?.records ?? [];
      const hasMatchedInvoice = financeRecords.some((record) => record.id === invoiceId && String(record.status).toUpperCase() === 'MATCHED');
      if (!hasMatchedInvoice) throw requestError('Payment cannot be recorded until the linked invoice has a matched three-way result.', 409);
      const hasApprovedPayment = financeRecords.some((record) => record.type === 'payment_approval' && String((record as unknown as Record<string, unknown>).invoiceId ?? '') === invoiceId && ['MATCHED', 'PAID'].includes(String(record.status).toUpperCase()));
      if (!hasApprovedPayment) throw requestError('Payment cannot be recorded until the matched invoice has an approved payment recommendation.', 409);
    }
    return workspaceDto(requireContractResult(await this.awardContracts.createPayment(contractId, input, context)));
  }

  async controlPayment(contractId: string, paymentId: string, action: 'initiate' | 'complete', input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlPayment(contractId, paymentId, action, input, context)));
  }

  async createPaymentConfirmation(contractId: string, input: Parameters<AwardContractService['createPaymentConfirmation']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createPaymentConfirmation(contractId, input, context)));
  }

  async createFinanceDeduction(contractId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractPenalty(contractId, financePenaltyInput(input, 'FINANCE_DEDUCTION'), context)));
  }

  async createFinanceRetention(contractId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractPenalty(contractId, financePenaltyInput(input, 'RETENTION_DECISION'), context)));
  }

  async createFinanceAdvanceRecovery(contractId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractPenalty(contractId, financePenaltyInput(input, 'ADVANCE_RECOVERY'), context)));
  }

  async createFinanceLiquidatedDamages(contractId: string, input: FinanceWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractPenalty(contractId, financePenaltyInput(input, 'LIQUIDATED_DAMAGES'), context)));
  }

  async createIssue(contractId: string, input: Parameters<AwardContractService['createIssue']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createIssue(contractId, input, context)));
  }

  async createVariation(contractId: string, input: Parameters<AwardContractService['createVariation']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createVariation(contractId, input, context)));
  }

  async createDispute(contractId: string, input: Parameters<AwardContractService['createDispute']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createDispute(contractId, input, context)));
  }

  async createTermination(contractId: string, input: Parameters<AwardContractService['createTermination']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    const contract = requireContractResult(await this.awardContracts.createTermination(contractId, input, context));
    const termination = latestTermination(contract.terminations);
    if (!termination) return workspaceDto(contract);
    const refreshed = await this.awardContracts.addTerminationNotice(contractId, termination.id, {
      noticeType: 'TERMINATION_NOTICE',
      contractClause: input.contractClause || '',
      requiredAction: input.cureDeadline
        ? `Supplier response or cure evidence required by ${input.cureDeadline}.`
        : 'Supplier response or cure evidence required.',
      deadline: input.cureDeadline,
      note: input.reason,
      payload: {
        ...(input.payload ?? {}),
        generatedFrom: 'post-award-termination-start',
        terminationType: input.terminationType,
        faultParty: input.faultParty || null,
        visibilityScope: 'SHARED'
      }
    }, context);
    return workspaceDto(requireContractResult(refreshed));
  }

  async controlChangeRequest(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'respond' ? 'SUPPLIER' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlChangeRequest(contractId, recordId, action, input, context)));
  }

  async controlVariation(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlVariation(contractId, recordId, action, input, context)));
  }

  async controlExtensionRequest(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlExtensionRequest(contractId, recordId, action, input, context)));
  }

  async controlClaim(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'respond' ? 'SHARED' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlClaim(contractId, recordId, action, input, context)));
  }

  async controlNonConformance(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'respond' ? 'SUPPLIER' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlNonConformance(contractId, recordId, action, input, context)));
  }

  async controlRisk(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlRisk(contractId, recordId, action, input, context)));
  }

  async controlIssue(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'resolve' ? 'SHARED' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlIssue(contractId, recordId, action, input, context)));
  }

  async controlDispute(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'respond' ? 'SUPPLIER' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlDispute(contractId, recordId, action, input, context)));
  }

  async controlTermination(contractId: string, recordId: string, action: string, input: ControlWorkflowActionInput, context: PostAwardRequestContext) {
    if (action === 'respond') {
      await this.ensureAccess(contractId, context, 'SUPPLIER');
      return workspaceDto(requireContractResult(await this.awardContracts.updateTermination(contractId, recordId, {
        supplierResponse: input.supplierResponse || input.response || input.note || '',
        status: ContractTerminationStatus.UNDER_REVIEW,
        payload: input.payload
      }, context)));
    }
    await this.ensureAccess(contractId, context, 'BUYER');
    if (action === 'settle') {
      return workspaceDto(requireContractResult(await this.awardContracts.upsertTerminationSettlement(contractId, recordId, {
        status: ContractLifecycleItemStatus.CLOSED,
        settlementNote: input.note || input.decision || '',
        settledAt: new Date().toISOString(),
        payload: { ...input.payload, settlementAmount: input.settlementAmount ?? input.amountApproved ?? null, visibilityScope: input.visibilityScope ?? 'BUYER_PRIVATE' }
      }, context)));
    }
    const status = action === 'terminate'
      ? ContractTerminationStatus.TERMINATED
      : action === 'close'
        ? ContractTerminationStatus.CLOSED
        : action === 'reject'
          ? ContractTerminationStatus.REJECTED
          : ContractTerminationStatus.APPROVED;
    return workspaceDto(requireContractResult(await this.awardContracts.updateTermination(contractId, recordId, {
      status,
      finalDecision: input.decision || input.note || '',
      terminationEffectiveDate: action === 'terminate' ? new Date().toISOString().slice(0, 10) : undefined,
      signatureKeyphrase: input.signatureKeyphrase,
      payload: { ...input.payload, privateNote: input.privateNote ?? null, visibilityScope: input.visibilityScope ?? 'BUYER_PRIVATE' }
    }, context)));
  }

  async upsertCloseout(contractId: string, input: Parameters<AwardContractService['upsertCloseout']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    const workspace = await this.workspace(contractId, context);
    const closeoutInput = input as Record<string, unknown>;
    const finalizing = String(closeoutInput.status ?? '').toUpperCase() === 'CLOSED' || closeoutInput.completionCertificate === true || closeoutInput.finalAccountApproved === true;
    if (finalizing && workspace.currentBlockers.length > 0) {
      throw requestError(`Closeout is blocked: ${workspace.currentBlockers.map((blocker) => blocker.title).join('; ')}`, 409);
    }
    return workspaceDto(requireContractResult(await this.awardContracts.upsertCloseout(contractId, input, context)));
  }

  async upsertWarranty(contractId: string, input: Parameters<AwardContractService['upsertWarranty']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertWarranty(contractId, input, context)));
  }

  async controlWarranty(contractId: string, warrantyId: string, action: 'respond' | 'verify' | 'close', input: Parameters<AwardContractService['controlWarranty']>[3], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'respond' ? 'SUPPLIER' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlWarranty(contractId, warrantyId, action, input, context)));
  }

  async createContractNotice(contractId: string, input: Parameters<AwardContractService['createContractNotice']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractNotice(contractId, input, context)));
  }

  async controlContractNotice(contractId: string, noticeId: string, action: 'acknowledge' | 'respond' | 'close', input: Parameters<AwardContractService['controlContractNotice']>[3], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'close' ? 'BUYER' : 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.controlContractNotice(contractId, noticeId, action, input, context)));
  }

  async createContractMeeting(contractId: string, input: Parameters<AwardContractService['createContractMeeting']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractMeeting(contractId, input, context)));
  }

  async createContractMeetingAction(contractId: string, meetingId: string, input: Parameters<AwardContractService['createContractMeetingAction']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.createContractMeetingAction(contractId, meetingId, input, context)));
  }

  async controlContractMeetingAction(contractId: string, actionId: string, action: 'complete' | 'verify' | 'close', input: Parameters<AwardContractService['controlContractMeetingAction']>[3], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, action === 'complete' ? 'SHARED' : 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.controlContractMeetingAction(contractId, actionId, action, input, context)));
  }

  async recalculateUrgentActions(contractId: string, context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.recalculateUrgentActions(contractId, context)));
  }

  async closeoutReadiness(contractId: string, context: PostAwardRequestContext) {
    return (await this.workspace(contractId, context)).closeoutReadiness;
  }

  async updateCloseoutStep(contractId: string, stepId: string, input: Parameters<AwardContractService['updateCloseoutStep']>[2], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.updateCloseoutStep(contractId, stepId, input, context)));
  }

  async upsertRequiredDocument(contractId: string, input: Parameters<AwardContractService['upsertRequiredDocument']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'SHARED');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertRequiredDocument(contractId, input, context)));
  }

  async upsertSupplierPerformance(contractId: string, input: Parameters<AwardContractService['upsertSupplierPerformance']>[1], context: PostAwardRequestContext) {
    await this.ensureAccess(contractId, context, 'BUYER');
    return workspaceDto(requireContractResult(await this.awardContracts.upsertSupplierPerformance(contractId, input, context)));
  }

  private async ensureAccess(contractId: string, context: PostAwardRequestContext, owner: 'BUYER' | 'SUPPLIER' | 'SHARED') {
    const workspace = await this.workspace(contractId, context);
    const access = workspace.contract.access;
    if (owner === 'BUYER' && !access.canManageBuyerActions) throw requestError(access.readOnlyReason ?? 'This action is restricted to the buyer.', 403);
    if (owner === 'SUPPLIER' && !access.canSubmitSupplierActions) throw requestError(access.readOnlyReason ?? 'This action is restricted to the supplier.', 403);
    if (owner === 'SHARED' && access.viewerRole === 'NONE') throw requestError(access.readOnlyReason ?? 'You do not have access to this contract.', 403);
  }
}

function requireContractResult(contract: ContractDetailDto | null): ContractDetailDto {
  if (!contract) throw requestError('Contract was not found after saving the post-award action.', 404);
  return contract;
}

function latestTermination(terminations: ContractDetailDto['terminations']) {
  return [...(terminations ?? [])].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function financePenaltyInput(input: FinanceWorkflowActionInput, penaltyType: string): Parameters<AwardContractService['createContractPenalty']>[1] {
  const payload = input.payload ?? {};
  return {
    invoiceId: input.invoiceId,
    penaltyType: String(payload.penaltyType ?? penaltyType),
    contractClause: String(payload.contractClause ?? ''),
    basis: input.decision || input.response || input.note || String(payload.basis ?? ''),
    amount: input.amount ?? input.amountApproved ?? input.paymentImpact ?? input.settlementAmount,
    currency: input.currency || String(payload.currency ?? 'TZS'),
    status: String(input.status ?? payload.status ?? 'DRAFT'),
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    note: input.note ?? '',
    payload: {
      ...payload,
      financeKind: penaltyType,
      privateNote: input.privateNote ?? null,
      visibilityScope: input.visibilityScope ?? 'BUYER_PRIVATE',
      decidedAt: new Date().toISOString()
    }
  };
}

function contractViewerRole(contract: ContractListItemDto, context: PostAwardRequestContext): PostAwardContractRowDto['viewerRole'] {
  if (context.isAdmin) return 'ADMIN';
  if (context.organizationId && contract.buyerOrgId === context.organizationId) return 'BUYER';
  if (context.organizationId && contract.supplierOrgId === context.organizationId) return 'SUPPLIER';
  return 'NONE';
}

function workspaceDto(contract: ContractDetailDto): PostAwardWorkspaceDto {
  const role = contract.access?.viewerRole ?? 'NONE';
  const procurementType = procurementTypeFor(contract);
  const stages = stageDtos(contract);
  const currentBlockers = blockersFor(contract, procurementType);
  const financialEligibility = financialEligibilityFor(contract, currentBlockers);
  const operationalReadiness = operationalReadinessFor(contract, currentBlockers);
  const urgentActions = urgentActionsFor(contract, currentBlockers);
  const communicationSummary = communicationSummaryFor(contract);
  const meetingActionSummary = meetingActionSummaryFor(contract);
  const securityExpirySummary = securityExpirySummaryFor(contract);
  const warrantySummary = warrantySummaryFor(contract);
  const performanceReadiness = performanceReadinessFor(contract, currentBlockers);
  const closeoutReadiness = closeoutReadinessFor(contract, currentBlockers);
  const workflowSections = scrubWorkflowSections(workflowSectionsFor(contract, procurementType, stages, currentBlockers), role);
  const buyerTasks = tasksFor(contract, procurementType, 'BUYER', currentBlockers, financialEligibility);
  const supplierTasks = tasksFor(contract, procurementType, 'SUPPLIER', currentBlockers, financialEligibility);
  const health = healthFor(contract, currentBlockers);
  const visibleStages = scrubStages(stages, role);
  const timeline = scrubRecords(timelineFor(contract), role);
  return {
    contract: {
      id: contract.id,
      reference: contract.reference,
      title: contract.title,
      status: contract.status as ContractStatus,
      buyerName: contract.buyerName,
      supplierName: contract.supplierName,
      viewerRole: role,
      amount: contract.amount,
      currency: contract.currency,
      stage: stageLabel(contract.status),
      nextAction: nextAction(contract),
      dueDate: nextDueDate(contract),
      riskLevel: riskLabel(contract),
      tenderId: contract.tenderId,
      tenderReference: contract.tenderReference,
      access: {
        viewerRole: role,
        canSubmitSupplierActions: Boolean(contract.access?.canSubmitSupplierActions),
        canManageBuyerActions: Boolean(contract.access?.canManageBuyerActions),
        readOnlyReason: contract.access?.readOnlyReason ?? null
      }
    },
    procurementType,
    health,
    buyerTasks,
    supplierTasks,
    workflowSections,
    currentBlockers,
    financialEligibility,
    operationalReadiness,
    urgentActions,
    communicationSummary,
    meetingActionSummary,
    securityExpirySummary,
    warrantySummary,
    performanceReadiness,
    closeoutReadiness,
    timeline,
    permissions: {
      visibility: role === 'BUYER' ? 'BUYER_PRIVATE' : role === 'SUPPLIER' ? 'SUPPLIER_PRIVATE' : 'SHARED',
      canManageBuyerActions: Boolean(contract.access?.canManageBuyerActions),
      canSubmitSupplierActions: Boolean(contract.access?.canSubmitSupplierActions),
      canSeeBuyerPrivate: role === 'BUYER' || role === 'ADMIN',
      canSeeSupplierPrivate: role === 'SUPPLIER' || role === 'ADMIN'
    },
    metrics: [
      { label: 'Milestones', value: contract.milestones.length, tone: 'info' },
      { label: 'Open obligations', value: (contract.obligations ?? []).filter((item) => item.status !== 'CLOSED').length, tone: (contract.obligations ?? []).length ? 'warning' : 'success' },
      { label: 'Invoices', value: contract.invoices?.length ?? 0, tone: 'info' },
      { label: 'Accepted', value: contract.acceptances?.length ?? 0, tone: 'success' },
      { label: 'Ready to invoice', value: financialEligibility.invoiceableRecords.length, tone: financialEligibility.invoiceableRecords.length ? 'success' : 'warning' },
      { label: 'Health', value: health.label, tone: health.level === 'CRITICAL' || health.level === 'HIGH' ? 'error' : health.level === 'MEDIUM' ? 'warning' : 'success' }
    ],
    detail: contract,
    stages: visibleStages,
    secondary: [
      scrubSecondary(secondary('termination', 'Termination', typedRecords(contract.terminations, 'termination')), role),
      scrubSecondary(secondary('securities', 'Securities', typedRecords(contract.securities, 'security')), role),
      scrubSecondary(secondary('audit', 'Audit', typedRecords(contract.audit, 'activity')), role)
    ],
    actions: actionsFor(contract)
  };
}

function visibleToRole(scope: string, role: PostAwardContractRowDto['viewerRole']) {
  const normalized = scope.toUpperCase();
  if (role === 'ADMIN') return true;
  if (normalized === 'BUYER_PRIVATE') return role === 'BUYER';
  if (normalized === 'SUPPLIER_PRIVATE') return role === 'SUPPLIER';
  return true;
}

function scrubRecord(record: PostAwardRecordDto, role: PostAwardContractRowDto['viewerRole']): PostAwardRecordDto {
  const payload = objectValue(record.payload);
  const scope = stringValue(payload.visibilityScope) || stringValue((record as unknown as Record<string, unknown>).visibilityScope) || 'SHARED';
  if (visibleToRole(scope, role)) return record;
  return {
    ...record,
    note: 'Private workflow record',
    amount: null,
    payload: {
      visibilityScope: scope,
      redacted: true
    }
  };
}

function scrubPayloadFields(payload: Record<string, unknown>, role: PostAwardContractRowDto['viewerRole']) {
  if (role === 'BUYER' || role === 'ADMIN') return payload;
  return scrubPrivateValue(payload) as Record<string, unknown>;
}

function scrubPrivateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubPrivateValue);
  if (!value || typeof value !== 'object') return value;
  const scrubbed: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (['privateNote', 'buyerPrivateNote', 'financialReview', 'budgetCheck', 'legalReview', 'paymentNote', 'internalDecisionNote', 'fraudNote', 'mismatchPrivateNote'].includes(key)) continue;
    scrubbed[key] = scrubPrivateValue(nested);
  }
  return scrubbed;
}

function scrubRecords(records: PostAwardRecordDto[], role: PostAwardContractRowDto['viewerRole']) {
  return records.map((record) => {
    const visible = scrubRecord(record, role);
    return { ...visible, payload: scrubPayloadFields(objectValue(visible.payload), role) };
  });
}

function scrubStages(stages: PostAwardStageDto[], role: PostAwardContractRowDto['viewerRole']) {
  return stages.map((stageItem) => ({ ...stageItem, records: scrubRecords(stageItem.records, role) }));
}

function scrubWorkflowSections(sections: PostAwardWorkflowSectionDto[], role: PostAwardContractRowDto['viewerRole']) {
  return sections.map((section) => ({ ...section, records: scrubRecords(section.records, role) }));
}

function scrubSecondary(register: PostAwardWorkspaceDto['secondary'][number], role: PostAwardContractRowDto['viewerRole']) {
  return { ...register, records: scrubRecords(register.records, role) };
}

function stageDtos(contract: ContractDetailDto): PostAwardStageDto[] {
  return [
    stage('setup', 'Activation / Setup', 'Activation checklist, baselines, obligations, evidence requirements, CMP, and mobilization readiness.', [
      ...typedRecords(contract.activation ? [contract.activation] : [], 'activation'),
      ...typedRecords(contract.activationItems, 'activation_item'),
      ...typedRecords(contract.baselines, 'baseline'),
      ...typedRecords(contract.obligations, 'obligation'),
      ...typedRecords(contract.evidenceRequirements, 'evidence_requirement'),
      ...typedRecords(contract.managementPlan ? [contract.managementPlan] : [], 'management_plan'),
      ...typedRecords(contract.commencements, 'commencement'),
      ...typedRecords(contract.mobilizationItems, 'mobilization')
    ]),
    stage('delivery', 'Delivery', 'Milestones, deliverables, and supplier evidence.', [
      ...typedRecords(contract.milestones, 'milestone'),
      ...typedRecords(contract.deliverables, 'deliverable'),
      ...typedRecords(contract.deliverySchedules, 'delivery_schedule'),
      ...typedRecords(contract.dispatchNotices, 'dispatch_notice'),
      ...typedRecords(contract.goodsReceipts, 'goods_receipt'),
      ...typedRecords(contract.siteHandovers, 'site_handover'),
      ...typedRecords(contract.worksProgressReports, 'works_progress_report'),
      ...typedRecords(contract.boqMeasurements, 'boq_measurement'),
      ...typedRecords(contract.serviceLevels, 'service_level'),
      ...typedRecords(contract.servicePeriods, 'service_period'),
      ...typedRecords(contract.serviceReports, 'service_report'),
      ...typedRecords(contract.serviceCredits, 'service_credit'),
      ...typedRecords(contract.consultancyDeliverables, 'consultancy_deliverable'),
      ...typedRecords(contract.deliverableVersions, 'deliverable_version'),
      ...typedRecords(contract.deliverableReviews, 'deliverable_review'),
      ...typedRecords(contract.consultancyFinalReports, 'consultancy_final_report')
    ]),
    stage('inspections', 'Inspections / Acceptance', 'Buyer inspections, goods checks, defects, and acceptance certificates.', [
      ...typedRecords(contract.inspections, 'inspection'),
      ...typedRecords(contract.goodsInspections, 'goods_inspection'),
      ...typedRecords(contract.defects, 'defect'),
      ...typedRecords(contract.acceptances, 'acceptance')
    ]),
    stage('finance', 'Finance', 'Invoices, payment review, approvals, payments, and confirmations.', [
      ...typedRecords(contract.interimPaymentCertificates, 'interim_payment_certificate'),
      ...typedRecords(contract.invoices, 'invoice'),
      ...typedRecords(contract.paymentSchedules, 'payment_schedule'),
      ...typedRecords(contract.payments, 'payment'),
      ...typedRecords(contract.threeWayMatches, 'three_way_match'),
      ...typedRecords(contract.paymentApprovals, 'payment_approval'),
      ...typedRecords(contract.paymentConfirmations, 'payment_confirmation'),
      ...typedRecords(contract.penalties, 'penalty')
    ]),
    stage('risk', 'Risk', 'Risks, notices, forecasts, non-conformance, and corrective action.', [
      ...typedRecords(contract.notices, 'notice'),
      ...typedRecords(contract.risks, 'risk'),
      ...typedRecords(contract.riskForecasts, 'risk_forecast'),
      ...typedRecords(contract.serviceIncidents, 'service_incident'),
      ...typedRecords(contract.nonConformances, 'non_conformance'),
      ...typedRecords(contract.issues, 'issue')
    ]),
    stage('changes', 'Changes', 'Formal scope, cost, time, technical changes, and amendments.', [
      ...typedRecords(contract.variations, 'variation'),
      ...typedRecords(contract.changeRequests, 'change_request'),
      ...typedRecords(contract.extensionRequests, 'extension_request'),
      ...typedRecords(contract.amendments, 'amendment'),
      ...typedRecords(contract.disputes, 'dispute')
    ]),
    stage('claims', 'Claims', 'Claims, responses, disputes, and entitlement decisions.', [
      ...typedRecords(contract.claims, 'claim'),
      ...typedRecords(contract.claimResponses, 'claim_response')
    ]),
    stage('documents', 'Documents / Warranty', 'Required documents, warranty records, and securities.', [
      ...typedRecords(contract.requiredDocuments, 'required_document'),
      ...typedRecords(contract.warranties, 'warranty'),
      ...typedRecords(contract.securities, 'security')
    ]),
    stage('closeout', 'Close-out', 'Completion certificate, final account, and lessons learned.', [
      ...typedRecords(contract.worksCompletionCertificates, 'works_completion_certificate'),
      ...typedRecords(contract.closeout ? [contract.closeout] : [], 'closeout')
    ]),
    stage('performance', 'Supplier Performance', 'Supplier scorecards, risk profile, and performance history.', [
      ...typedRecords(contract.supplierPerformanceRecords, 'supplier_performance'),
      ...typedRecords(contract.performanceScores, 'performance_score'),
      ...typedRecords(contract.supplierRiskProfile ? [contract.supplierRiskProfile] : [], 'supplier_risk')
    ]),
    stage('history', 'History', 'Execution activity and audit trail.', [
      ...typedRecords(contract.meetings, 'meeting'),
      ...typedRecords(contract.meetingActions, 'meeting_action'),
      ...typedRecords(contract.audit, 'activity'),
      ...typedRecords(contract.notifications, 'notification')
    ])
  ];
}

function procurementTypeFor(contract: ContractDetailDto): PostAwardProcurementType {
  const payload = objectValue(contract.payload);
  const raw = [
    payload.procurementType,
    payload.tenderType,
    payload.contractType,
    payload.category,
    contract.title
  ].map((value) => String(value ?? '').toUpperCase()).join(' ');
  if (/WORK|CONSTRUCTION|BOQ/.test(raw)) return 'WORKS';
  if (/CONSULT/.test(raw)) return 'CONSULTANCY';
  if (/SERVICE|SLA|MAINTENANCE/.test(raw)) return 'SERVICES';
  if (/GOOD|SUPPL|DELIVERY|EQUIPMENT|MATERIAL/.test(raw)) return 'GOODS';
  return 'GOODS';
}

const terminalStatuses = new Set(['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED', 'COMPLETED', 'PAID', 'MATCHED', 'REJECTED', 'WAIVED', 'CANCELLED', 'TERMINATED', 'SETTLED']);
const openStatuses = new Set(['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'DRAFT', 'REVIEW', 'BLOCKED', 'PENDING', 'PENDING_RESPONSE']);

function isTerminal(value: unknown) {
  return terminalStatuses.has(String(value ?? '').toUpperCase());
}

function isOpen(value: unknown) {
  return openStatuses.has(String(value ?? '').toUpperCase()) || !isTerminal(value);
}

function payloadId(record: Record<string, unknown>, ...keys: string[]) {
  const payload = objectValue(record.payload);
  for (const key of keys) {
    const direct = stringValue(record[key]);
    if (direct) return direct;
    const nested = stringValue(payload[key]);
    if (nested) return nested;
  }
  return '';
}

function recordAmount(record: Record<string, unknown>) {
  return (record.amount as number | string | null | undefined)
    ?? (record.acceptedValue as number | string | null | undefined)
    ?? (record.acceptedAmount as number | string | null | undefined)
    ?? (record.finalAccountAmount as number | string | null | undefined)
    ?? (record.netAmount as number | string | null | undefined)
    ?? (record.certifiedAmount as number | string | null | undefined)
    ?? (record.grossAmount as number | string | null | undefined)
    ?? objectValue(record.payload).acceptedValue as number | string | null | undefined
    ?? null;
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function payloadNumber(record: Record<string, unknown>, ...keys: string[]) {
  const payload = objectValue(record.payload);
  for (const key of keys) {
    const value = numberValue(record[key]) ?? numberValue(payload[key]);
    if (value !== null) return value;
  }
  return null;
}

function acceptedReceiptAmount(record: Record<string, unknown>) {
  const direct = payloadNumber(record, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
  if (direct !== null) return direct;
  const lines = Array.isArray(record.lines) ? record.lines as Array<Record<string, unknown>> : [];
  let total = 0;
  let hasAmount = false;
  for (const line of lines) {
    const linePayload = objectValue(line.payload);
    const lineValue = numberValue(line.acceptedValue) ?? numberValue(linePayload.acceptedValue) ?? numberValue(linePayload.acceptedAmount) ?? numberValue(linePayload.invoiceableAmount);
    if (lineValue !== null) {
      total += lineValue;
      hasAmount = true;
      continue;
    }
    const acceptedQuantity = numberValue(line.acceptedQuantity);
    const unitRate = numberValue(linePayload.unitRate) ?? numberValue(linePayload.unitPrice) ?? numberValue(linePayload.rate);
    if (acceptedQuantity !== null && unitRate !== null) {
      total += acceptedQuantity * unitRate;
      hasAmount = true;
    }
  }
  return hasAmount ? total : null;
}

function acceptedGoodsInspectionAmount(record: Record<string, unknown>) {
  const direct = payloadNumber(record, 'acceptedValue', 'acceptedAmount', 'invoiceableAmount');
  if (direct !== null) return direct;
  const acceptedQuantity = numberValue(record.quantityAccepted);
  const unitRate = payloadNumber(record, 'unitRate', 'unitPrice', 'rate');
  return acceptedQuantity !== null && unitRate !== null ? acceptedQuantity * unitRate : null;
}

function acceptedAmountFor(record: Record<string, unknown>, type: string): number | null {
  if (type === 'goods_receipt') return acceptedReceiptAmount(record);
  if (type === 'goods_inspection') return acceptedGoodsInspectionAmount(record);
  if (type === 'works_completion_certificate') return numberValue(record.finalAccountAmount) ?? payloadNumber(record, 'finalAccountAmount', 'invoiceableAmount');
  if (type === 'service_report') return numberValue(record.acceptedAmount) ?? payloadNumber(record, 'acceptedAmount', 'acceptedValue', 'invoiceableAmount');
  if (type === 'service_credit') return numberValue(record.invoiceImpactAmount) ?? numberValue(record.amount) ?? payloadNumber(record, 'invoiceImpactAmount', 'invoiceableAmount');
  if (type === 'deliverable_version') {
    const reviews = Array.isArray(record.reviews) ? record.reviews as Array<Record<string, unknown>> : [];
    const payableReview = reviews.find((review) => isPayableConsultancyRecord(review) && isTerminal(statusOf(review)));
    return payableReview ? acceptedAmountFor(payableReview, 'deliverable_review') : numberValue(recordAmount(record));
  }
  if (type === 'deliverable_review' || type === 'consultancy_final_report' || type === 'consultancy_deliverable') return numberValue(record.acceptedAmount) ?? payloadNumber(record, 'acceptedAmount', 'acceptedValue', 'invoiceableAmount');
  return numberValue(recordAmount(record));
}

function isPayableServiceDecision(record: Record<string, unknown>) {
  const payload = objectValue(record.payload);
  const type = String(record.creditType ?? payload.creditType ?? '').toUpperCase();
  if (payload.paymentEligible === true || payload.payable === true) return true;
  return /PAYABLE|BONUS|ADDITIONAL|ADJUSTMENT/.test(type);
}

function isPayableConsultancyRecord(record: Record<string, unknown>) {
  const payload = objectValue(record.payload);
  return record.paymentEligible === true || payload.paymentEligible === true || payload.payable === true;
}

function statusOf(record: Record<string, unknown>) {
  return stringValue(record.status) || stringValue(record.result) || stringValue(record.decision);
}

function hasAcceptedReceiptQuantity(record: Record<string, unknown>) {
  const lines = Array.isArray(record.lines) ? record.lines as Array<Record<string, unknown>> : [];
  return lines.some((line) => Number(line.acceptedQuantity ?? 0) > 0);
}

function invoicedAmountFor(contract: ContractDetailDto, executionReferenceId: string) {
  return (contract.invoices ?? [])
    .filter((invoice) => {
      const status = String(invoice.status ?? '').toUpperCase();
      const payload = objectValue(invoice.payload);
      const invoiceRefId = stringValue(invoice.executionReferenceId) || stringValue(payload.executionReferenceId);
      return invoiceRefId === executionReferenceId && !['BLOCKED', 'REJECTED'].includes(status);
    })
    .reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0);
}

function blockersFor(contract: ContractDetailDto, procurementType: PostAwardProcurementType): PostAwardBlockerDto[] {
  const blockers: PostAwardBlockerDto[] = [];
  const add = (id: string, title: string, detail: string, owner: PostAwardBlockerDto['owner'], severity: PostAwardBlockerDto['severity'], sectionId: PostAwardStageDto['id'], actionKey: string) => {
    blockers.push({ id, title, detail, owner, severity, sectionId, actionKey });
  };
  if (!contract.managementPlan) add('missing-cmp', 'Contract management plan required', 'Confirm objectives, responsibilities, monitoring, reporting, and communication before deep execution.', 'BUYER', 'High', 'setup', 'management-plan');
  if ((contract.activationItems ?? []).some((item) => item.status !== 'APPROVED' && item.status !== 'WAIVED' && item.status !== 'CLOSED')) {
    add('activation-items-open', 'Activation checklist is incomplete', 'Every required activation item must be approved, waived, or closed before the contract can operate without restrictions.', 'SHARED', 'Critical', 'setup', 'activation-review');
  }
  if ((contract.securities ?? []).some((item) => !['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'].includes(String(item.verificationStatus ?? item.status ?? '').toUpperCase()))) {
    add('security-not-approved', 'Security or guarantee not verified', 'Required securities, guarantees, and insurance documents must be verified before activation and payment.', 'BUYER', 'Critical', 'documents', 'security');
  }
  if (procurementType === 'GOODS') {
    const schedules = contract.deliverySchedules ?? [];
    const dispatches = contract.dispatchNotices ?? [];
    const receipts = contract.goodsReceipts ?? [];
    const receiptIds = new Set(receipts.map((item) => stringValue(item.id)).filter(Boolean));
    const receiptDispatchIds = new Set(receipts.map((item) => payloadId(item, 'dispatchNoticeId')).filter(Boolean));
    const inspectionReceiptIds = new Set((contract.goodsInspections ?? []).map((item) => payloadId(item, 'goodsReceiptId', 'receiptId')).filter(Boolean));
    const acceptedReceiptIds = new Set((contract.acceptances ?? []).map((item) => payloadId(item, 'goodsReceiptId')).filter(Boolean));
    const acceptedInspectionIds = new Set((contract.acceptances ?? []).map((item) => payloadId(item, 'goodsInspectionId')).filter(Boolean));
    if (!schedules.length) add('goods-no-schedule', 'Goods delivery schedule is missing', 'Buyer must create the delivery schedule before supplier dispatch is allowed.', 'BUYER', 'High', 'delivery', 'goods-delivery-schedule');
    if (schedules.length && !dispatches.length) add('goods-dispatch-waiting', 'Supplier dispatch notice is waiting', 'Supplier must submit dispatch details against a delivery schedule before buyer receipt.', 'SUPPLIER', 'Medium', 'delivery', 'dispatch-notice');
    if (dispatches.length && dispatches.some((dispatch) => !receiptDispatchIds.has(stringValue(dispatch.id)))) add('goods-receipt-waiting', 'Goods receipt is waiting', 'Buyer must record receipt for submitted dispatch notices before inspection.', 'BUYER', 'High', 'delivery', 'goods-receipt');
    if (receipts.length && receipts.some((receipt) => !inspectionReceiptIds.has(stringValue(receipt.id)))) add('goods-inspection-waiting', 'Goods inspection is waiting', 'Buyer must inspect received goods and record accepted or rejected quantities.', 'BUYER', 'High', 'inspections', 'goods-inspection');
    const acceptedEvidenceReady = (contract.goodsInspections ?? []).some((inspection) => isTerminal(statusOf(inspection)) && !acceptedInspectionIds.has(stringValue(inspection.id)))
      || receipts.some((receipt) => (isTerminal(statusOf(receipt)) || hasAcceptedReceiptQuantity(receipt)) && !acceptedReceiptIds.has(stringValue(receipt.id)));
    if (acceptedEvidenceReady) add('goods-acceptance-waiting', 'Acceptance certificate is waiting', 'Buyer must issue acceptance, partial acceptance, or rejection against inspected goods before invoice.', 'BUYER', 'High', 'inspections', 'acceptance');
    if ((contract.warranties ?? []).some((item) => isOpen(item.status))) add('open-warranty', 'Warranty or defects liability item is open', 'Open warranty defects must be resolved or formally carried before closeout.', 'SUPPLIER', 'High', 'documents', 'warranty');
  }
  if (procurementType === 'WORKS') {
    const siteHandovers = contract.siteHandovers ?? [];
    const progressReports = contract.worksProgressReports ?? [];
    const approvedProgress = progressReports.filter((item) => isTerminal(statusOf(item)));
    const submittedProgress = progressReports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const measurements = contract.boqMeasurements ?? [];
    const approvedMeasurements = measurements.filter((item) => ['APPROVED', 'CERTIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const measurementsForReview = measurements.filter((item) => ['MEASURED', 'SUBMITTED', 'REVIEW', 'DRAFT'].includes(String(statusOf(item)).toUpperCase()));
    const ipcs = contract.interimPaymentCertificates ?? [];
    const certifiedIpcs = ipcs.filter((item) => ['APPROVED', 'CERTIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const draftIpcs = ipcs.filter((item) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(statusOf(item)).toUpperCase()));
    const openMobilization = (contract.mobilizationItems ?? []).filter((item) => Boolean((item.payload as Record<string, unknown> | undefined)?.required ?? true) && !['APPROVED', 'CLOSED', 'WAIVED'].includes(String(item.status ?? '').toUpperCase()));
    const openDefects = (contract.defects ?? []).filter((item) => isOpen(item.status));
    const submittedDefects = openDefects.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    const practicalCompletion = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'PRACTICAL_COMPLETION' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    const finalAccount = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_ACCOUNT' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    const finalCompletion = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_COMPLETION' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    if (!siteHandovers.length) add('works-no-handover', 'Site handover is required', 'Buyer must record site possession, access constraints, and readiness before Works progress can begin.', 'BUYER', 'High', 'delivery', 'site-handover');
    if (siteHandovers.length && openMobilization.length) add('works-mobilization-open', 'Mobilization readiness is incomplete', 'Required mobilization and programme items must be approved, waived, or closed before progress reporting.', 'SHARED', 'High', 'setup', 'activation-review');
    if (siteHandovers.length && !progressReports.length) add('works-progress-waiting', 'Supplier progress report is waiting', 'Supplier must submit progress, labour, plant, materials, safety, weather, and delay evidence.', 'SUPPLIER', 'Medium', 'delivery', 'works-progress');
    if (submittedProgress.length) add('works-progress-review-waiting', 'Progress report review is waiting', 'Buyer must approve, reject, or return submitted Works progress before measurement.', 'BUYER', 'High', 'delivery', 'works-progress-review');
    if (approvedProgress.length && !measurements.length) add('works-measurement-waiting', 'BOQ measurement is waiting', 'Buyer must measure and verify quantities against approved progress before IPC.', 'BUYER', 'High', 'delivery', 'boq-measurement');
    if (measurementsForReview.length) add('works-measurement-review-waiting', 'BOQ measurement review is waiting', 'Buyer must approve, reject, or certify measured quantities before IPC.', 'BUYER', 'High', 'delivery', 'boq-measurement-review');
    if (approvedMeasurements.length && !ipcs.length) add('works-ipc-waiting', 'Interim payment certificate is waiting', 'Buyer must issue an IPC from approved measurement before invoice eligibility.', 'BUYER', 'High', 'finance', 'interim-payment-certificate');
    if (draftIpcs.length) add('works-ipc-certification-waiting', 'IPC certification is waiting', 'Buyer must certify net payable, retention, advance recovery, damages, tax, and deductions.', 'BUYER', 'High', 'finance', 'ipc-certify');
    if (openDefects.length) add('open-defects', 'Open Works defects remain', 'Supplier must correct defects and Buyer must verify closure before final account or final completion.', 'SUPPLIER', 'High', 'inspections', submittedDefects.length ? 'defect-verify' : 'defect-response');
    if (certifiedIpcs.length && !practicalCompletion) add('works-practical-completion-waiting', 'Practical completion certificate is waiting', 'Buyer must record practical completion and outstanding defects once Works are substantially complete.', 'BUYER', 'Medium', 'closeout', 'works-completion-certificate');
    if (practicalCompletion && !openDefects.length && !finalAccount) add('works-final-account-waiting', 'Final account is waiting', 'Buyer must record final account and retention release after defects and claims are cleared.', 'BUYER', 'Medium', 'closeout', 'works-completion-certificate');
    if (finalAccount && !openDefects.length && !finalCompletion) add('works-final-completion-waiting', 'Final completion certificate is waiting', 'Buyer must issue final completion before Works closeout.', 'BUYER', 'Medium', 'closeout', 'works-completion-certificate');
  }
  if (procurementType === 'SERVICES') {
    const serviceLevels = contract.serviceLevels ?? [];
    const servicePeriods = contract.servicePeriods ?? [];
    const openPeriods = servicePeriods.filter((item) => ['OPEN', 'ACTIVE', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const reports = contract.serviceReports ?? [];
    const submittedReports = reports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const approvedReports = reports.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const credits = contract.serviceCredits ?? [];
    const draftCredits = credits.filter((item) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(statusOf(item)).toUpperCase()));
    const openIncidents = (contract.serviceIncidents ?? []).filter((item) => isOpen(item.status));
    const submittedIncidents = openIncidents.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    if (!serviceLevels.length) add('services-no-sla', 'Service SLA is missing', 'Buyer must define SLA metrics, targets, and credit rules before service execution is complete.', 'BUYER', 'High', 'delivery', 'service-level');
    if (serviceLevels.length && !servicePeriods.length) add('services-no-period', 'Service period is missing', 'Buyer must open a service period before Supplier reports can be submitted.', 'BUYER', 'High', 'delivery', 'service-period');
    if (openPeriods.length && !reports.length) add('services-report-waiting', 'Service report is waiting', 'Supplier must submit service delivery summary, SLA evidence, incidents, complaints, and breach explanations.', 'SUPPLIER', 'Medium', 'delivery', 'service-report');
    if (submittedReports.length) add('services-report-review-waiting', 'Service report review is waiting', 'Buyer must verify SLA performance and approve, reject, or return the service report.', 'BUYER', 'High', 'delivery', 'service-report-review');
    if (approvedReports.length && draftCredits.length) add('services-credit-review-waiting', 'Service credit or penalty review is waiting', 'Buyer must approve, reject, or apply the service credit or penalty decision.', 'BUYER', 'Medium', 'finance', 'service-credit-review');
    if (openIncidents.length) add('open-service-incidents', 'Open service incident or complaint remains', 'Supplier must respond and Buyer must verify incident or complaint closure before service closeout.', 'SUPPLIER', 'High', 'risk', submittedIncidents.length ? 'service-incident-verify' : 'service-incident-response');
  }
  if (procurementType === 'CONSULTANCY') {
    const deliverables = contract.consultancyDeliverables ?? [];
    const versions = contract.deliverableVersions ?? [];
    const submittedVersions = versions.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const revisionVersions = versions.filter((item) => ['REVISION_REQUESTED', 'REVISION_REQUIRED', 'RETURNED'].includes(String(statusOf(item)).toUpperCase()));
    const approvedVersions = versions.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const payableReviews = (contract.deliverableReviews ?? []).filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>) && isTerminal(statusOf(item as Record<string, unknown>)));
    const finalReports = contract.consultancyFinalReports ?? [];
    const submittedFinalReports = finalReports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const approvedFinalReports = finalReports.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    if (!deliverables.length) add('consultancy-no-plan', 'Consultancy deliverable plan is missing', 'Buyer must define deliverables, acceptance criteria, due dates, and payment eligibility before submissions.', 'BUYER', 'High', 'delivery', 'consultancy-deliverable');
    if (deliverables.length && !versions.length) add('consultancy-version-waiting', 'Consultancy deliverable submission is waiting', 'Supplier must submit an immutable deliverable version against the plan.', 'SUPPLIER', 'Medium', 'delivery', 'deliverable-version');
    if (submittedVersions.length) add('consultancy-review-waiting', 'Consultancy technical review is waiting', 'Buyer must approve, reject, or request revision on submitted consultancy deliverables.', 'BUYER', 'High', 'inspections', 'deliverable-review');
    if (revisionVersions.length) add('consultancy-revision-waiting', 'Consultancy revision is waiting', 'Supplier must submit a revised version with correction notes against the requested revision.', 'SUPPLIER', 'High', 'delivery', 'deliverable-version');
    if (approvedVersions.length && !payableReviews.length && !deliverables.some((item) => isPayableConsultancyRecord(item as Record<string, unknown>))) add('consultancy-payment-eligibility-waiting', 'Payment eligibility decision is waiting', 'Buyer must confirm accepted amount and payment eligibility before invoice.', 'BUYER', 'High', 'finance', 'deliverable-payment-eligibility');
    if ((payableReviews.length || deliverables.some((item) => isPayableConsultancyRecord(item as Record<string, unknown>))) && !finalReports.length) add('consultancy-final-report-waiting', 'Final consultancy report is waiting', 'Supplier must submit the final report before contract closeout.', 'SUPPLIER', 'Medium', 'closeout', 'consultancy-final-report');
    if (submittedFinalReports.length) add('consultancy-final-report-review-waiting', 'Final report review is waiting', 'Buyer must approve or return the final consultancy report before closeout.', 'BUYER', 'High', 'closeout', 'consultancy-final-report-review');
    if (finalReports.length && !approvedFinalReports.length) add('consultancy-final-report-open', 'Final report remains open', 'Final consultancy report must be approved, accepted, or closed before closeout.', 'BUYER', 'High', 'closeout', 'consultancy-final-report-review');
  }
  const invoiceable = invoiceableRecordsFor(contract, procurementType);
  if (invoiceable.filter((item) => item.blockingReasons.length === 0).length === 0 && (contract.invoices ?? []).length === 0) {
    add('no-accepted-work', 'No accepted work is invoiceable', 'Supplier can invoice only after accepted, certified, or approved execution evidence exists.', 'SUPPLIER', 'High', 'finance', 'invoice');
  }
  if ((contract.invoices ?? []).some((invoice) => String(invoice.status ?? '').toUpperCase() === 'SUBMITTED')) {
    const matchedInvoiceIds = new Set((contract.threeWayMatches ?? []).filter((match) => String(match.status ?? '').toUpperCase() === 'MATCHED').map((match) => stringValue(match.invoiceId)));
    const hasUnmatched = (contract.invoices ?? []).some((invoice) => String(invoice.status ?? '').toUpperCase() === 'SUBMITTED' && !matchedInvoiceIds.has(stringValue(invoice.id)));
    if (hasUnmatched) add('invoice-match-pending', 'Invoice matching required', 'Submitted invoices must pass execution and three-way matching before payment approval.', 'BUYER', 'High', 'finance', 'three-way-match');
  }
  if ((contract.changeRequests ?? []).some((item) => isOpen(item.status))) add('open-change-requests', 'Change requests require decision', 'Open change requests must be reviewed, supplier impact captured, approved with a signed amendment, rejected, or closed before closeout.', 'BUYER', 'High', 'changes', 'change-request-review');
  if ((contract.variations ?? []).some((item) => isOpen(item.status))) add('open-variations', 'Variations require approval control', 'Variations must be rejected or approved only after a signed amendment is linked.', 'BUYER', 'High', 'changes', 'variation-review');
  if ((contract.extensionRequests ?? []).some((item) => isOpen(item.status))) add('open-extensions', 'Extension requests require decision', 'Extension requests must be reviewed, approved, or rejected before the contract can close.', 'BUYER', 'Medium', 'changes', 'extension-review');
  if ((contract.claims ?? []).some((claim) => isOpen(claim.status))) add('open-claims', 'Claims require decision', 'Open claims must be responded to, settled, rejected, or escalated before final closeout.', 'SHARED', 'Medium', 'claims', 'claim-response');
  if ((contract.disputes ?? []).some((item) => isOpen(item.status))) add('open-disputes', 'Disputes require resolution', 'Disputes must be responded to, resolved, or closed before final closeout.', 'SHARED', 'High', 'claims', 'dispute-resolve');
  if ((contract.terminations ?? []).some((item) => isOpen(item.status))) add('open-termination', 'Termination review remains active', 'Termination notices must be responded to, decided, settled, closed, or rejected before closeout can proceed.', 'BUYER', 'Critical', 'closeout', 'termination-decision');
  if ((contract.issues ?? []).some((issue) => isOpen(issue.status))) add('open-issues', 'Execution issues remain open', 'Resolve or formally escalate open issues before completion or closeout.', 'SHARED', 'Medium', 'risk', 'issue-resolve');
  if ((contract.nonConformances ?? []).some((item) => isOpen(item.status))) add('open-ncr', 'Corrective action is open', 'Non-conformances must be corrected and verified before acceptance, payment, or closeout.', 'SUPPLIER', 'High', 'risk', 'ncr-response');
  if ((contract.invoices ?? []).some((invoice) => ['SUBMITTED', 'REVIEW', 'MATCHED'].includes(String(invoice.status ?? '').toUpperCase()))) add('unsettled-invoices', 'Financial settlement is incomplete', 'Submitted or matched invoices must be paid, rejected, or returned before closeout.', 'BUYER', 'High', 'finance', 'payment-approval');
  if ((contract.notices ?? []).some((notice) => ['SENT', 'RECEIVED', 'ACKNOWLEDGED', 'RESPONDED', 'OPEN'].includes(String(notice.status ?? '').toUpperCase()))) add('open-notices', 'Formal notice workflow remains open', 'Formal notices must be acknowledged, responded to, or closed before final closeout.', 'SHARED', 'Medium', 'risk', 'notice-acknowledge');
  if ((contract.meetingActions ?? []).some((item) => isOpen(item.status))) add('open-meeting-actions', 'Meeting action items remain open', 'Meeting action items must be completed, verified, or closed before final closeout.', 'SHARED', 'Medium', 'history', 'meeting-action-complete');
  const securityExpiry = securityExpirySummaryFor(contract);
  if (securityExpiry.expired > 0 || securityExpiry.expiringSoon > 0) add('security-expiry-open', 'Guarantee or insurance expiry needs action', 'Expiring securities must be extended, released, claimed, or waived before closeout.', 'BUYER', securityExpiry.expired ? 'High' : 'Medium', 'documents', 'security-review');
  for (const blocker of financeCloseoutBlockersFor(contract)) blockers.push(blocker);
  if (!contract.supplierPerformanceRecords?.length && ['COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING'].includes(String(contract.status))) add('performance-missing', 'Supplier performance evaluation required', 'Complete supplier performance evaluation before closing the contract.', 'BUYER', 'Medium', 'performance', 'performance');
  return blockers;
}

function invoiceableRecordsFor(contract: ContractDetailDto, procurementType: PostAwardProcurementType) {
  const records: PostAwardFinancialEligibilityDto['invoiceableRecords'] = [];
  const acceptedReceiptIds = new Set((contract.acceptances ?? []).map((item) => payloadId(item, 'goodsReceiptId')).filter(Boolean));
  const acceptedInspectionIds = new Set((contract.acceptances ?? []).map((item) => payloadId(item, 'goodsInspectionId')).filter(Boolean));
  const push = (items: Array<Record<string, unknown>> | undefined, type: string, titleKey = 'title', options: { skipIds?: Set<string>; receiptQuantityAccepted?: boolean } = {}) => {
    for (const item of items ?? []) {
      const id = stringValue(item.id);
      if (!id || options.skipIds?.has(id)) continue;
      const status = statusOf(item);
      if (!isTerminal(status) && !(options.receiptQuantityAccepted && hasAcceptedReceiptQuantity(item))) continue;
      const acceptedAmount = acceptedAmountFor(item, type);
      const alreadyInvoicedAmount = invoicedAmountFor(contract, id);
      const remainingInvoiceableAmount = acceptedAmount === null ? null : Math.max(0, acceptedAmount - alreadyInvoicedAmount);
      const blockingReasons: string[] = [];
      if (remainingInvoiceableAmount !== null && remainingInvoiceableAmount <= 0) blockingReasons.push('Fully invoiced');
      records.push({
        id,
        type,
        title: stringValue(item[titleKey]) || stringValue(item.reference) || stringValue(item.certificateNo) || stringValue(item.certificateNumber) || stringValue(item.receiptReference) || stringValue(item.reportReference) || stringValue(item.deliverableCode) || humanType(type),
        amount: acceptedAmount ?? recordAmount(item),
        acceptedAmount,
        alreadyInvoicedAmount,
        remainingInvoiceableAmount,
        currency: stringValue(item.currency) || contract.currency,
        status,
        blockingReasons,
        executionReferenceType: type,
        executionReferenceId: id
      });
    }
  };
  push(contract.acceptances as Array<Record<string, unknown>>, 'acceptance', 'certificateNo');
  if (procurementType === 'GOODS') {
    push(contract.goodsReceipts as Array<Record<string, unknown>>, 'goods_receipt', 'receiptReference', { skipIds: acceptedReceiptIds, receiptQuantityAccepted: true });
    push(contract.goodsInspections as Array<Record<string, unknown>>, 'goods_inspection', 'inspectionNo', { skipIds: acceptedInspectionIds });
  }
  if (procurementType === 'WORKS') {
    push(contract.interimPaymentCertificates as Array<Record<string, unknown>>, 'interim_payment_certificate', 'certificateNumber');
    push((contract.worksCompletionCertificates ?? []).filter((item) => ['FINAL_ACCOUNT', 'FINAL_COMPLETION'].includes(String(item.certificateType ?? '').toUpperCase())) as Array<Record<string, unknown>>, 'works_completion_certificate', 'certificateNumber');
  }
  if (procurementType === 'SERVICES') {
    push(contract.serviceReports as Array<Record<string, unknown>>, 'service_report', 'reportReference');
    push((contract.serviceCredits ?? []).filter((item) => isPayableServiceDecision(item)) as Array<Record<string, unknown>>, 'service_credit', 'creditType');
  }
  if (procurementType === 'CONSULTANCY') {
    push((contract.consultancyDeliverables ?? []).filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>)) as Array<Record<string, unknown>>, 'consultancy_deliverable', 'deliverableCode');
    push((contract.deliverableVersions ?? []).filter((item) => {
      const payload = objectValue((item as Record<string, unknown>).payload);
      return payload.paymentEligible === true || (Array.isArray((item as Record<string, unknown>).reviews) && ((item as Record<string, unknown>).reviews as Array<Record<string, unknown>>).some((review) => isPayableConsultancyRecord(review) && isTerminal(statusOf(review))));
    }) as Array<Record<string, unknown>>, 'deliverable_version', 'versionNo');
    push((contract.deliverableReviews ?? []).filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>)) as Array<Record<string, unknown>>, 'deliverable_review', 'decision');
    push((contract.consultancyFinalReports ?? []).filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>)) as Array<Record<string, unknown>>, 'consultancy_final_report', 'reportReference');
  }
  return records;
}

function financeDerivedState(contract: ContractDetailDto) {
  const invoices = (contract.invoices ?? []) as Array<Record<string, unknown>>;
  const approvals = (contract.paymentApprovals ?? []) as Array<Record<string, unknown>>;
  const payments = (contract.payments ?? []) as Array<Record<string, unknown>>;
  const confirmations = (contract.paymentConfirmations ?? []) as Array<Record<string, unknown>>;
  const penalties = (contract.penalties ?? []) as Array<Record<string, unknown>>;
  const ipcs = (contract.interimPaymentCertificates ?? []) as Array<Record<string, unknown>>;
  const finalAccounts = ((contract.worksCompletionCertificates ?? []) as Array<Record<string, unknown>>).filter((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_ACCOUNT');
  const paymentSchedules = (contract.paymentSchedules ?? []) as Array<Record<string, unknown>>;
  const serviceCredits = (contract.serviceCredits ?? []) as Array<Record<string, unknown>>;
  const approvalInvoiceIds = new Set(approvals.filter((item) => ['MATCHED', 'PAID'].includes(String(item.status ?? '').toUpperCase())).map((item) => stringValue(item.invoiceId)).filter(Boolean));
  const recommendationInvoiceIds = new Set(approvals.filter((item) => String(item.stepKey ?? '').includes('recommend')).map((item) => stringValue(item.invoiceId)).filter(Boolean));
  const paidInvoiceIds = new Set(payments.filter((item) => String(item.status ?? '').toUpperCase() === 'PAID').map((item) => stringValue(item.invoiceId)).filter(Boolean));
  const confirmedInvoiceIds = new Set(confirmations.map((item) => stringValue(item.invoiceId)).filter(Boolean));
  const confirmedPaymentIds = new Set(confirmations.map((item) => stringValue(item.paymentId)).filter(Boolean));
  const paymentQueue: PostAwardFinancialEligibilityDto['paymentQueue'] = [];
  const pushQueue = (item: Record<string, unknown>, type: PostAwardFinancialEligibilityDto['paymentQueue'][number]['type'], title: string, actionKey: string, owner: 'BUYER' | 'SUPPLIER' | 'SHARED', blockingReasons: string[] = []) => {
    paymentQueue.push({
      id: stringValue(item.id) || `${type}-${paymentQueue.length}`,
      type,
      title,
      status: stringValue(item.status) || 'OPEN',
      amount: Number(recordAmount(item) ?? item.amountApproved ?? item.paidAmount ?? 0),
      currency: stringValue(item.currency) || contract.currency,
      invoiceId: stringValue(item.invoiceId) || (type === 'invoice' ? stringValue(item.id) : null),
      paymentId: stringValue(item.paymentId) || (type === 'payment' ? stringValue(item.id) : null),
      actionKey,
      owner,
      blockingReasons
    });
  };
  for (const invoice of invoices) {
    const status = String(invoice.status ?? '').toUpperCase();
    if (['SUBMITTED', 'REVIEW'].includes(status)) pushQueue(invoice, 'invoice', `Verify ${stringValue(invoice.reference) || 'invoice'}`, 'invoice-verify', 'BUYER');
    if (status === 'BLOCKED') pushQueue(invoice, 'invoice', `Correct ${stringValue(invoice.reference) || 'invoice'}`, 'invoice-correction', 'SUPPLIER');
    if (status === 'MATCHED' && !recommendationInvoiceIds.has(stringValue(invoice.id))) pushQueue(invoice, 'invoice', `Recommend payment for ${stringValue(invoice.reference) || 'invoice'}`, 'payment-recommendation', 'BUYER');
    if (status === 'MATCHED' && recommendationInvoiceIds.has(stringValue(invoice.id)) && !approvalInvoiceIds.has(stringValue(invoice.id))) pushQueue(invoice, 'invoice', `Approve payment for ${stringValue(invoice.reference) || 'invoice'}`, 'payment-approval-review', 'BUYER');
    if (status === 'MATCHED' && approvalInvoiceIds.has(stringValue(invoice.id)) && !paidInvoiceIds.has(stringValue(invoice.id))) pushQueue(invoice, 'invoice', `Record payment for ${stringValue(invoice.reference) || 'invoice'}`, 'payment-initiate', 'BUYER');
  }
  for (const payment of payments) {
    const status = String(payment.status ?? '').toUpperCase();
    if (['REVIEW', 'MATCHED'].includes(status)) pushQueue(payment, 'payment', `Complete payment ${stringValue(payment.id).slice(0, 8)}`, 'payment-complete', 'BUYER');
    if (status === 'PAID' && !confirmedPaymentIds.has(stringValue(payment.id)) && !confirmedInvoiceIds.has(stringValue(payment.invoiceId))) pushQueue(payment, 'payment', `Confirm receipt for payment ${stringValue(payment.id).slice(0, 8)}`, 'payment-confirmation', 'SUPPLIER');
  }
  for (const penalty of penalties.filter((item) => !['APPROVED', 'APPLIED', 'CLOSED', 'REJECTED'].includes(String(item.status ?? '').toUpperCase()))) {
    pushQueue(penalty, 'penalty', `Review ${stringValue(penalty.penaltyType) || 'deduction'}`, 'finance-deduction-review', 'BUYER');
  }
  const retainedAmount = [...payments, ...ipcs].reduce((total, item) => total + Number(item.retentionAmount ?? 0), 0);
  const releasedAmount = finalAccounts.reduce((total, item) => total + Number(item.retentionReleaseAmount ?? 0), 0);
  const remainingRetention = Math.max(0, retainedAmount - releasedAmount);
  const advanceAmount = Number(objectValue(contract.payload).advancePaymentAmount ?? objectValue(contract.managementPlan?.payload).advancePaymentAmount ?? 0);
  const recoveredAmount = [...payments, ...ipcs].reduce((total, item) => total + Number(item.advanceRecovery ?? item.advanceRecoveryAmount ?? 0), 0);
  const outstandingAmount = Math.max(0, advanceAmount - recoveredAmount);
  const pendingPenalties = penalties.filter((item) => !['APPROVED', 'APPLIED', 'CLOSED', 'REJECTED'].includes(String(item.status ?? '').toUpperCase()));
  const approvedPenalties = penalties.filter((item) => ['APPROVED', 'APPLIED', 'CLOSED'].includes(String(item.status ?? '').toUpperCase()));
  const pendingServiceCredits = serviceCredits.filter((item) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(item.status ?? '').toUpperCase()));
  const approvedServiceCredits = serviceCredits.filter((item) => ['APPROVED', 'APPLIED', 'CERTIFIED', 'CLOSED'].includes(String(item.status ?? '').toUpperCase()));
  const liquidated = (items: Array<Record<string, unknown>>) => items.filter((item) => /LIQUIDATED|DELAY|LD/i.test(`${item.penaltyType ?? ''} ${item.basis ?? ''} ${item.note ?? ''}`)).reduce((total, item) => total + Number(item.amount ?? 0), 0);
  const recommendedAmount = approvals.filter((item) => String(item.stepKey ?? '').includes('recommend')).reduce((total, item) => total + Number(item.amountApproved ?? 0), 0);
  const approvedAmount = approvals.filter((item) => ['MATCHED', 'PAID'].includes(String(item.status ?? '').toUpperCase())).reduce((total, item) => total + Number(item.amountApproved ?? 0), 0);
  const initiatedAmount = payments.filter((item) => ['REVIEW', 'MATCHED'].includes(String(item.status ?? '').toUpperCase())).reduce((total, item) => total + Number(item.netAmount ?? item.grossAmount ?? 0), 0);
  const completedAmount = payments.filter((item) => String(item.status ?? '').toUpperCase() === 'PAID').reduce((total, item) => total + Number(item.netAmount ?? item.grossAmount ?? 0), 0);
  const now = Date.now();
  const overduePaymentCount = paymentSchedules.filter((item) => isOpen(item.status) && stringValue(item.dueDate) && new Date(stringValue(item.dueDate)).getTime() < now).length;
  const supplierReceiptPending = payments.filter((item) => String(item.status ?? '').toUpperCase() === 'PAID' && !confirmedPaymentIds.has(stringValue(item.id)) && !confirmedInvoiceIds.has(stringValue(item.invoiceId))).length;
  return {
    paymentQueue,
    retentionSummary: {
      retainedAmount,
      releasedAmount,
      remainingRetention,
      currency: contract.currency,
      blockingReasons: remainingRetention > 0 ? ['Retention remains unresolved'] : []
    },
    advanceRecoverySummary: {
      recoveredAmount,
      outstandingAmount,
      currency: contract.currency,
      blockingReasons: outstandingAmount > 0 ? ['Advance recovery remains outstanding'] : []
    },
    deductionSummary: {
      pendingDeductionsAmount: pendingPenalties.reduce((total, item) => total + Number(item.amount ?? 0), 0) + pendingServiceCredits.reduce((total, item) => total + Number(item.invoiceImpactAmount ?? item.amount ?? 0), 0),
      approvedDeductionsAmount: approvedPenalties.reduce((total, item) => total + Number(item.amount ?? 0), 0) + approvedServiceCredits.reduce((total, item) => total + Number(item.invoiceImpactAmount ?? item.amount ?? 0), 0),
      liquidatedDamagesRecommended: liquidated(pendingPenalties),
      liquidatedDamagesApproved: liquidated(approvedPenalties) + payments.reduce((total, item) => total + Number(item.liquidatedDamages ?? 0), 0),
      currency: contract.currency
    },
    paymentStatusSummary: {
      recommendedAmount,
      approvedAmount,
      initiatedAmount,
      completedAmount,
      overduePaymentCount,
      currency: contract.currency
    },
    supplierReceiptPending
  };
}

function financeCloseoutBlockersFor(contract: ContractDetailDto): PostAwardBlockerDto[] {
  const finance = financeDerivedState(contract);
  const blockers: PostAwardBlockerDto[] = [];
  const add = (id: string, title: string, detail: string, owner: PostAwardBlockerDto['owner'], severity: PostAwardBlockerDto['severity'], actionKey: string) => {
    blockers.push({ id, title, detail, owner, severity, sectionId: 'finance', actionKey });
  };
  if (finance.paymentQueue.some((item) => ['payment-recommendation', 'payment-approval-review', 'payment-initiate', 'payment-complete'].includes(item.actionKey))) {
    add('finance-payment-workflow-open', 'Payment workflow remains open', 'Matched invoices must be recommended, approved, initiated, and completed before closeout.', 'BUYER', 'High', 'payment-approval-review');
  }
  if (finance.supplierReceiptPending > 0) add('finance-supplier-receipt-pending', 'Supplier payment receipt confirmation pending', 'Supplier must confirm completed payment receipt before financial closeout.', 'SUPPLIER', 'Medium', 'payment-confirmation');
  if (finance.retentionSummary.remainingRetention > 0) add('finance-retention-open', 'Retention remains unresolved', 'Retained amounts must be released, transferred to warranty, or formally closed before final closeout.', 'BUYER', 'Medium', 'finance-retention');
  if (finance.advanceRecoverySummary.outstandingAmount > 0) add('finance-advance-open', 'Advance recovery remains outstanding', 'Advance payment recovery must be completed or formally waived before closeout.', 'BUYER', 'High', 'finance-advance-recovery');
  if (finance.deductionSummary.pendingDeductionsAmount > 0) add('finance-deductions-open', 'Deductions need review', 'Penalties, credits, liquidated damages, and other deductions must be approved or rejected before closeout.', 'BUYER', 'Medium', 'finance-deduction-review');
  return blockers;
}

function financialEligibilityFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardFinancialEligibilityDto {
  const procurementType = procurementTypeFor(contract);
  const invoices = contract.invoices ?? [];
  const payments = contract.payments ?? [];
  const finance = financeDerivedState(contract);
  return {
    invoiceableRecords: invoiceableRecordsFor(contract, procurementType),
    paymentQueue: finance.paymentQueue,
    retentionSummary: finance.retentionSummary,
    advanceRecoverySummary: finance.advanceRecoverySummary,
    deductionSummary: finance.deductionSummary,
    paymentStatusSummary: finance.paymentStatusSummary,
    supplierReceiptPending: finance.supplierReceiptPending,
    financialCloseoutBlockers: blockers.filter((blocker) => blocker.id.startsWith('finance-')),
    blockedReasons: blockers.filter((blocker) => blocker.sectionId === 'finance' || blocker.id === 'no-accepted-work'),
    submittedInvoiceCount: invoices.filter((invoice) => ['SUBMITTED', 'REVIEW'].includes(String(invoice.status ?? '').toUpperCase())).length,
    matchedInvoiceCount: invoices.filter((invoice) => String(invoice.status ?? '').toUpperCase() === 'MATCHED').length,
    payableAmount: invoices.filter((invoice) => String(invoice.status ?? '').toUpperCase() === 'MATCHED').reduce((total, invoice) => total + Number(invoice.amount ?? 0), 0),
    paidAmount: payments.filter((payment) => String(payment.status ?? '').toUpperCase() === 'PAID').reduce((total, payment) => total + Number(payment.netAmount ?? payment.grossAmount ?? 0), 0),
    currency: contract.currency
  };
}

function daysUntil(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / (24 * 60 * 60 * 1000));
}

function operationalReadinessFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardOperationalReadinessDto {
  const items = contract.activationItems ?? [];
  const openItems = items.filter((item) => !isTerminal(item.status));
  const submitted = items.filter((item) => ['SUBMITTED', 'REVIEW'].includes(String(item.status ?? '').toUpperCase()));
  const approved = items.filter((item) => ['APPROVED', 'WAIVED', 'CLOSED'].includes(String(item.status ?? '').toUpperCase()));
  const blockingSecurities = (contract.securities ?? []).filter((item) => !['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'].includes(String(item.verificationStatus ?? item.status ?? '').toUpperCase()));
  const openDocuments = (contract.requiredDocuments ?? []).filter((item) => isOpen(item.status));
  const readinessBlockers = blockers.filter((blocker) => ['missing-cmp', 'activation-items-open', 'security-not-approved'].includes(blocker.id));
  return {
    ready: readinessBlockers.length === 0,
    activationStatus: stringValue(contract.activation?.status) || 'NOT_STARTED',
    managerAssigned: Boolean(contract.managementPlan?.contractManagerId),
    managementPlanReady: Boolean(contract.managementPlan),
    activationItems: { total: items.length, open: openItems.length, submitted: submitted.length, approved: approved.length },
    securities: { total: contract.securities?.length ?? 0, blocking: blockingSecurities.length },
    requiredDocuments: { total: contract.requiredDocuments?.length ?? 0, open: openDocuments.length },
    blockers: readinessBlockers
  };
}

function urgentActionsFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardUrgentActionDto[] {
  const fromRecords = (contract.urgentActions ?? [])
    .filter((item) => String(item.status ?? '').toUpperCase() === 'OPEN')
    .map((item) => ({
      id: stringValue(item.id),
      title: stringValue(item.title) || 'Urgent action',
      detail: stringValue(item.note) || 'Workflow action requires attention.',
      owner: 'SHARED' as const,
      priority: priorityFromRisk(stringValue(objectValue(item.payload).riskLevel) || stringValue(item.status)),
      dueDate: item.dueDate ?? null,
      actionKey: stringValue(objectValue(item.payload).actionKey) || 'urgent-action',
      sectionId: sectionFromRoute(stringValue(objectValue(item.payload).nextRoute))
    }));
  const fromBlockers = blockers
    .filter((blocker) => blocker.severity === 'Critical' || blocker.severity === 'High')
    .map((blocker) => ({
      id: `blocker-${blocker.id}`,
      title: blocker.title,
      detail: blocker.detail,
      owner: blocker.owner,
      priority: blocker.severity,
      dueDate: null,
      actionKey: blocker.actionKey,
      sectionId: blocker.sectionId
    }));
  return [...fromRecords, ...fromBlockers].slice(0, 12);
}

function priorityFromRisk(value: string): PostAwardUrgentActionDto['priority'] {
  const normalized = value.toUpperCase();
  if (normalized.includes('CRITICAL')) return 'Critical';
  if (normalized.includes('HIGH')) return 'High';
  if (normalized.includes('LOW')) return 'Low';
  return 'Medium';
}

function sectionFromRoute(value: string): PostAwardStageDto['id'] {
  const match = stageIds.find((id) => value.includes(`stage=${id}`));
  return match ?? 'history';
}

const stageIds: PostAwardStageDto['id'][] = ['setup', 'delivery', 'inspections', 'finance', 'risk', 'changes', 'claims', 'documents', 'closeout', 'performance', 'history'];

function communicationSummaryFor(contract: ContractDetailDto): PostAwardCommunicationSummaryDto {
  const notices = contract.notices ?? [];
  const open = notices.filter((item) => !['CLOSED', 'CANCELLED', 'REJECTED'].includes(String(item.status ?? '').toUpperCase()));
  return {
    totalNotices: notices.length,
    openNotices: open.length,
    awaitingAcknowledgement: open.filter((item) => ['SENT', 'RECEIVED'].includes(String(item.status ?? '').toUpperCase())).length,
    awaitingResponse: open.filter((item) => ['ACKNOWLEDGED', 'NOTICE_TO_CORRECT', 'OPEN'].includes(String(item.status ?? '').toUpperCase())).length,
    overdueNotices: open.filter((item) => {
      const days = daysUntil(item.dueDate);
      return days !== null && days < 0;
    }).length
  };
}

function meetingActionSummaryFor(contract: ContractDetailDto): PostAwardMeetingActionSummaryDto {
  const actions = contract.meetingActions ?? [];
  const open = actions.filter((item) => isOpen(item.status));
  return {
    totalMeetings: contract.meetings?.length ?? 0,
    openActions: open.length,
    supplierActions: open.filter((item) => String(item.ownerRole ?? '').toUpperCase() === 'SUPPLIER').length,
    buyerActions: open.filter((item) => String(item.ownerRole ?? '').toUpperCase() === 'BUYER').length,
    overdueActions: open.filter((item) => {
      const days = daysUntil(item.dueDate);
      return days !== null && days < 0;
    }).length
  };
}

function securityExpirySummaryFor(contract: ContractDetailDto): PostAwardSecurityExpirySummaryDto {
  const securities = contract.securities ?? [];
  const active = securities.filter((item) => !['RELEASED', 'WAIVED', 'CLAIMED', 'CLOSED'].includes(String(item.verificationStatus ?? item.status ?? item.claimStatus ?? '').toUpperCase()));
  return {
    total: securities.length,
    expiringSoon: active.filter((item) => {
      const days = daysUntil(item.expiryDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    expired: active.filter((item) => {
      const days = daysUntil(item.expiryDate);
      return days !== null && days < 0;
    }).length,
    unresolved: active.filter((item) => !['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'].includes(String(item.verificationStatus ?? item.status ?? '').toUpperCase())).length
  };
}

function warrantySummaryFor(contract: ContractDetailDto): PostAwardWarrantySummaryDto {
  const warranties = contract.warranties ?? [];
  const open = warranties.filter((item) => isOpen(item.status));
  return {
    total: warranties.length,
    open: open.length,
    awaitingSupplier: open.filter((item) => !['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase())).length,
    awaitingBuyer: open.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase())).length,
    expiringSoon: open.filter((item) => {
      const days = daysUntil(item.dueDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
    overdue: open.filter((item) => {
      const days = daysUntil(item.dueDate);
      return days !== null && days < 0;
    }).length
  };
}

function performanceReadinessFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardPerformanceReadinessDto {
  const milestoneCount = contract.milestones.length || 1;
  const acceptedCountValue = acceptedCount(contract);
  const rejectedInspections = [...(contract.goodsInspections ?? []), ...(contract.inspections ?? [])].filter((item) => /REJECT|FAIL/i.test(statusOf(item))).length;
  const submittedInvoices = (contract.invoices ?? []).filter((item) => ['SUBMITTED', 'REVIEW', 'BLOCKED', 'REJECTED'].includes(String(item.status ?? '').toUpperCase())).length;
  const openControls = ['changeRequests', 'claims', 'disputes', 'nonConformances', 'issues'].reduce((total, key) => total + (((contract as unknown as Record<string, Array<Record<string, unknown>> | undefined>)[key] ?? []).filter((item) => isOpen(item.status)).length), 0);
  const performanceBlockers = blockers.filter((blocker) => blocker.sectionId === 'performance' || blocker.id === 'performance-missing');
  return {
    ready: performanceBlockers.length === 0,
    systemMetrics: [
      { key: 'completion-rate', label: 'Milestone completion', value: Math.round((contract.milestones.filter((item) => isTerminal(item.status)).length / milestoneCount) * 100), tone: 'info' },
      { key: 'acceptances', label: 'Accepted outputs', value: acceptedCountValue, tone: acceptedCountValue ? 'success' : 'warning' },
      { key: 'quality-exceptions', label: 'Quality exceptions', value: rejectedInspections, tone: rejectedInspections ? 'error' : 'success' },
      { key: 'invoice-exceptions', label: 'Invoice exceptions', value: submittedInvoices, tone: submittedInvoices ? 'warning' : 'success' },
      { key: 'open-controls', label: 'Open control workflows', value: openControls, tone: openControls ? 'warning' : 'success' }
    ],
    evaluatorRecords: contract.supplierPerformanceRecords?.length ?? 0,
    blockers: performanceBlockers
  };
}

function closeoutReadinessFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardCloseoutReadinessDto {
  const groups: Array<[string, string, PostAwardStageDto['id'][]]> = [
    ['execution', 'Execution and acceptance', ['delivery', 'inspections']],
    ['finance', 'Financial settlement', ['finance']],
    ['controls', 'Claims, controls, and disputes', ['risk', 'changes', 'claims']],
    ['documents', 'Documents, securities, and warranty', ['documents']],
    ['performance', 'Performance evaluation', ['performance']],
    ['closeout', 'Closeout records and lessons', ['closeout', 'history']]
  ];
  const closeoutPayload = objectValue(contract.closeout?.payload);
  const stepsPayload = objectValue(closeoutPayload.steps);
  const steps = groups.map(([id, label, sectionIds]) => {
    const stepPayload = objectValue(stepsPayload[id]);
    const related = blockers.filter((blocker) => sectionIds.includes(blocker.sectionId));
    const manuallyDone = ['APPROVED', 'CLOSED', 'DONE'].includes(String(stepPayload.status ?? '').toUpperCase());
    return {
      id,
      label,
      status: manuallyDone ? 'DONE' as const : related.length ? 'BLOCKED' as const : 'READY' as const,
      blockerIds: related.map((blocker) => blocker.id)
    };
  });
  return {
    ready: steps.every((step) => step.status !== 'BLOCKED') && blockers.length === 0,
    steps,
    blockers
  };
}

function tasksFor(contract: ContractDetailDto, procurementType: PostAwardProcurementType, owner: 'BUYER' | 'SUPPLIER', blockers: PostAwardBlockerDto[], financial: PostAwardFinancialEligibilityDto): PostAwardTaskDto[] {
  const tasks: PostAwardTaskDto[] = [];
  const blockerIdsFor = (actionKey: string) => blockers.filter((blocker) => blocker.actionKey === actionKey).map((blocker) => blocker.id);
  const add = (id: string, title: string, detail: string, taskOwner: PostAwardTaskDto['owner'], priority: PostAwardTaskDto['priority'], status: PostAwardTaskDto['status'], actionKey: string, sectionId: PostAwardStageDto['id'], dueDate: string | null = null, visibility: PostAwardVisibilityScope = 'SHARED') => {
    if (taskOwner !== owner && taskOwner !== 'SHARED') return;
    tasks.push({ id, title, detail, owner: taskOwner, priority, status, actionKey, sectionId, dueDate, blockerIds: blockerIdsFor(actionKey), visibility });
  };

  add('cmp', 'Complete contract management plan', 'Set objectives, responsibilities, monitoring, reporting, and escalation procedures.', 'BUYER', contract.managementPlan ? 'Low' : 'High', contract.managementPlan ? 'DONE' : 'READY', 'management-plan', 'setup', null, 'BUYER_PRIVATE');
  add('cmp-draft', 'Generate CMP draft', 'Auto-build a management plan draft from contract, tender, milestones, obligations, securities, and payment terms.', 'BUYER', contract.managementPlan ? 'Low' : 'High', contract.managementPlan ? 'WAITING' : 'READY', 'management-plan-draft', 'setup', null, 'BUYER_PRIVATE');
  const activationOpen = (contract.activationItems ?? []).filter((item) => !isTerminal(item.status));
  add('activation-submit', 'Submit activation evidence', 'Attach or confirm required activation documents and responsibilities.', 'SUPPLIER', activationOpen.length ? 'High' : 'Low', activationOpen.length ? 'READY' : 'DONE', 'activation-submit', 'setup', activationOpen[0]?.dueDate ?? null);
  add('activation-review', 'Review activation checklist', 'Approve, reject, waive, or close submitted activation items.', 'BUYER', activationOpen.length ? 'High' : 'Low', activationOpen.length ? 'READY' : 'DONE', 'activation-review', 'setup', activationOpen[0]?.dueDate ?? null);

  if (procurementType === 'GOODS') {
    const schedules = contract.deliverySchedules ?? [];
    const dispatches = contract.dispatchNotices ?? [];
    const receipts = contract.goodsReceipts ?? [];
    const inspections = contract.goodsInspections ?? [];
    const receiptDispatchIds = new Set(receipts.map((receipt) => payloadId(receipt, 'dispatchNoticeId')).filter(Boolean));
    const dispatchScheduleIds = new Set(dispatches.map((dispatch) => payloadId(dispatch, 'scheduleId')).filter(Boolean));
    const inspectionReceiptIds = new Set(inspections.map((inspection) => payloadId(inspection, 'goodsReceiptId', 'receiptId')).filter(Boolean));
    const acceptedReceiptIds = new Set((contract.acceptances ?? []).map((acceptance) => payloadId(acceptance, 'goodsReceiptId')).filter(Boolean));
    const acceptedInspectionIds = new Set((contract.acceptances ?? []).map((acceptance) => payloadId(acceptance, 'goodsInspectionId')).filter(Boolean));
    const schedulesNeedingDispatch = schedules.filter((schedule) => !dispatchScheduleIds.has(stringValue(schedule.id)));
    const dispatchesNeedingReceipt = dispatches.filter((dispatch) => !receiptDispatchIds.has(stringValue(dispatch.id)));
    const receiptsNeedingInspection = receipts.filter((receipt) => !inspectionReceiptIds.has(stringValue(receipt.id)));
    const inspectionsNeedingAcceptance = inspections.filter((inspection) => isTerminal(statusOf(inspection)) && !acceptedInspectionIds.has(stringValue(inspection.id)));
    const receiptsNeedingAcceptance = receipts.filter((receipt) => (isTerminal(statusOf(receipt)) || hasAcceptedReceiptQuantity(receipt)) && !acceptedReceiptIds.has(stringValue(receipt.id)));
    const acceptanceReady = inspectionsNeedingAcceptance.length > 0 || receiptsNeedingAcceptance.length > 0;
    add('goods-schedule', 'Create goods delivery schedule', 'Define item, quantity, location, delivery date, and milestone link.', 'BUYER', schedules.length ? 'Low' : 'High', schedules.length ? 'DONE' : 'READY', 'goods-delivery-schedule', 'delivery');
    add('dispatch', 'Submit dispatch notice', 'Supplier records carrier, tracking, quantity, packing list, and expected arrival.', 'SUPPLIER', schedulesNeedingDispatch.length ? 'High' : 'Medium', schedules.length ? (schedulesNeedingDispatch.length ? 'READY' : 'DONE') : 'BLOCKED', 'dispatch-notice', 'delivery');
    add('receipt', 'Record goods receipt', 'Buyer records received, damaged, rejected, and accepted quantities without automatic acceptance.', 'BUYER', dispatchesNeedingReceipt.length ? 'High' : 'Medium', dispatches.length ? (dispatchesNeedingReceipt.length ? 'READY' : 'DONE') : 'BLOCKED', 'goods-receipt', 'delivery');
    add('goods-inspection', 'Inspect received goods', 'Pass, fail, partially accept, or require reinspection before invoice eligibility.', 'BUYER', receiptsNeedingInspection.length ? 'High' : 'Medium', receipts.length ? (receiptsNeedingInspection.length ? 'READY' : 'DONE') : 'BLOCKED', 'goods-inspection', 'inspections');
    add('acceptance', 'Issue acceptance decision', 'Create an acceptance, partial acceptance, or rejection certificate against inspected goods.', 'BUYER', acceptanceReady ? 'High' : 'Medium', acceptanceReady ? 'READY' : acceptedCount(contract) ? 'DONE' : 'BLOCKED', 'acceptance', 'inspections');
  } else if (procurementType === 'WORKS') {
    const siteHandovers = contract.siteHandovers ?? [];
    const progressReports = contract.worksProgressReports ?? [];
    const submittedProgress = progressReports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const approvedProgress = progressReports.filter((item) => isTerminal(statusOf(item)));
    const measurements = contract.boqMeasurements ?? [];
    const measurementsForReview = measurements.filter((item) => ['MEASURED', 'SUBMITTED', 'REVIEW', 'DRAFT'].includes(String(statusOf(item)).toUpperCase()));
    const approvedMeasurements = measurements.filter((item) => ['APPROVED', 'CERTIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const ipcs = contract.interimPaymentCertificates ?? [];
    const draftIpcs = ipcs.filter((item) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(statusOf(item)).toUpperCase()));
    const certifiedIpcs = ipcs.filter((item) => ['APPROVED', 'CERTIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const openDefects = (contract.defects ?? []).filter((item) => isOpen(item.status));
    const supplierDefects = openDefects.filter((item) => !['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    const buyerDefects = openDefects.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    const practicalCompletion = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'PRACTICAL_COMPLETION' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    const finalAccount = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_ACCOUNT' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    const finalCompletion = (contract.worksCompletionCertificates ?? []).some((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_COMPLETION' && !['REJECTED', 'CANCELLED'].includes(String(item.status ?? '').toUpperCase()));
    add('site-handover', 'Complete site handover', 'Record possession date, site condition, access, documents, photos, constraints, and readiness.', 'BUYER', siteHandovers.length ? 'Low' : 'High', siteHandovers.length ? 'DONE' : 'READY', 'site-handover', 'delivery');
    add('works-progress', 'Submit works progress report', 'Supplier reports programme reference, progress, labour, plant, materials, delays, safety, weather, and evidence.', 'SUPPLIER', siteHandovers.length ? 'High' : 'Medium', progressReports.length ? 'READY' : siteHandovers.length ? 'READY' : 'BLOCKED', 'works-progress', 'delivery');
    add('works-progress-review', 'Review works progress report', 'Buyer approves, rejects, or returns the supplier progress report before BOQ measurement.', 'BUYER', submittedProgress.length ? 'High' : 'Medium', submittedProgress.length ? 'READY' : approvedProgress.length ? 'DONE' : 'BLOCKED', 'works-progress-review', 'delivery');
    add('boq-measurement', 'Record BOQ measurement', 'Buyer verifies previous, current, cumulative, unit-rate, measured amount, and certified quantity.', 'BUYER', approvedProgress.length ? 'High' : 'Medium', measurements.length ? 'READY' : approvedProgress.length ? 'READY' : 'BLOCKED', 'boq-measurement', 'delivery');
    add('boq-measurement-review', 'Approve BOQ measurement', 'Buyer certifies measured quantities and amount before IPC issuance.', 'BUYER', measurementsForReview.length ? 'High' : 'Medium', measurementsForReview.length ? 'READY' : approvedMeasurements.length ? 'DONE' : 'BLOCKED', 'boq-measurement-review', 'delivery');
    add('ipc', 'Issue interim payment certificate', 'Create IPC from approved measurement, including gross, retention, recovery, damages, tax, and net payable.', 'BUYER', approvedMeasurements.length ? 'High' : 'Medium', ipcs.length ? 'READY' : approvedMeasurements.length ? 'READY' : 'BLOCKED', 'interim-payment-certificate', 'finance');
    add('ipc-certify', 'Certify interim payment certificate', 'Approve the IPC net payable and deductions before supplier invoice eligibility.', 'BUYER', draftIpcs.length ? 'High' : 'Medium', draftIpcs.length ? 'READY' : certifiedIpcs.length ? 'DONE' : 'BLOCKED', 'ipc-certify', 'finance');
    add('defect-report', 'Record Works defect', 'Buyer records defects, source, severity, responsible party, due date, and response deadline.', 'BUYER', openDefects.length ? 'High' : 'Medium', 'READY', 'contract-defect', 'inspections');
    add('defect-response', 'Respond to defect correction', 'Supplier submits corrective action and evidence for open defects.', 'SUPPLIER', supplierDefects.length ? 'High' : 'Medium', supplierDefects.length ? 'READY' : openDefects.length ? 'WAITING' : 'DONE', 'defect-response', 'inspections');
    add('defect-verify', 'Verify defect correction', 'Buyer verifies supplier evidence and closes, rejects, or keeps the defect open.', 'BUYER', buyerDefects.length ? 'High' : 'Medium', buyerDefects.length ? 'READY' : openDefects.length ? 'WAITING' : 'DONE', 'defect-verify', 'inspections');
    add('works-completion', 'Record Works completion certificate', 'Issue practical completion, final account, or final completion after required gates are clear.', 'BUYER', certifiedIpcs.length ? 'High' : 'Medium', finalCompletion ? 'DONE' : certifiedIpcs.length ? 'READY' : 'BLOCKED', 'works-completion-certificate', 'closeout');
    add('final-account', 'Confirm final account and retention', 'Record final account amount, retention release, outstanding works, and completion evidence.', 'BUYER', practicalCompletion ? 'High' : 'Medium', finalAccount ? 'DONE' : practicalCompletion && !openDefects.length ? 'READY' : 'BLOCKED', 'works-completion-certificate', 'closeout');
    add('final-completion', 'Issue final completion certificate', 'Confirm defects, claims, financials, documents, and performance are ready for closeout.', 'BUYER', finalAccount ? 'High' : 'Medium', finalCompletion ? 'DONE' : finalAccount && !openDefects.length ? 'READY' : 'BLOCKED', 'works-completion-certificate', 'closeout');
  } else if (procurementType === 'SERVICES') {
    const serviceLevels = contract.serviceLevels ?? [];
    const servicePeriods = contract.servicePeriods ?? [];
    const openPeriods = servicePeriods.filter((item) => ['OPEN', 'ACTIVE', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const reports = contract.serviceReports ?? [];
    const submittedReports = reports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const returnedReports = reports.filter((item) => ['REJECTED', 'REVISION_REQUIRED', 'RETURNED'].includes(String(statusOf(item)).toUpperCase()));
    const approvedReports = reports.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const credits = contract.serviceCredits ?? [];
    const draftCredits = credits.filter((item) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(statusOf(item)).toUpperCase()));
    const approvedCredits = credits.filter((item) => ['APPROVED', 'APPLIED', 'CERTIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const openIncidents = (contract.serviceIncidents ?? []).filter((item) => isOpen(item.status));
    const supplierIncidents = openIncidents.filter((item) => !['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    const buyerIncidents = openIncidents.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
    add('sla', 'Define service SLA', 'Set availability, response, resolution, quality, evidence, credit, and reporting measures.', 'BUYER', serviceLevels.length ? 'Low' : 'High', serviceLevels.length ? 'DONE' : 'READY', 'service-level', 'delivery');
    add('service-period', 'Open service period', 'Create the reporting period that supplier reports and SLA measurements attach to.', 'BUYER', serviceLevels.length ? 'Medium' : 'High', servicePeriods.length ? 'DONE' : serviceLevels.length ? 'READY' : 'BLOCKED', 'service-period', 'delivery');
    add('service-report', 'Submit service report and SLA evidence', 'Supplier submits SLA evidence, incidents, complaints, breach explanation, and corrective actions.', 'SUPPLIER', openPeriods.length || returnedReports.length ? 'High' : 'Medium', returnedReports.length || openPeriods.length ? 'READY' : 'BLOCKED', 'service-report', 'delivery');
    add('service-report-review', 'Review service report and SLA result', 'Buyer verifies SLA measurements, accepted value, breach result, and report decision.', 'BUYER', submittedReports.length ? 'High' : 'Medium', submittedReports.length ? 'READY' : approvedReports.length ? 'DONE' : 'BLOCKED', 'service-report-review', 'delivery');
    add('service-incident', 'Record service incident or complaint', 'Buyer records service failure, complaint, severity, responsible party, and response deadline.', 'BUYER', openIncidents.length ? 'High' : 'Medium', 'READY', 'service-incident', 'risk');
    add('service-incident-response', 'Respond to service incident', 'Supplier explains breach, submits corrective action, and attaches evidence.', 'SUPPLIER', supplierIncidents.length ? 'High' : 'Medium', supplierIncidents.length ? 'READY' : openIncidents.length ? 'WAITING' : 'DONE', 'service-incident-response', 'risk');
    add('service-incident-verify', 'Verify service incident correction', 'Buyer verifies supplier response and closes, rejects, or keeps the incident open.', 'BUYER', buyerIncidents.length ? 'High' : 'Medium', buyerIncidents.length ? 'READY' : openIncidents.length ? 'WAITING' : 'DONE', 'service-incident-verify', 'risk');
    add('service-credit', 'Create service credit or penalty', 'Buyer records contractually valid credit, penalty, deduction, or payable adjustment.', 'BUYER', approvedReports.length ? 'Medium' : 'Low', approvedReports.length ? 'READY' : 'WAITING', 'service-credit', 'finance');
    add('service-credit-review', 'Approve service credit or penalty', 'Buyer applies, rejects, or approves the credit/penalty decision before finance proceeds.', 'BUYER', draftCredits.length ? 'High' : 'Medium', draftCredits.length ? 'READY' : approvedCredits.length ? 'DONE' : 'WAITING', 'service-credit-review', 'finance');
  } else if (procurementType === 'CONSULTANCY') {
    const deliverables = contract.consultancyDeliverables ?? [];
    const versions = contract.deliverableVersions ?? [];
    const submittedVersions = versions.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const revisionVersions = versions.filter((item) => ['REVISION_REQUESTED', 'REVISION_REQUIRED', 'RETURNED'].includes(String(statusOf(item)).toUpperCase()));
    const approvedVersions = versions.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    const reviews = contract.deliverableReviews ?? [];
    const payableReviews = reviews.filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>) && isTerminal(statusOf(item as Record<string, unknown>)));
    const finalReports = contract.consultancyFinalReports ?? [];
    const submittedFinalReports = finalReports.filter((item) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(statusOf(item)).toUpperCase()));
    const approvedFinalReports = finalReports.filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(statusOf(item)).toUpperCase()));
    add('consultancy-plan', 'Create deliverable plan', 'Define deliverable code, due date, acceptance criteria, amount, final report marker, and payment eligibility.', 'BUYER', deliverables.length ? 'Low' : 'High', deliverables.length ? 'DONE' : 'READY', 'consultancy-deliverable', 'delivery');
    add('deliverable-version', revisionVersions.length ? 'Submit revised consultancy version' : 'Submit consultancy deliverable version', 'Supplier submits immutable versions with correction notes and evidence.', 'SUPPLIER', deliverables.length ? 'High' : 'Medium', revisionVersions.length || (deliverables.length && !submittedVersions.length && !approvedVersions.length) ? 'READY' : deliverables.length ? 'DONE' : 'BLOCKED', 'deliverable-version', 'delivery');
    add('deliverable-review', 'Review consultancy deliverable version', 'Buyer records technical comments, revision decision, accepted amount, and payment eligibility.', 'BUYER', submittedVersions.length ? 'High' : 'Medium', submittedVersions.length ? 'READY' : hasApprovedConsultancy(contract) ? 'DONE' : 'BLOCKED', 'deliverable-review', 'inspections');
    add('deliverable-payment-eligibility', 'Confirm consultancy payment eligibility', 'Buyer confirms accepted amount and whether an approved review can be invoiced.', 'BUYER', approvedVersions.length ? 'High' : 'Medium', payableReviews.length || deliverables.some((item) => isPayableConsultancyRecord(item as Record<string, unknown>)) ? 'DONE' : approvedVersions.length || reviews.length ? 'READY' : 'BLOCKED', 'deliverable-payment-eligibility', 'finance');
    add('consultancy-final-report', 'Submit consultancy final report', 'Supplier submits the final report, lessons, outputs, and completion evidence.', 'SUPPLIER', payableReviews.length ? 'High' : 'Medium', finalReports.length ? 'DONE' : payableReviews.length || deliverables.some((item) => isPayableConsultancyRecord(item as Record<string, unknown>)) ? 'READY' : 'BLOCKED', 'consultancy-final-report', 'closeout');
    add('consultancy-final-report-review', 'Review consultancy final report', 'Buyer approves, returns, or closes the final report before performance and closeout.', 'BUYER', submittedFinalReports.length ? 'High' : 'Medium', submittedFinalReports.length ? 'READY' : approvedFinalReports.length ? 'DONE' : 'BLOCKED', 'consultancy-final-report-review', 'closeout');
  }

  const invoiceReadyRecords = financial.invoiceableRecords.filter((record) => record.blockingReasons.length === 0);
  const financeQueueByAction = (actionKey: string) => financial.paymentQueue.filter((item) => item.actionKey === actionKey);
  add('invoice', 'Submit invoice linked to accepted work', 'Invoice must reference accepted/certified execution evidence and stay within remaining accepted value.', 'SUPPLIER', invoiceReadyRecords.length ? 'High' : 'Medium', invoiceReadyRecords.length ? 'READY' : 'BLOCKED', 'invoice', 'finance');
  add('invoice-correction', 'Correct returned invoice', 'Supplier corrects returned or blocked invoice details while keeping Buyer correction reasons visible.', 'SUPPLIER', financeQueueByAction('invoice-correction').length ? 'High' : 'Medium', financeQueueByAction('invoice-correction').length ? 'READY' : 'WAITING', 'invoice-correction', 'finance');
  add('invoice-verify', 'Verify submitted invoice', 'Buyer checks invoice references, execution evidence, amount, tax, and correction needs before matching or return.', 'BUYER', financeQueueByAction('invoice-verify').length ? 'High' : 'Medium', financeQueueByAction('invoice-verify').length ? 'READY' : 'WAITING', 'invoice-verify', 'finance', null, 'BUYER_PRIVATE');
  add('match', 'Run or review three-way match', 'Reconcile contract/order, receipt/acceptance, and invoice before approval.', 'BUYER', financial.submittedInvoiceCount ? 'High' : 'Low', financial.submittedInvoiceCount ? 'READY' : 'WAITING', 'three-way-match', 'finance');
  add('payment-recommendation', 'Recommend payment', 'Finance recommends gross, deductions, retention, advance recovery, LD, tax, and net payable.', 'BUYER', financeQueueByAction('payment-recommendation').length ? 'High' : 'Medium', financeQueueByAction('payment-recommendation').length ? 'READY' : 'WAITING', 'payment-recommendation', 'finance', null, 'BUYER_PRIVATE');
  add('payment-approval-review', 'Approve payment decision', 'Authorized Buyer signs payment approval after match and deduction review are complete.', 'BUYER', financeQueueByAction('payment-approval-review').length ? 'High' : 'Medium', financeQueueByAction('payment-approval-review').length ? 'READY' : financial.matchedInvoiceCount ? 'READY' : 'BLOCKED', 'payment-approval-review', 'finance', null, 'BUYER_PRIVATE');
  add('payment-initiate', 'Initiate payment record', 'Buyer records payment initiation, reference, deductions, and expected completion.', 'BUYER', financeQueueByAction('payment-initiate').length ? 'High' : 'Medium', financeQueueByAction('payment-initiate').length ? 'READY' : 'WAITING', 'payment-initiate', 'finance', null, 'BUYER_PRIVATE');
  add('payment-complete', 'Complete payment', 'Buyer records completed payment, paid date, payment reference, and final net amount.', 'BUYER', financeQueueByAction('payment-complete').length ? 'High' : 'Medium', financeQueueByAction('payment-complete').length ? 'READY' : 'WAITING', 'payment-complete', 'finance', null, 'BUYER_PRIVATE');
  add('payment-confirmation', 'Confirm payment receipt', 'Supplier confirms receipt of completed payment and reference evidence.', 'SUPPLIER', financeQueueByAction('payment-confirmation').length ? 'High' : 'Medium', financeQueueByAction('payment-confirmation').length ? 'READY' : 'WAITING', 'payment-confirmation', 'finance');
  add('finance-deductions', 'Review deductions and liquidated damages', 'Buyer recommends or approves deductions, service credits, penalties, and LD before final payment.', 'BUYER', financial.deductionSummary.pendingDeductionsAmount || financeQueueByAction('finance-deduction-review').length ? 'High' : 'Medium', financial.deductionSummary.pendingDeductionsAmount || financeQueueByAction('finance-deduction-review').length ? 'READY' : 'WAITING', 'finance-deduction-review', 'finance', null, 'BUYER_PRIVATE');
  add('finance-retention', 'Resolve retention balance', 'Buyer releases, carries, or formally closes retained amounts before financial closeout.', 'BUYER', financial.retentionSummary.remainingRetention ? 'High' : 'Medium', financial.retentionSummary.remainingRetention ? 'READY' : 'WAITING', 'finance-retention', 'finance', null, 'BUYER_PRIVATE');
  add('finance-advance', 'Resolve advance recovery', 'Buyer records advance recovery or approved waiver before financial closeout.', 'BUYER', financial.advanceRecoverySummary.outstandingAmount ? 'High' : 'Medium', financial.advanceRecoverySummary.outstandingAmount ? 'READY' : 'WAITING', 'finance-advance-recovery', 'finance', null, 'BUYER_PRIVATE');
  const openChangeRequests = (contract.changeRequests ?? []).filter((item) => isOpen(item.status));
  const changeRequestsNeedingSupplier = openChangeRequests.filter((item) => !stringValue(item.supplierResponse));
  const openVariations = (contract.variations ?? []).filter((item) => isOpen(item.status));
  const openExtensions = (contract.extensionRequests ?? []).filter((item) => isOpen(item.status));
  const openClaims = (contract.claims ?? []).filter((item) => isOpen(item.status));
  const openDisputes = (contract.disputes ?? []).filter((item) => isOpen(item.status));
  const openIssues = (contract.issues ?? []).filter((item) => isOpen(item.status));
  const openRisks = (contract.risks ?? []).filter((item) => isOpen(item.status));
  const openNcrs = (contract.nonConformances ?? []).filter((item) => isOpen(item.status));
  const ncrsNeedingVerification = openNcrs.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
  const supplierNcrs = openNcrs.filter((item) => !['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
  const openTerminations = (contract.terminations ?? []).filter((item) => isOpen(item.status));
  const terminationNeedsSupplier = openTerminations.filter((item) => !stringValue(item.supplierResponse));
  const notices = contract.notices ?? [];
  const openNotices = notices.filter((item) => !['CLOSED', 'CANCELLED', 'REJECTED'].includes(String(item.status ?? '').toUpperCase()));
  const noticesAwaitingAck = openNotices.filter((item) => ['SENT', 'RECEIVED'].includes(String(item.status ?? '').toUpperCase()));
  const noticesAwaitingResponse = openNotices.filter((item) => ['ACKNOWLEDGED', 'OPEN'].includes(String(item.status ?? '').toUpperCase()) || /NOTICE_TO_CORRECT|NOTICE_OF_DEFAULT|NOTICE_OF_DELAY/i.test(String(item.noticeType ?? '')));
  const meetingActions = contract.meetingActions ?? [];
  const openMeetingActions = meetingActions.filter((item) => isOpen(item.status));
  const submittedMeetingActions = openMeetingActions.filter((item) => ['SUBMITTED', 'APPROVED'].includes(String(item.status ?? '').toUpperCase()));
  const securitySummary = securityExpirySummaryFor(contract);
  const warrantySummary = warrantySummaryFor(contract);
  add('issue-create', 'Raise execution issue', 'Track issues separately from risks and escalate to NCR, claim, dispute, default, or termination where needed.', 'SHARED', 'Medium', 'READY', 'issue', 'risk');
  add('issue-resolve', 'Resolve execution issue', 'Submit resolution evidence or closure notes for open execution issues.', 'SHARED', openIssues.length ? 'High' : 'Medium', openIssues.length ? 'READY' : 'WAITING', 'issue-resolve', 'risk', openIssues[0]?.dueDate ?? null);
  add('issue-close', 'Close verified issue', 'Buyer verifies resolution and closes or escalates the issue.', 'BUYER', openIssues.length ? 'High' : 'Medium', openIssues.length ? 'READY' : 'WAITING', 'issue-close', 'risk', openIssues[0]?.dueDate ?? null, 'BUYER_PRIVATE');
  add('risk-mitigate', 'Mitigate contract risk', 'Review open risks, update mitigation, owner, due date, or close when the risk is controlled.', 'BUYER', openRisks.length ? 'High' : 'Medium', openRisks.length ? 'READY' : 'WAITING', 'risk-mitigate', 'risk', openRisks[0]?.dueDate ?? null, 'BUYER_PRIVATE');
  add('ncr-create', 'Issue non-conformance', 'Record process, delivery, quality, or contract non-conformance and assign corrective action.', 'BUYER', openNcrs.length ? 'High' : 'Medium', 'READY', 'non-conformance', 'risk');
  add('ncr-response', 'Respond to non-conformance', 'Supplier submits corrective action and evidence against open NCRs.', 'SUPPLIER', supplierNcrs.length ? 'High' : 'Medium', supplierNcrs.length ? 'READY' : openNcrs.length ? 'WAITING' : 'DONE', 'ncr-response', 'risk');
  add('ncr-verify', 'Verify NCR correction', 'Buyer verifies supplier correction, accepts it, or returns it for more action.', 'BUYER', ncrsNeedingVerification.length ? 'High' : 'Medium', ncrsNeedingVerification.length ? 'READY' : openNcrs.length ? 'WAITING' : 'DONE', 'ncr-verify', 'risk', null, 'BUYER_PRIVATE');
  add('change-create', 'Raise change request', 'Capture scope, cost, time, legal, budget, and technical impact before formal amendment.', 'BUYER', openChangeRequests.length ? 'High' : 'Medium', 'READY', 'change-request', 'changes', null, 'BUYER_PRIVATE');
  add('change-respond', 'Respond to change impact', 'Supplier confirms delivery, price, time, and execution impact before Buyer decision.', 'SUPPLIER', changeRequestsNeedingSupplier.length ? 'High' : 'Medium', changeRequestsNeedingSupplier.length ? 'READY' : openChangeRequests.length ? 'WAITING' : 'DONE', 'change-request-respond', 'changes');
  add('change-review', 'Review change request', 'Buyer completes technical, financial, budget, legal, and amendment readiness review.', 'BUYER', openChangeRequests.length ? 'High' : 'Medium', openChangeRequests.length ? 'READY' : 'WAITING', 'change-request-review', 'changes', null, 'BUYER_PRIVATE');
  add('variation-review', 'Decide variation with signed amendment', 'Approve only when a signed amendment exists, or reject the variation with reasons.', 'BUYER', openVariations.length ? 'High' : 'Medium', openVariations.length ? 'READY' : 'WAITING', 'variation-review', 'changes', null, 'BUYER_PRIVATE');
  add('extension-review', 'Decide extension request', 'Review time impact and approve or reject before the execution timeline changes.', 'BUYER', openExtensions.length ? 'High' : 'Medium', openExtensions.length ? 'READY' : 'WAITING', 'extension-review', 'changes');
  add('claim-create', 'Raise claim', 'Submit entitlement, delay, cost, or payment claim with evidence and amount.', 'SHARED', 'Medium', 'READY', 'claim', 'claims');
  add('claim-response', 'Respond to claim', 'Respond, assess, settle, reject, or escalate claims with auditable reasoning.', 'SHARED', openClaims.length ? 'High' : 'Medium', openClaims.length ? 'READY' : 'WAITING', 'claim-response', 'claims');
  add('dispute-create', 'Open dispute', 'Escalate unresolved entitlement or performance disagreements into a formal dispute workflow.', 'SHARED', openDisputes.length ? 'High' : 'Medium', 'READY', 'dispute', 'claims');
  add('dispute-response', 'Respond to dispute', 'Supplier responds to formal dispute notices and proposed resolution routes.', 'SUPPLIER', openDisputes.length ? 'High' : 'Medium', openDisputes.length ? 'READY' : 'WAITING', 'dispute-response', 'claims');
  add('dispute-resolve', 'Resolve or close dispute', 'Buyer records decision, settlement route, closure, or escalation outcome.', 'BUYER', openDisputes.length ? 'High' : 'Medium', openDisputes.length ? 'READY' : 'WAITING', 'dispute-resolve', 'claims', null, 'BUYER_PRIVATE');
  add('termination-create', 'Start termination notice', 'Buyer records contract clause, reason, fault party, cure deadline, and required response.', 'BUYER', openTerminations.length ? 'Critical' : 'Medium', 'READY', 'termination', 'closeout', null, 'BUYER_PRIVATE');
  add('termination-response', 'Respond to termination notice', 'Supplier responds to cure notice, termination reason, and required corrective action.', 'SUPPLIER', terminationNeedsSupplier.length ? 'Critical' : 'Medium', terminationNeedsSupplier.length ? 'READY' : openTerminations.length ? 'WAITING' : 'DONE', 'termination-response', 'closeout');
  add('termination-decision', 'Decide termination outcome', 'Buyer records final decision, settlement, final termination, closure, or rejection after supplier response.', 'BUYER', openTerminations.length ? 'Critical' : 'Medium', openTerminations.length ? 'READY' : 'WAITING', 'termination-decision', 'closeout', null, 'BUYER_PRIVATE');
  add('notice-create', 'Issue formal notice', 'Record ordinary messages, notices to correct, delay/default notices, variation notices, or termination notices linked to the contract event.', 'BUYER', openNotices.length ? 'Medium' : 'Low', 'READY', 'notice', 'risk');
  add('notice-acknowledge', 'Acknowledge formal notice', 'Recipient acknowledges receipt date and keeps the formal notice audit trail current.', 'SHARED', noticesAwaitingAck.length ? 'High' : 'Medium', noticesAwaitingAck.length ? 'READY' : 'WAITING', 'notice-acknowledge', 'risk', stringValue(noticesAwaitingAck[0]?.dueDate) || null);
  add('notice-respond', 'Respond to formal notice', 'Recipient provides supplier-visible or buyer-visible response and corrective position.', 'SHARED', noticesAwaitingResponse.length ? 'High' : 'Medium', noticesAwaitingResponse.length ? 'READY' : 'WAITING', 'notice-respond', 'risk', stringValue(noticesAwaitingResponse[0]?.dueDate) || null);
  add('notice-close', 'Close formal notice', 'Buyer closes the notice after acknowledgement, response, linked claim, or decision is complete.', 'BUYER', openNotices.length ? 'High' : 'Medium', openNotices.length ? 'READY' : 'WAITING', 'notice-close', 'risk', null, 'BUYER_PRIVATE');
  add('meeting-create', 'Record meeting and actions', 'Capture kickoff, progress, technical, site, performance, dispute, or closeout meeting decisions and action owners.', 'BUYER', openMeetingActions.length ? 'Medium' : 'Low', 'READY', 'meeting', 'history');
  add('meeting-action-complete', 'Complete meeting action item', 'Responsible party records completion response and evidence for the meeting action.', 'SHARED', openMeetingActions.length ? 'High' : 'Medium', openMeetingActions.length ? 'READY' : 'WAITING', 'meeting-action-complete', 'history', stringValue(openMeetingActions[0]?.dueDate) || null);
  add('meeting-action-verify', 'Verify meeting action item', 'Buyer verifies or closes submitted meeting action items before closeout.', 'BUYER', submittedMeetingActions.length ? 'High' : 'Medium', submittedMeetingActions.length ? 'READY' : openMeetingActions.length ? 'WAITING' : 'DONE', 'meeting-action-verify', 'history', stringValue(submittedMeetingActions[0]?.dueDate) || null, 'BUYER_PRIVATE');
  add('security', 'Verify securities and guarantees', 'Record performance security, guarantees, insurance, expiry, verification, claim, and release status.', 'BUYER', contract.securities?.length ? 'Medium' : 'High', contract.securities?.some((item) => !['APPROVED', 'VERIFIED', 'RELEASED', 'WAIVED'].includes(String(item.verificationStatus ?? item.status ?? '').toUpperCase())) ? 'READY' : contract.securities?.length ? 'DONE' : 'READY', 'security', 'documents', null, 'BUYER_PRIVATE');
  add('security-review', 'Review expiring guarantee', 'Buyer verifies, extends, claims, releases, or waives expiring securities and insurance.', 'BUYER', securitySummary.expired ? 'Critical' : securitySummary.expiringSoon || securitySummary.unresolved ? 'High' : 'Medium', securitySummary.expired || securitySummary.expiringSoon || securitySummary.unresolved ? 'READY' : 'WAITING', 'security-review', 'documents', null, 'BUYER_PRIVATE');
  add('urgent-actions-recalculate', 'Refresh urgent actions', 'Regenerate urgent actions from current guarantee, warranty, blocker, and due-date state.', 'BUYER', 'Low', 'READY', 'urgent-actions-recalculate', 'history', null, 'BUYER_PRIVATE');
  add('required-document', 'Manage required documents', 'Collect, review, accept, reject, or return mandatory post-award documents.', 'SHARED', contract.requiredDocuments?.some((item) => isOpen(item.status)) ? 'High' : 'Medium', 'READY', 'required-document', 'documents');
  add('warranty', 'Manage warranty and defects liability', 'Track warranty period, defect references, responsible party, resolution, and closure.', 'BUYER', contract.warranties?.some((item) => isOpen(item.status)) ? 'High' : 'Medium', contract.warranties?.length ? 'READY' : 'WAITING', 'warranty', 'documents', null, 'BUYER_PRIVATE');
  add('warranty-response', 'Respond to warranty issue', 'Supplier provides repair, replacement, correction evidence, and resolution notes.', 'SUPPLIER', warrantySummary.awaitingSupplier ? 'High' : 'Medium', warrantySummary.awaitingSupplier ? 'READY' : warrantySummary.open ? 'WAITING' : 'DONE', 'warranty-response', 'documents');
  add('warranty-verify', 'Verify warranty resolution', 'Buyer verifies supplier correction and closes or returns the warranty item.', 'BUYER', warrantySummary.awaitingBuyer ? 'High' : 'Medium', warrantySummary.awaitingBuyer ? 'READY' : warrantySummary.open ? 'WAITING' : 'DONE', 'warranty-verify', 'documents', null, 'BUYER_PRIVATE');
  add('performance', 'Score supplier performance', 'Complete time, quality, cost, compliance, and overall performance before closeout.', 'BUYER', ['COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING'].includes(String(contract.status)) ? 'High' : 'Medium', contract.supplierPerformanceRecords?.length ? 'DONE' : 'READY', 'performance', 'performance', null, 'BUYER_PRIVATE');
  add('closeout', 'Complete closeout wizard', 'Confirm execution, financial settlement, controls, documents, warranty, guarantees, performance, meeting actions, and lessons learned.', 'BUYER', blockers.some((blocker) => ['open-change-requests', 'open-variations', 'open-extensions', 'open-claims', 'open-disputes', 'open-termination', 'open-issues', 'unsettled-invoices', 'performance-missing', 'open-warranty', 'open-ncr', 'open-defects', 'open-service-incidents', 'services-report-review-waiting', 'works-final-completion-waiting', 'consultancy-revision-waiting', 'consultancy-final-report-waiting', 'consultancy-final-report-review-waiting', 'consultancy-final-report-open', 'open-notices', 'open-meeting-actions', 'security-expiry-open'].includes(blocker.id)) ? 'High' : 'Medium', blockers.length ? 'BLOCKED' : 'READY', 'closeout', 'closeout', null, 'BUYER_PRIVATE');
  add('closeout-step', 'Confirm closeout wizard step', 'Buyer records closeout step evidence and decision when that area is clear.', 'BUYER', blockers.length ? 'Medium' : 'High', blockers.length ? 'BLOCKED' : 'READY', 'closeout-step', 'closeout', null, 'BUYER_PRIVATE');
  return tasks;
}

function workflowSectionsFor(contract: ContractDetailDto, procurementType: PostAwardProcurementType, stages: PostAwardStageDto[], blockers: PostAwardBlockerDto[]): PostAwardWorkflowSectionDto[] {
  const stageById = new Map(stages.map((item) => [item.id, item]));
  const stepsByType: Record<PostAwardProcurementType, Record<PostAwardStageDto['id'], Array<[string, string, PostAwardTaskDto['owner'], number]>>> = {
    GOODS: {
      setup: [['activation', 'Activation gate', 'SHARED', contract.activationItems?.length ?? 0]],
      delivery: [['schedule', 'Delivery schedule', 'BUYER', contract.deliverySchedules?.length ?? 0], ['dispatch', 'Dispatch notice', 'SUPPLIER', contract.dispatchNotices?.length ?? 0], ['receipt', 'Goods receipt', 'BUYER', contract.goodsReceipts?.length ?? 0]],
      inspections: [['inspection', 'Inspection', 'BUYER', (contract.goodsInspections?.length ?? 0) + (contract.inspections?.length ?? 0)], ['acceptance', 'Acceptance', 'BUYER', acceptedCount(contract)]],
      finance: [['invoice', 'Invoice', 'SUPPLIER', contract.invoices?.length ?? 0], ['match', 'Three-way match', 'BUYER', contract.threeWayMatches?.length ?? 0], ['payment', 'Payment', 'BUYER', contract.payments?.length ?? 0]],
      risk: [['issues', 'Risks and issues', 'SHARED', (contract.risks?.length ?? 0) + (contract.issues?.length ?? 0)]],
      changes: [['changes', 'Variations and extensions', 'SHARED', (contract.variations?.length ?? 0) + (contract.extensionRequests?.length ?? 0)]],
      claims: [['claims', 'Claims and responses', 'SHARED', (contract.claims?.length ?? 0) + (contract.claimResponses?.length ?? 0)]],
      documents: [['warranty', 'Warranty and documents', 'SHARED', (contract.warranties?.length ?? 0) + (contract.requiredDocuments?.length ?? 0)]],
      closeout: [['closeout', 'Closeout', 'BUYER', contract.closeout ? 1 : 0]],
      performance: [['performance', 'Performance history', 'BUYER', contract.supplierPerformanceRecords?.length ?? 0]],
      history: [['history', 'Audit history', 'SHARED', contract.audit?.length ?? 0]]
    },
    WORKS: {} as Record<PostAwardStageDto['id'], Array<[string, string, PostAwardTaskDto['owner'], number]>>,
    SERVICES: {} as Record<PostAwardStageDto['id'], Array<[string, string, PostAwardTaskDto['owner'], number]>>,
    CONSULTANCY: {} as Record<PostAwardStageDto['id'], Array<[string, string, PostAwardTaskDto['owner'], number]>>,
    GENERAL: {} as Record<PostAwardStageDto['id'], Array<[string, string, PostAwardTaskDto['owner'], number]>>
  };
  stepsByType.WORKS = {
    ...stepsByType.GOODS,
    delivery: [
      ['handover', 'Site handover', 'BUYER', contract.siteHandovers?.length ?? 0],
      ['mobilization', 'Mobilization / programme', 'SHARED', contract.mobilizationItems?.length ?? 0],
      ['progress', 'Progress reports', 'SUPPLIER', contract.worksProgressReports?.length ?? 0],
      ['boq', 'BOQ measurements', 'BUYER', contract.boqMeasurements?.length ?? 0]
    ],
    inspections: [
      ['defects', 'Defects liability', 'SHARED', contract.defects?.length ?? 0],
      ['practical', 'Practical completion', 'BUYER', (contract.worksCompletionCertificates ?? []).filter((item) => String(item.certificateType ?? '').toUpperCase() === 'PRACTICAL_COMPLETION').length]
    ],
    finance: [
      ['ipc', 'Interim certificates', 'BUYER', contract.interimPaymentCertificates?.length ?? 0],
      ['invoice', 'Invoice', 'SUPPLIER', contract.invoices?.length ?? 0],
      ['match', 'Three-way match', 'BUYER', contract.threeWayMatches?.length ?? 0],
      ['payment', 'Payment', 'BUYER', contract.payments?.length ?? 0]
    ],
    closeout: [
      ['final-account', 'Final account', 'BUYER', (contract.worksCompletionCertificates ?? []).filter((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_ACCOUNT').length],
      ['final-completion', 'Final completion', 'BUYER', (contract.worksCompletionCertificates ?? []).filter((item) => String(item.certificateType ?? '').toUpperCase() === 'FINAL_COMPLETION').length],
      ['closeout', 'Closeout', 'BUYER', contract.closeout ? 1 : 0]
    ]
  };
  stepsByType.SERVICES = {
    ...stepsByType.GOODS,
    delivery: [
      ['sla', 'SLA setup', 'BUYER', contract.serviceLevels?.length ?? 0],
      ['period', 'Service periods', 'BUYER', contract.servicePeriods?.length ?? 0],
      ['report', 'Service reports', 'SUPPLIER', contract.serviceReports?.length ?? 0],
      ['verification', 'SLA verification', 'BUYER', (contract.serviceReports ?? []).filter((item) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(item.status ?? '').toUpperCase())).length]
    ],
    risk: [
      ['incidents', 'Incidents / complaints', 'SHARED', contract.serviceIncidents?.length ?? 0],
      ['issues', 'Risks and issues', 'SHARED', (contract.risks?.length ?? 0) + (contract.issues?.length ?? 0)]
    ],
    finance: [
      ['credits', 'Credits and penalties', 'BUYER', contract.serviceCredits?.length ?? 0],
      ['invoice', 'Invoice', 'SUPPLIER', contract.invoices?.length ?? 0],
      ['match', 'Three-way match', 'BUYER', contract.threeWayMatches?.length ?? 0],
      ['payment', 'Payment', 'BUYER', contract.payments?.length ?? 0]
    ]
  };
  stepsByType.CONSULTANCY = {
    ...stepsByType.GOODS,
    delivery: [['plan', 'Deliverable plan', 'BUYER', contract.consultancyDeliverables?.length ?? 0], ['versions', 'Versioned submissions', 'SUPPLIER', contract.deliverableVersions?.length ?? 0]],
    inspections: [['review', 'Technical review', 'BUYER', contract.deliverableReviews?.length ?? 0], ['approval', 'Approval', 'BUYER', hasApprovedConsultancy(contract) ? 1 : 0]],
    finance: [['eligibility', 'Payment eligibility', 'BUYER', (contract.deliverableReviews ?? []).filter((item) => isPayableConsultancyRecord(item as Record<string, unknown>)).length], ['invoice', 'Invoice', 'SUPPLIER', contract.invoices?.length ?? 0], ['match', 'Three-way match', 'BUYER', contract.threeWayMatches?.length ?? 0], ['payment', 'Payment', 'BUYER', contract.payments?.length ?? 0]],
    closeout: [['final-report', 'Final report', 'SHARED', contract.consultancyFinalReports?.length ?? 0], ['closeout', 'Closeout', 'BUYER', contract.closeout ? 1 : 0]]
  };
  stepsByType.GENERAL = stepsByType.GOODS;
  const map = stepsByType[procurementType] ?? stepsByType.GOODS;

  return stages.map((stageItem) => {
    const sectionBlockers = blockers.filter((blocker) => blocker.sectionId === stageItem.id);
    const stepSpecs = map[stageItem.id] ?? [[stageItem.id, stageItem.label, 'SHARED', stageItem.count] as [string, string, PostAwardTaskDto['owner'], number]];
    const steps = stepSpecs.map(([id, label, owner, count]) => ({
      id,
      label,
      owner,
      count,
      status: sectionBlockers.length ? 'BLOCKED' : count > 0 ? 'ACTIVE' : 'PENDING'
    } satisfies PostAwardWorkflowSectionDto['steps'][number]));
    return {
      id: stageItem.id,
      label: stageById.get(stageItem.id)?.label ?? stageItem.label,
      description: stageItem.description,
      status: sectionBlockers.length ? 'BLOCKED' : stageItem.count > 0 ? 'ACTIVE' : 'PENDING',
      steps,
      records: stageItem.records
    };
  });
}

function healthFor(contract: ContractDetailDto, blockers: PostAwardBlockerDto[]): PostAwardHealthDto {
  const critical = blockers.filter((blocker) => blocker.severity === 'Critical').length;
  const high = blockers.filter((blocker) => blocker.severity === 'High').length;
  const riskScore = contract.risks?.reduce((total, risk) => Math.max(total, Number(risk.score ?? 0)), 0) ?? 0;
  const score = Math.min(100, critical * 30 + high * 15 + blockers.length * 5 + riskScore);
  const level: PostAwardHealthDto['level'] = score >= 70 ? 'CRITICAL' : score >= 45 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW';
  return {
    level,
    label: level === 'LOW' ? 'Healthy' : level === 'MEDIUM' ? 'Watch' : level === 'HIGH' ? 'At risk' : 'Critical',
    score,
    summary: blockers.length ? `${blockers.length} workflow blocker${blockers.length === 1 ? '' : 's'} require attention.` : 'Execution is clear for the next workflow step.'
  };
}

function timelineFor(contract: ContractDetailDto): PostAwardRecordDto[] {
  return [
    ...typedRecords(contract.audit, 'activity'),
    ...typedRecords(contract.notifications, 'notification'),
    ...typedRecords(contract.worksProgressReports, 'works_progress_report'),
    ...typedRecords(contract.boqMeasurements, 'boq_measurement'),
    ...typedRecords(contract.interimPaymentCertificates, 'interim_payment_certificate'),
    ...typedRecords(contract.defects, 'defect'),
    ...typedRecords(contract.worksCompletionCertificates, 'works_completion_certificate'),
    ...typedRecords(contract.serviceReports, 'service_report'),
    ...typedRecords(contract.serviceCredits, 'service_credit'),
    ...typedRecords(contract.serviceIncidents, 'service_incident'),
    ...typedRecords(contract.consultancyDeliverables, 'consultancy_deliverable'),
    ...typedRecords(contract.deliverableVersions, 'deliverable_version'),
    ...typedRecords(contract.deliverableReviews, 'deliverable_review'),
    ...typedRecords(contract.consultancyFinalReports, 'consultancy_final_report'),
    ...typedRecords(contract.notices, 'notice'),
    ...typedRecords(contract.meetings, 'meeting'),
    ...typedRecords(contract.meetingActions, 'meeting_action'),
    ...typedRecords(contract.invoices, 'invoice'),
    ...typedRecords(contract.acceptances, 'acceptance'),
    ...typedRecords(contract.claims, 'claim')
  ].map(recordDto).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))).slice(0, 25);
}

function acceptedCount(contract: ContractDetailDto) {
  return (contract.acceptances ?? []).filter((item) => isTerminal(statusOf(item))).length
    + (contract.goodsInspections ?? []).filter((item) => isTerminal(statusOf(item))).length;
}

function hasSubmittedVersion(contract: ContractDetailDto) {
  return (contract.deliverableVersions ?? []).some((item) => ['SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'ACCEPTED'].includes(String(item.status ?? '').toUpperCase()));
}

function hasApprovedConsultancy(contract: ContractDetailDto) {
  return (contract.deliverableReviews ?? []).some((item) => isTerminal(item.decision ?? item.status))
    || (contract.consultancyDeliverables ?? []).some((item) => isTerminal(item.status));
}

function humanType(type: string) {
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stage(id: PostAwardStageDto['id'], label: string, description: string, records: unknown[]): PostAwardStageDto {
  const normalized = records.filter(Boolean).map(recordDto);
  return { id, label, description, count: normalized.length, records: normalized };
}

function secondary(id: PostAwardWorkspaceDto['secondary'][number]['id'], label: string, records: unknown[]) {
  const normalized = records.filter(Boolean).map(recordDto);
  return { id, label, count: normalized.length, records: normalized };
}

function typedRecords(records: unknown[] | undefined, type: string) {
  return (records ?? []).filter(Boolean).map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { type, value };
    const record = value as Record<string, unknown>;
    return { ...record, type: stringValue(record.type) || type };
  });
}

function recordDto(value: unknown): PostAwardRecordDto {
  const record = (value ?? {}) as Record<string, unknown>;
  const id = stringValue(record.id) || stringValue(record.event) || `${stringValue(record.type) || 'record'}-${stringValue(record.createdAt) || 'generated'}`;
  return {
    id,
    type: stringValue(record.type) || stringValue(record.event) || stringValue(record.category) || 'record',
    title: stringValue(record.title) || stringValue(record.subject) || stringValue(record.reference) || stringValue(record.dispatchReference) || stringValue(record.receiptReference) || stringValue(record.handoverReference) || stringValue(record.reportReference) || stringValue(record.certificateNumber) || stringValue(record.certificateNo) || stringValue(record.claimReference) || stringValue(record.requestReference) || stringValue(record.amendmentReference) || stringValue(record.defectReference) || stringValue(record.incidentReference) || stringValue(record.deliverableCode) || stringValue(record.boqItemReference) || stringValue(record.metricKey) || stringValue(record.periodKey) || stringValue(record.inspectionNo) || stringValue(record.noticeType) || stringValue(record.meetingType) || stringValue(record.securityType) || stringValue(record.event) || 'Record',
    status: stringValue(record.status) || stringValue(record.result) || stringValue(record.decision) || stringValue(record.riskLevel) || 'RECORDED',
    ownerRole: stringValue(record.ownerRole) || stringValue(record.responsibleRole) || null,
    dueDate: stringValue(record.dueDate) || stringValue(record.meetingDate) || stringValue(record.expiryDate) || stringValue(record.plannedDeliveryDate) || stringValue(record.expectedArrivalDate) || stringValue(record.newCompletionDate) || null,
    amount: (record.amount as number | string | null | undefined) ?? (record.amountClaimed as number | string | null | undefined) ?? (record.approvedAmount as number | string | null | undefined) ?? (record.acceptedValue as number | string | null | undefined) ?? (record.acceptedAmount as number | string | null | undefined) ?? (record.invoiceImpactAmount as number | string | null | undefined) ?? (record.finalAccountAmount as number | string | null | undefined) ?? (objectValue(record.payload).acceptedValue as number | string | null | undefined) ?? (record.netAmount as number | string | null | undefined) ?? (record.certifiedAmount as number | string | null | undefined) ?? (record.grossAmount as number | string | null | undefined) ?? null,
    currency: stringValue(record.currency) || null,
    note: stringValue(record.note) || stringValue(record.summary) || stringValue(record.description) || null,
    createdAt: stringValue(record.createdAt) || null,
    updatedAt: stringValue(record.updatedAt) || null,
    payload: objectValue(record.payload)
  };
}

function actionsFor(contract: ContractDetailDto): PostAwardActionDto[] {
  const access = contract.access;
  const supplier = Boolean(access?.canSubmitSupplierActions);
  const buyer = Boolean(access?.canManageBuyerActions);
  return [
    action('activation-submit', 'Submit activation item', 'setup', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('activation-review', 'Review activation item', 'setup', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('activate-contract', 'Activate contract', 'setup', 'BUYER', buyer && (contract.activationItems ?? []).length > 0, 'Critical', (contract.activationItems ?? []).length ? (buyer ? null : access?.readOnlyReason ?? 'Buyer action') : 'Start activation checklist first.'),
    action('obligation', 'Add obligation', 'setup', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('evidence-requirement', 'Add evidence requirement', 'setup', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('management-plan', 'Update CMP', 'setup', 'BUYER', buyer, !contract.managementPlan ? 'High' : 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('management-plan-draft', 'Generate CMP draft', 'setup', 'BUYER', buyer, !contract.managementPlan ? 'High' : 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('deliverable', 'Submit deliverable', 'delivery', 'SUPPLIER', supplier, 'Medium', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('evidence', 'Upload milestone evidence', 'delivery', 'SUPPLIER', supplier && contract.milestones.length > 0, 'High', contract.milestones.length ? (supplier ? null : access?.readOnlyReason ?? 'Supplier action') : 'Create a milestone first.'),
    action('inspection', 'Record inspection', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('acceptance', 'Accept delivery', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('site-handover', 'Record site handover', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('works-progress', 'Submit works progress', 'delivery', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('works-progress-review', 'Review works progress', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('boq-measurement', 'Record BOQ measurement', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('boq-measurement-review', 'Review BOQ measurement', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('interim-payment-certificate', 'Issue IPC', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('ipc-certify', 'Certify IPC', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('contract-defect', 'Record Works defect', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('defect-response', 'Respond to defect', 'inspections', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('defect-verify', 'Verify defect', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('works-completion-certificate', 'Works completion certificate', 'closeout', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-level', 'Define service SLA', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-period', 'Open service period', 'delivery', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-report', 'Submit service report', 'delivery', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('service-report-review', 'Review service report', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-incident', 'Record service incident', 'risk', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-incident-response', 'Respond to service incident', 'risk', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('service-incident-verify', 'Verify service incident', 'risk', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-credit', 'Create service credit', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('service-credit-review', 'Review service credit', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('consultancy-deliverable', 'Create consultancy deliverable', 'delivery', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('deliverable-version', 'Submit consultancy version', 'delivery', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('deliverable-review', 'Review consultancy version', 'inspections', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('deliverable-payment-eligibility', 'Confirm consultancy payment eligibility', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('consultancy-final-report', 'Submit consultancy final report', 'closeout', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('consultancy-final-report-review', 'Review consultancy final report', 'closeout', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('invoice', 'Submit invoice', 'finance', 'SUPPLIER', supplier, 'Medium', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('invoice-correction', 'Correct invoice', 'finance', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('invoice-verify', 'Verify invoice', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment-recommendation', 'Recommend payment', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment-approval-review', 'Approve payment', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment-initiate', 'Initiate payment', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment-complete', 'Complete payment', 'finance', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment-confirmation', 'Confirm receipt', 'finance', 'SUPPLIER', supplier, 'Medium', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('finance-deduction-review', 'Review deductions', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('finance-retention', 'Resolve retention', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('finance-advance-recovery', 'Resolve advance recovery', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('finance-liquidated-damages', 'Review liquidated damages', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('payment', 'Record payment review', 'finance', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('issue', 'Raise issue', 'risk', 'SHARED', supplier || buyer, 'Medium', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('issue-resolve', 'Resolve issue', 'risk', 'SHARED', supplier || buyer, 'Medium', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('issue-close', 'Close issue', 'risk', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('risk-mitigate', 'Mitigate risk', 'risk', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('non-conformance', 'Issue NCR', 'risk', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('ncr-response', 'Respond to NCR', 'risk', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('ncr-verify', 'Verify NCR', 'risk', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('change-request', 'Raise change request', 'changes', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('change-request-respond', 'Respond to change', 'changes', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('change-request-review', 'Review change request', 'changes', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('variation', 'Create variation', 'changes', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('variation-review', 'Review variation', 'changes', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('extension-review', 'Review extension', 'changes', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('claim', 'Raise claim', 'claims', 'SHARED', supplier || buyer, 'Medium', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('claim-response', 'Respond to claim', 'claims', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('dispute', 'Open dispute', 'claims', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('dispute-response', 'Respond to dispute', 'claims', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('dispute-resolve', 'Resolve dispute', 'claims', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('termination', 'Start termination', 'closeout', 'BUYER', buyer, 'Critical', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('termination-response', 'Respond to termination', 'closeout', 'SUPPLIER', supplier, 'Critical', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('termination-decision', 'Decide termination', 'closeout', 'BUYER', buyer, 'Critical', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('notice', 'Issue notice', 'risk', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('notice-acknowledge', 'Acknowledge notice', 'risk', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('notice-respond', 'Respond to notice', 'risk', 'SHARED', supplier || buyer, 'High', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('notice-close', 'Close notice', 'risk', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('meeting', 'Record meeting', 'history', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('meeting-action-complete', 'Complete meeting action', 'history', 'SHARED', supplier || buyer, 'Medium', supplier || buyer ? null : access?.readOnlyReason ?? 'No contract access'),
    action('meeting-action-verify', 'Verify meeting action', 'history', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('security-review', 'Review security', 'documents', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('warranty-response', 'Respond to warranty', 'documents', 'SUPPLIER', supplier, 'High', supplier ? null : access?.readOnlyReason ?? 'Supplier action'),
    action('warranty-verify', 'Verify warranty', 'documents', 'BUYER', buyer, 'High', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('urgent-actions-recalculate', 'Refresh urgent actions', 'history', 'BUYER', buyer, 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('closeout-step', 'Confirm closeout step', 'closeout', 'BUYER', buyer, 'Medium', buyer ? null : access?.readOnlyReason ?? 'Buyer action'),
    action('closeout', 'Close contract', 'closeout', 'BUYER', buyer, 'Low', buyer ? null : access?.readOnlyReason ?? 'Buyer action')
  ];
}

function action(key: string, label: string, stageId: PostAwardActionDto['stage'], owner: PostAwardActionDto['owner'], enabled: boolean, priority: PostAwardActionDto['priority'], reason: string | null): PostAwardActionDto {
  return { key, label, stage: stageId, owner, priority, enabled, reason };
}

function stringValue(value: unknown) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nextDueDate(contract: ContractDetailDto) {
  return (contract.activationItems ?? []).find((item) => item.dueDate)?.dueDate ?? (contract.obligations ?? []).find((item) => item.dueDate)?.dueDate ?? contract.milestones.find((milestone) => milestone.dueDate)?.dueDate ?? null;
}

function stageLabel(status: string) {
  return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function riskLabel(contract: ContractDetailDto) {
  if (contract.risks.some((risk) => risk.level === 'CRITICAL')) return 'Critical';
  if (contract.issues.some((issue) => issue.status !== 'CLOSED')) return 'High';
  if (contract.milestones.some((milestone) => milestone.status === 'SUBMITTED')) return 'Medium';
  return 'Low';
}

function nextAction(contract: ContractDetailDto) {
  if (contract.status === 'SIGNED') return 'Start activation setup';
  if (contract.status === 'PENDING_ACTIVATION' && (contract.activationItems ?? []).some((item) => item.status !== 'APPROVED' && item.status !== 'WAIVED' && item.status !== 'CLOSED')) return 'Complete activation checklist';
  if (!contract.managementPlan) return 'Complete contract management plan';
  if (contract.deliverables?.some((item) => item.status === 'SUBMITTED')) return 'Inspect submitted deliverables';
  if (contract.invoices?.some((item) => String(item.status) === 'SUBMITTED')) return 'Review submitted invoices';
  if (!contract.closeout && ['COMPLETED', 'WARRANTY_DEFECTS', 'CLOSING'].includes(contract.status)) return 'Prepare close-out';
  return 'Monitor execution';
}
