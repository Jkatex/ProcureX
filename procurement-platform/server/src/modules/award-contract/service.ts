import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type AwardContractRequestContext,
  type AwardDecisionInput,
  type AwardApprovalRouteInput,
  type AwardApprovalStepInput,
  type AwardNotificationInput,
  type AwardNoticeCancelInput,
  type AwardNoticeReissueInput,
  type AwardNoticeResponseInput,
  type AwardSettlementInput,
  type AwardTieBreakerInput,
  type AcceptanceInput,
  type BudgetCommitmentInput,
  type ClauseInput,
  type ContractChangeRequestInput,
  type ControlWorkflowActionInput,
  type FinanceWorkflowActionInput,
  type ContractCloseoutInput,
  type ContractActivateInput,
  type ContractActivationItemReviewInput,
  type ContractActivationItemSubmitInput,
  type ContractAmendmentInput,
  type ContractBoqMeasurementInput,
  type BoqMeasurementReviewInput,
  type ContractClaimInput,
  type ContractClaimResponseInput,
  type AwardContractDocumentUploadInput,
  type ContractCommencementInput,
  type ContractConsultancyDeliverableInput,
  type ConsultancyDeliverableReviewInput,
  type ConsultancyFinalReportInput,
  type ConsultancyFinalReportReviewInput,
  type ContractDefectActionInput,
  type ContractDefectInput,
  type ContractDeliverableReviewInput,
  type ContractDeliverableVersionInput,
  type DeliverableReviewPaymentEligibilityInput,
  type ContractDeliveryScheduleInput,
  type ContractDispatchNoticeInput,
  type ContractEvidenceRequirementInput,
  type ContractExtensionRequestInput,
  type ContractGoodsReceiptInput,
  type ContractInterimPaymentCertificateInput,
  type InterimPaymentCertificateCertifyInput,
  type ContractManagementPlanDraftInput,
  type ContractManagementPlanInput,
  type ContractMeetingActionInput,
  type ContractMeetingActionPatchInput,
  type ContractMeetingInput,
  type ContractNonConformanceInput,
  type ContractNoticeActionInput,
  type ContractNoticeInput,
  type ContractPaymentInput,
  type ContractPenaltyInput,
  type ContractReferenceSampleInput,
  type ContractSecurityActionInput,
  type ContractSecurityInput,
  type ContractServiceIncidentInput,
  type ServiceIncidentActionInput,
  type AwardRecommendationQuery,
  type DeliverableInput,
  type DeliveryFeasibilityInput,
  type GoodsInspectionInput,
  type InvoiceInput,
  type ContractMilestoneEvidenceInput,
  type ContractMilestoneInput,
  type ContractMilestonePatchInput,
  type ContractObligationInput,
  type ContractServiceCreditInput,
  type ServiceCreditReviewInput,
  type ContractServiceLevelInput,
  type ContractServicePeriodInput,
  type ContractServiceReportInput,
  type ServiceReportReviewInput,
  type ContractSiteHandoverInput,
  type ContractWorksProgressReportInput,
  type WorksCompletionCertificateInput,
  type WorksProgressReviewInput,
  type ContractQuery,
  type InspectionInput,
  type InvoiceStatusPatchInput,
  type LifecycleItemInput,
  type LifecycleItemPatchInput,
  type NegotiationInput,
  type PaymentScheduleInput,
  type PaymentApprovalInput,
  type PaymentConfirmationInput,
  type PerformanceScoreInput,
  type ReplacementProcurementInput,
  type RequiredDocumentInput,
  type RiskInput,
  type RiskForecastInput,
  type SampleCustodyTransferInput,
  type SampleDispositionInput,
  type SampleEvaluationInput,
  type SampleReceiptInput,
  type SampleTestInput,
  type SampleVerificationInput,
  type StandstillPeriodInput,
  type SupplierPerformanceInput,
  type SupplierRiskProfileInput,
  type TerminationEvidenceInput,
  type TerminationInput,
  type TerminationNoticeInput,
  type TerminationPatchInput,
  type TerminationSettlementInput,
  type TerminationValuationInput,
  type VariationInput,
  type WarrantyInput,
  type WorkflowApprovalInput,
  type ThreeWayMatchInput,
  type ContractSignatureRequestInput,
  type ContractSignatureSignInput,
  type ContractNegotiationDecisionInput,
  type ContractStatusPatchInput,
  type ContractVersionInput,
  type ModuleStatus
} from './types.js';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  dashboard(context: AwardContractRequestContext) {
    return this.repository.dashboard(context);
  }

  listSamples(context: AwardContractRequestContext) {
    return this.repository.listSamples(context);
  }

  async sample(sampleId: string, context: AwardContractRequestContext) {
    const sample = await this.repository.getSample(sampleId, context);
    if (!sample) throw requestError('Sample was not found.', 404);
    return sample;
  }

  receiveSample(sampleId: string, input: SampleReceiptInput, context: AwardContractRequestContext) {
    return this.repository.receiveSample(sampleId, input, context);
  }

  verifySample(sampleId: string, input: SampleVerificationInput, context: AwardContractRequestContext) {
    return this.repository.verifySample(sampleId, input, context);
  }

  transferSampleCustody(sampleId: string, input: SampleCustodyTransferInput, context: AwardContractRequestContext) {
    return this.repository.transferSampleCustody(sampleId, input, context);
  }

  evaluateSample(sampleId: string, input: SampleEvaluationInput, context: AwardContractRequestContext) {
    return this.repository.evaluateSample(sampleId, input, context);
  }

  createSampleTest(sampleId: string, input: SampleTestInput, context: AwardContractRequestContext) {
    return this.repository.createSampleTest(sampleId, input, context);
  }

  requestSampleClarification(sampleId: string, input: SampleVerificationInput, context: AwardContractRequestContext) {
    return this.repository.requestSampleClarification(sampleId, input, context);
  }

  returnSample(sampleId: string, input: SampleDispositionInput, context: AwardContractRequestContext) {
    return this.repository.returnSample(sampleId, input, context);
  }

  retainSample(sampleId: string, input: SampleDispositionInput & ContractReferenceSampleInput, context: AwardContractRequestContext) {
    return this.repository.retainSample(sampleId, input, context);
  }

  disposeSample(sampleId: string, input: SampleDispositionInput, context: AwardContractRequestContext) {
    return this.repository.disposeSample(sampleId, input, context);
  }

  listRecommendations(query: AwardRecommendationQuery, context: AwardContractRequestContext) {
    return this.repository.listRecommendations(query, context);
  }

  async recommendation(id: string, context: AwardContractRequestContext) {
    const recommendation = await this.repository.getRecommendation(id, context);
    if (!recommendation) throw requestError('Award recommendation was not found.', 404);
    return recommendation;
  }

  async evaluationReport(id: string, context: AwardContractRequestContext) {
    return this.repository.evaluationReport(id, context);
  }

  async approveRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.approveRecommendation(id, input, context);
    if (!recommendation) throw requestError('Award recommendation was not found after approval.', 404);
    return recommendation;
  }

  async saveAwardDecisionDraft(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.saveAwardDecisionDraft(id, input, context);
    if (!recommendation) throw requestError('Award recommendation was not found after draft save.', 404);
    return recommendation;
  }

  async returnRecommendation(id: string, input: AwardDecisionInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.returnRecommendation(id, input, context);
    if (!recommendation) throw requestError('Award recommendation was not found after return.', 404);
    return recommendation;
  }

  upsertAwardApprovalRoute(id: string, input: AwardApprovalRouteInput, context: AwardContractRequestContext) {
    return this.repository.upsertAwardApprovalRoute(id, input, context);
  }

  upsertAwardApprovalStep(id: string, input: AwardApprovalStepInput, context: AwardContractRequestContext) {
    return this.repository.upsertAwardApprovalStep(id, input, context);
  }

  createAwardTieBreaker(id: string, input: AwardTieBreakerInput, context: AwardContractRequestContext) {
    return this.repository.createAwardTieBreaker(id, input, context);
  }

  upsertDeliveryFeasibility(id: string, input: DeliveryFeasibilityInput, context: AwardContractRequestContext) {
    return this.repository.upsertDeliveryFeasibility(id, input, context);
  }

  upsertStandstillPeriod(id: string, input: StandstillPeriodInput, context: AwardContractRequestContext) {
    return this.repository.upsertStandstillPeriod(id, input, context);
  }

  createAwardNotification(id: string, input: AwardNotificationInput, context: AwardContractRequestContext) {
    return this.repository.createAwardNotification(id, input, context);
  }

  createBudgetCommitmentForRecommendation(id: string, input: BudgetCommitmentInput, context: AwardContractRequestContext) {
    return this.repository.createBudgetCommitmentForRecommendation(id, input, context);
  }

  upsertAwardClause(id: string, input: ClauseInput, context: AwardContractRequestContext) {
    return this.repository.upsertAwardClause(id, input, context);
  }

  createAwardNegotiation(id: string, input: NegotiationInput, context: AwardContractRequestContext) {
    return this.repository.createAwardNegotiation(id, input, context);
  }

  generateAwardBidPack(id: string, context: AwardContractRequestContext) {
    return this.repository.generateAwardBidPack(id, context);
  }

  settleAwardGroup(id: string, input: AwardSettlementInput, context: AwardContractRequestContext) {
    return this.repository.settleAwardGroup(id, input, context);
  }

  async respondToNotice(id: string, input: AwardNoticeResponseInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.respondToNotice(id, input, context);
    if (!recommendation) throw requestError('Award notice was not found after response.', 404);
    return recommendation;
  }

  async cancelAwardNotice(id: string, input: AwardNoticeCancelInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.cancelAwardNotice(id, input, context);
    if (!recommendation) throw requestError('Award notice was not found after cancellation.', 404);
    return recommendation;
  }

  async reissueAwardNotice(id: string, input: AwardNoticeReissueInput, context: AwardContractRequestContext) {
    const recommendation = await this.repository.reissueAwardNotice(id, input, context);
    if (!recommendation) throw requestError('Award notice was not found after reissue.', 404);
    return recommendation;
  }

  listContracts(query: ContractQuery, context: AwardContractRequestContext) {
    return this.repository.listContracts(query, context);
  }

  async prepareTenderContractDraft(tenderId: string, context: AwardContractRequestContext) {
    const contract = await this.repository.prepareTenderContractDraft(tenderId, context);
    if (!contract) throw requestError('Contract was not found after draft preparation.', 404);
    return contract;
  }

  async contract(id: string, context: AwardContractRequestContext) {
    const contract = await this.repository.getContract(id, context);
    if (!contract) throw requestError('Contract was not found.', 404);
    return contract;
  }

  contractDocuments(id: string, context: AwardContractRequestContext) {
    return this.repository.contractDocuments(id, context);
  }

  uploadContractDocument(id: string, input: AwardContractDocumentUploadInput, context: AwardContractRequestContext) {
    return this.repository.uploadContractDocument(id, input, context);
  }

  async createContractVersion(id: string, input: ContractVersionInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createContractVersion(id, input, context);
    if (!contract) throw requestError('Contract was not found after version creation.', 404);
    return contract;
  }

  async sendContractForNegotiation(id: string, context: AwardContractRequestContext) {
    const contract = await this.repository.sendContractForNegotiation(id, context);
    if (!contract) throw requestError('Contract was not found after sending for negotiation.', 404);
    return contract;
  }

  async createSignatureRequests(id: string, input: ContractSignatureRequestInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createSignatureRequests(id, input, context);
    if (!contract) throw requestError('Contract was not found after signature request.', 404);
    return contract;
  }

  async signContractSignature(contractId: string, signatureId: string, input: ContractSignatureSignInput, context: AwardContractRequestContext) {
    const contract = await this.repository.signContractSignature(contractId, signatureId, input, context);
    if (!contract) throw requestError('Contract was not found after signing.', 404);
    return contract;
  }

  async createMilestone(contractId: string, input: ContractMilestoneInput, context: AwardContractRequestContext) {
    const contract = await this.repository.createMilestone(contractId, input, context);
    if (!contract) throw requestError('Contract was not found after milestone creation.', 404);
    return contract;
  }

  async updateMilestone(contractId: string, milestoneId: string, input: ContractMilestonePatchInput, context: AwardContractRequestContext) {
    const contract = await this.repository.updateMilestone(contractId, milestoneId, input, context);
    if (!contract) throw requestError('Contract was not found after milestone update.', 404);
    return contract;
  }

  async addMilestoneEvidence(contractId: string, milestoneId: string, input: ContractMilestoneEvidenceInput, context: AwardContractRequestContext) {
    const contract = await this.repository.addMilestoneEvidence(contractId, milestoneId, input, context);
    if (!contract) throw requestError('Contract was not found after evidence update.', 404);
    return contract;
  }

  async updateContractStatus(contractId: string, input: ContractStatusPatchInput, context: AwardContractRequestContext) {
    const contract = await this.repository.updateContractStatus(contractId, input, context);
    if (!contract) throw requestError('Contract was not found after status update.', 404);
    return contract;
  }

  async submitActivationItem(contractId: string, itemId: string, input: ContractActivationItemSubmitInput, context: AwardContractRequestContext) {
    const contract = await this.repository.submitActivationItem(contractId, itemId, input, context);
    if (!contract) throw requestError('Contract was not found after activation item submission.', 404);
    return contract;
  }

  async reviewActivationItem(contractId: string, itemId: string, input: ContractActivationItemReviewInput, context: AwardContractRequestContext) {
    const contract = await this.repository.reviewActivationItem(contractId, itemId, input, context);
    if (!contract) throw requestError('Contract was not found after activation item review.', 404);
    return contract;
  }

  async activateContract(contractId: string, input: ContractActivateInput, context: AwardContractRequestContext) {
    const contract = await this.repository.activateContract(contractId, input, context);
    if (!contract) throw requestError('Contract was not found after activation.', 404);
    return contract;
  }

  createObligation(contractId: string, input: ContractObligationInput, context: AwardContractRequestContext) {
    return this.repository.createObligation(contractId, input, context);
  }

  createEvidenceRequirement(contractId: string, input: ContractEvidenceRequirementInput, context: AwardContractRequestContext) {
    return this.repository.createEvidenceRequirement(contractId, input, context);
  }

  createDeliverySchedule(contractId: string, input: ContractDeliveryScheduleInput, context: AwardContractRequestContext) {
    return this.repository.createDeliverySchedule(contractId, input, context);
  }

  createDispatchNotice(contractId: string, input: ContractDispatchNoticeInput, context: AwardContractRequestContext) {
    return this.repository.createDispatchNotice(contractId, input, context);
  }

  createGoodsReceipt(contractId: string, input: ContractGoodsReceiptInput, context: AwardContractRequestContext) {
    return this.repository.createGoodsReceipt(contractId, input, context);
  }

  createSiteHandover(contractId: string, input: ContractSiteHandoverInput, context: AwardContractRequestContext) {
    return this.repository.createSiteHandover(contractId, input, context);
  }

  createWorksProgressReport(contractId: string, input: ContractWorksProgressReportInput, context: AwardContractRequestContext) {
    return this.repository.createWorksProgressReport(contractId, input, context);
  }

  reviewWorksProgressReport(contractId: string, reportId: string, input: WorksProgressReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewWorksProgressReport(contractId, reportId, input, context);
  }

  createBoqMeasurement(contractId: string, input: ContractBoqMeasurementInput, context: AwardContractRequestContext) {
    return this.repository.createBoqMeasurement(contractId, input, context);
  }

  reviewBoqMeasurement(contractId: string, measurementId: string, input: BoqMeasurementReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewBoqMeasurement(contractId, measurementId, input, context);
  }

  createInterimPaymentCertificate(contractId: string, input: ContractInterimPaymentCertificateInput, context: AwardContractRequestContext) {
    return this.repository.createInterimPaymentCertificate(contractId, input, context);
  }

  certifyInterimPaymentCertificate(contractId: string, certificateId: string, input: InterimPaymentCertificateCertifyInput, context: AwardContractRequestContext) {
    return this.repository.certifyInterimPaymentCertificate(contractId, certificateId, input, context);
  }

  createWorksCompletionCertificate(contractId: string, input: WorksCompletionCertificateInput, context: AwardContractRequestContext) {
    return this.repository.createWorksCompletionCertificate(contractId, input, context);
  }

  createContractDefect(contractId: string, input: ContractDefectInput, context: AwardContractRequestContext) {
    return this.repository.createContractDefect(contractId, input, context);
  }

  respondToContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    return this.repository.respondToContractDefect(contractId, defectId, input, context);
  }

  verifyContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    return this.repository.verifyContractDefect(contractId, defectId, input, context);
  }

  closeContractDefect(contractId: string, defectId: string, input: ContractDefectActionInput, context: AwardContractRequestContext) {
    return this.repository.closeContractDefect(contractId, defectId, input, context);
  }

  createServiceLevel(contractId: string, input: ContractServiceLevelInput, context: AwardContractRequestContext) {
    return this.repository.createServiceLevel(contractId, input, context);
  }

  createServicePeriod(contractId: string, input: ContractServicePeriodInput, context: AwardContractRequestContext) {
    return this.repository.createServicePeriod(contractId, input, context);
  }

  createServiceReport(contractId: string, input: ContractServiceReportInput, context: AwardContractRequestContext) {
    return this.repository.createServiceReport(contractId, input, context);
  }

  reviewServiceReport(contractId: string, reportId: string, input: ServiceReportReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewServiceReport(contractId, reportId, input, context);
  }

  createServiceCredit(contractId: string, input: ContractServiceCreditInput, context: AwardContractRequestContext) {
    return this.repository.createServiceCredit(contractId, input, context);
  }

  reviewServiceCredit(contractId: string, creditId: string, input: ServiceCreditReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewServiceCredit(contractId, creditId, input, context);
  }

  createServiceIncident(contractId: string, input: ContractServiceIncidentInput, context: AwardContractRequestContext) {
    return this.repository.createServiceIncident(contractId, input, context);
  }

  respondToServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    return this.repository.respondToServiceIncident(contractId, incidentId, input, context);
  }

  verifyServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    return this.repository.verifyServiceIncident(contractId, incidentId, input, context);
  }

  closeServiceIncident(contractId: string, incidentId: string, input: ServiceIncidentActionInput, context: AwardContractRequestContext) {
    return this.repository.closeServiceIncident(contractId, incidentId, input, context);
  }

  createConsultancyDeliverable(contractId: string, input: ContractConsultancyDeliverableInput, context: AwardContractRequestContext) {
    return this.repository.createConsultancyDeliverable(contractId, input, context);
  }

  reviewConsultancyDeliverable(contractId: string, deliverableId: string, input: ConsultancyDeliverableReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewConsultancyDeliverable(contractId, deliverableId, input, context);
  }

  createDeliverableVersion(contractId: string, input: ContractDeliverableVersionInput, context: AwardContractRequestContext) {
    return this.repository.createDeliverableVersion(contractId, input, context);
  }

  reviewDeliverableVersion(contractId: string, versionId: string, input: ContractDeliverableReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewDeliverableVersion(contractId, versionId, input, context);
  }

  createDeliverableReview(contractId: string, input: ContractDeliverableReviewInput, context: AwardContractRequestContext) {
    return this.repository.createDeliverableReview(contractId, input, context);
  }

  confirmDeliverableReviewPaymentEligibility(contractId: string, reviewId: string, input: DeliverableReviewPaymentEligibilityInput, context: AwardContractRequestContext) {
    return this.repository.confirmDeliverableReviewPaymentEligibility(contractId, reviewId, input, context);
  }

  upsertConsultancyFinalReport(contractId: string, input: ConsultancyFinalReportInput, context: AwardContractRequestContext) {
    return this.repository.upsertConsultancyFinalReport(contractId, input, context);
  }

  reviewConsultancyFinalReport(contractId: string, reportId: string, input: ConsultancyFinalReportReviewInput, context: AwardContractRequestContext) {
    return this.repository.reviewConsultancyFinalReport(contractId, reportId, input, context);
  }

  createClaim(contractId: string, input: ContractClaimInput, context: AwardContractRequestContext) {
    return this.repository.createClaim(contractId, input, context);
  }

  createClaimResponse(contractId: string, input: ContractClaimResponseInput, context: AwardContractRequestContext) {
    return this.repository.createClaimResponse(contractId, input, context);
  }

  createExtensionRequest(contractId: string, input: ContractExtensionRequestInput, context: AwardContractRequestContext) {
    return this.repository.createExtensionRequest(contractId, input, context);
  }

  createAmendment(contractId: string, input: ContractAmendmentInput, context: AwardContractRequestContext) {
    return this.repository.createAmendment(contractId, input, context);
  }

  upsertManagementPlan(contractId: string, input: ContractManagementPlanInput, context: AwardContractRequestContext) {
    return this.repository.upsertManagementPlan(contractId, input, context);
  }

  generateManagementPlanDraft(contractId: string, input: ContractManagementPlanDraftInput, context: AwardContractRequestContext) {
    return this.repository.generateManagementPlanDraft(contractId, input, context);
  }

  upsertCommencement(contractId: string, input: ContractCommencementInput, context: AwardContractRequestContext) {
    return this.repository.upsertCommencement(contractId, input, context);
  }

  createNonConformance(contractId: string, input: ContractNonConformanceInput, context: AwardContractRequestContext) {
    return this.repository.createNonConformance(contractId, input, context);
  }

  createContractSecurity(contractId: string, input: ContractSecurityInput, context: AwardContractRequestContext) {
    return this.repository.createContractSecurity(contractId, input, context);
  }

  controlContractSecurity(contractId: string, securityId: string, action: 'review' | 'extend' | 'release' | 'claim' | 'waive', input: ContractSecurityActionInput, context: AwardContractRequestContext) {
    return this.repository.controlContractSecurity(contractId, securityId, action, input, context);
  }

  createContractPenalty(contractId: string, input: ContractPenaltyInput, context: AwardContractRequestContext) {
    return this.repository.createContractPenalty(contractId, input, context);
  }

  createContractChangeRequest(contractId: string, input: ContractChangeRequestInput, context: AwardContractRequestContext) {
    return this.repository.createContractChangeRequest(contractId, input, context);
  }

  controlChangeRequest(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlChangeRequest(contractId, itemId, action, input, context);
  }

  controlVariation(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlVariation(contractId, itemId, action, input, context);
  }

  controlExtensionRequest(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlExtensionRequest(contractId, itemId, action, input, context);
  }

  controlClaim(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlClaim(contractId, itemId, action, input, context);
  }

  controlNonConformance(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlNonConformance(contractId, itemId, action, input, context);
  }

  controlRisk(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlRisk(contractId, itemId, action, input, context);
  }

  controlIssue(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlIssue(contractId, itemId, action, input, context);
  }

  controlDispute(contractId: string, itemId: string, action: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlDispute(contractId, itemId, action, input, context);
  }

  updateMobilizationItem(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateMobilizationItem(contractId, itemId, input, context);
  }

  createInspection(contractId: string, input: InspectionInput, context: AwardContractRequestContext) {
    return this.repository.createInspection(contractId, input, context);
  }

  createGoodsInspection(contractId: string, input: GoodsInspectionInput, context: AwardContractRequestContext) {
    return this.repository.createGoodsInspection(contractId, input, context);
  }

  createInvoice(contractId: string, input: InvoiceInput, context: AwardContractRequestContext) {
    return this.repository.createInvoice(contractId, input, context);
  }

  upsertThreeWayMatch(contractId: string, input: ThreeWayMatchInput, context: AwardContractRequestContext) {
    return this.repository.upsertThreeWayMatch(contractId, input, context);
  }

  createPaymentApproval(contractId: string, input: PaymentApprovalInput, context: AwardContractRequestContext) {
    return this.repository.createPaymentApproval(contractId, input, context);
  }

  verifyInvoiceFinance(contractId: string, invoiceId: string, action: 'verify' | 'return' | 'reject', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.verifyInvoiceFinance(contractId, invoiceId, action, input, context);
  }

  correctInvoiceFinance(contractId: string, invoiceId: string, input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.correctInvoiceFinance(contractId, invoiceId, input, context);
  }

  createPaymentRecommendation(contractId: string, input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.createPaymentRecommendation(contractId, input, context);
  }

  reviewPaymentApproval(contractId: string, approvalId: string, action: 'review' | 'approve' | 'reject', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.reviewPaymentApproval(contractId, approvalId, action, input, context);
  }

  controlPayment(contractId: string, paymentId: string, action: 'initiate' | 'complete', input: FinanceWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlPayment(contractId, paymentId, action, input, context);
  }

  createPaymentConfirmation(contractId: string, input: PaymentConfirmationInput, context: AwardContractRequestContext) {
    return this.repository.createPaymentConfirmation(contractId, input, context);
  }

  createPerformanceScore(contractId: string, input: PerformanceScoreInput, context: AwardContractRequestContext) {
    return this.repository.createPerformanceScore(contractId, input, context);
  }

  createRiskForecast(contractId: string, input: RiskForecastInput, context: AwardContractRequestContext) {
    return this.repository.createRiskForecast(contractId, input, context);
  }

  upsertSupplierRiskProfile(contractId: string, input: SupplierRiskProfileInput, context: AwardContractRequestContext) {
    return this.repository.upsertSupplierRiskProfile(contractId, input, context);
  }

  createRisk(contractId: string, input: RiskInput, context: AwardContractRequestContext) {
    return this.repository.createRisk(contractId, input, context);
  }

  updateRisk(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateRisk(contractId, itemId, input, context);
  }

  createVariation(contractId: string, input: VariationInput, context: AwardContractRequestContext) {
    return this.repository.createVariation(contractId, input, context);
  }

  updateVariation(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateVariation(contractId, itemId, input, context);
  }

  createIssue(contractId: string, input: LifecycleItemInput, context: AwardContractRequestContext) {
    return this.repository.createIssue(contractId, input, context);
  }

  updateIssue(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateIssue(contractId, itemId, input, context);
  }

  createDispute(contractId: string, input: LifecycleItemInput, context: AwardContractRequestContext) {
    return this.repository.createDispute(contractId, input, context);
  }

  updateDispute(contractId: string, itemId: string, input: LifecycleItemPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateDispute(contractId, itemId, input, context);
  }

  createTermination(contractId: string, input: TerminationInput, context: AwardContractRequestContext) {
    return this.repository.createTermination(contractId, input, context);
  }

  updateTermination(contractId: string, terminationId: string, input: TerminationPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateTermination(contractId, terminationId, input, context);
  }

  addTerminationNotice(contractId: string, terminationId: string, input: TerminationNoticeInput, context: AwardContractRequestContext) {
    return this.repository.addTerminationNotice(contractId, terminationId, input, context);
  }

  addTerminationEvidence(contractId: string, terminationId: string, input: TerminationEvidenceInput, context: AwardContractRequestContext) {
    return this.repository.addTerminationEvidence(contractId, terminationId, input, context);
  }

  upsertTerminationValuation(contractId: string, terminationId: string, input: TerminationValuationInput, context: AwardContractRequestContext) {
    return this.repository.upsertTerminationValuation(contractId, terminationId, input, context);
  }

  upsertTerminationSettlement(contractId: string, terminationId: string, input: TerminationSettlementInput, context: AwardContractRequestContext) {
    return this.repository.upsertTerminationSettlement(contractId, terminationId, input, context);
  }

  upsertReplacementProcurement(contractId: string, terminationId: string, input: ReplacementProcurementInput, context: AwardContractRequestContext) {
    return this.repository.upsertReplacementProcurement(contractId, terminationId, input, context);
  }

  upsertCloseout(contractId: string, input: ContractCloseoutInput, context: AwardContractRequestContext) {
    return this.repository.upsertCloseout(contractId, input, context);
  }

  updateCloseoutStep(contractId: string, stepId: string, input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.updateCloseoutStep(contractId, stepId, input, context);
  }

  upsertSupplierPerformance(contractId: string, input: SupplierPerformanceInput, context: AwardContractRequestContext) {
    return this.repository.upsertSupplierPerformance(contractId, input, context);
  }

  updateInvoiceStatus(contractId: string, invoiceId: string, input: InvoiceStatusPatchInput, context: AwardContractRequestContext) {
    return this.repository.updateInvoiceStatus(contractId, invoiceId, input, context);
  }

  upsertClause(contractId: string, input: ClauseInput, context: AwardContractRequestContext) {
    return this.repository.upsertClause(contractId, input, context);
  }

  deleteClause(contractId: string, clauseId: string, context: AwardContractRequestContext) {
    return this.repository.deleteClause(contractId, clauseId, context);
  }

  createNegotiation(contractId: string, input: NegotiationInput, context: AwardContractRequestContext) {
    return this.repository.createNegotiation(contractId, input, context);
  }

  updateNegotiation(contractId: string, negotiationId: string, input: ContractNegotiationDecisionInput, context: AwardContractRequestContext) {
    return this.repository.updateNegotiation(contractId, negotiationId, input, context);
  }

  createDeliverable(contractId: string, input: DeliverableInput, context: AwardContractRequestContext) {
    return this.repository.createDeliverable(contractId, input, context);
  }

  createAcceptance(contractId: string, input: AcceptanceInput, context: AwardContractRequestContext) {
    return this.repository.createAcceptance(contractId, input, context);
  }

  createPaymentSchedule(contractId: string, input: PaymentScheduleInput, context: AwardContractRequestContext) {
    return this.repository.createPaymentSchedule(contractId, input, context);
  }

  createPayment(contractId: string, input: ContractPaymentInput, context: AwardContractRequestContext) {
    return this.repository.createPayment(contractId, input, context);
  }

  upsertWarranty(contractId: string, input: WarrantyInput, context: AwardContractRequestContext) {
    return this.repository.upsertWarranty(contractId, input, context);
  }

  controlWarranty(contractId: string, warrantyId: string, action: 'respond' | 'verify' | 'close', input: ControlWorkflowActionInput, context: AwardContractRequestContext) {
    return this.repository.controlWarranty(contractId, warrantyId, action, input, context);
  }

  createContractNotice(contractId: string, input: ContractNoticeInput, context: AwardContractRequestContext) {
    return this.repository.createContractNotice(contractId, input, context);
  }

  controlContractNotice(contractId: string, noticeId: string, action: 'acknowledge' | 'respond' | 'close', input: ContractNoticeActionInput, context: AwardContractRequestContext) {
    return this.repository.controlContractNotice(contractId, noticeId, action, input, context);
  }

  createContractMeeting(contractId: string, input: ContractMeetingInput, context: AwardContractRequestContext) {
    return this.repository.createContractMeeting(contractId, input, context);
  }

  createContractMeetingAction(contractId: string, meetingId: string, input: ContractMeetingActionInput, context: AwardContractRequestContext) {
    return this.repository.createContractMeetingAction(contractId, meetingId, input, context);
  }

  controlContractMeetingAction(contractId: string, actionId: string, action: 'complete' | 'verify' | 'close', input: ContractMeetingActionPatchInput, context: AwardContractRequestContext) {
    return this.repository.controlContractMeetingAction(contractId, actionId, action, input, context);
  }

  recalculateUrgentActions(contractId: string, context: AwardContractRequestContext) {
    return this.repository.recalculateUrgentActions(contractId, context);
  }

  upsertRequiredDocument(contractId: string, input: RequiredDocumentInput, context: AwardContractRequestContext) {
    return this.repository.upsertRequiredDocument(contractId, input, context);
  }

  upsertWorkflowApproval(contractId: string, input: WorkflowApprovalInput, context: AwardContractRequestContext) {
    return this.repository.upsertWorkflowApproval(contractId, input, context);
  }
}
