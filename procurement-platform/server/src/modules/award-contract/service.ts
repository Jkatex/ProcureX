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
  type ContractCloseoutInput,
  type AwardContractDocumentUploadInput,
  type ContractCommencementInput,
  type ContractManagementPlanInput,
  type ContractNonConformanceInput,
  type ContractPaymentInput,
  type ContractPenaltyInput,
  type ContractReferenceSampleInput,
  type ContractSecurityInput,
  type AwardRecommendationQuery,
  type DeliverableInput,
  type DeliveryFeasibilityInput,
  type GoodsInspectionInput,
  type InvoiceInput,
  type ContractMilestoneEvidenceInput,
  type ContractMilestoneInput,
  type ContractMilestonePatchInput,
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

  upsertManagementPlan(contractId: string, input: ContractManagementPlanInput, context: AwardContractRequestContext) {
    return this.repository.upsertManagementPlan(contractId, input, context);
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

  createContractPenalty(contractId: string, input: ContractPenaltyInput, context: AwardContractRequestContext) {
    return this.repository.createContractPenalty(contractId, input, context);
  }

  createContractChangeRequest(contractId: string, input: ContractChangeRequestInput, context: AwardContractRequestContext) {
    return this.repository.createContractChangeRequest(contractId, input, context);
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

  upsertRequiredDocument(contractId: string, input: RequiredDocumentInput, context: AwardContractRequestContext) {
    return this.repository.upsertRequiredDocument(contractId, input, context);
  }

  upsertWorkflowApproval(contractId: string, input: WorkflowApprovalInput, context: AwardContractRequestContext) {
    return this.repository.upsertWorkflowApproval(contractId, input, context);
  }
}
