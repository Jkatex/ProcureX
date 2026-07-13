import { apiClient } from '@/shared/api/http';
import type { AwardContractDashboard, AwardDecisionDraftInput, AwardRecommendationDetailDto, ContractDetailDto } from '../types';

const emptyDashboard: AwardContractDashboard = {
  summary: {
    urgentActions: 0,
    awardQueues: 0,
    contractActions: 0
  },
  queues: {
    'my-urgent-actions': [],
    'awarding-in-progress': [],
    'awards-received': [],
    'contracts-in-progress': [],
    'active-contracts': [],
    'closed-contracts': []
  }
};

export const awardsContractsApi = {
  async dashboard() {
    if (import.meta.env.MODE === 'test') return emptyDashboard;
    const response = await apiClient.get<AwardContractDashboard>('/api/award-contract/dashboard');
    return response.data;
  },
  async contract(contractId: string) {
    if (import.meta.env.MODE === 'test') throw new Error(`No test contract fixture for ${contractId}.`);
    const response = await apiClient.get<ContractDetailDto>(`/api/award-contract/contracts/${contractId}`);
    return response.data;
  },
  async recommendation(recommendationId: string) {
    if (import.meta.env.MODE === 'test') throw new Error(`No test recommendation fixture for ${recommendationId}.`);
    const response = await apiClient.get<AwardRecommendationDetailDto>(`/api/award-contract/recommendations/${recommendationId}`);
    return response.data;
  },
  async upsertAwardApprovalRoute(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/recommendations/${recommendationId}/approval-route`, payload);
    return response.data;
  },
  async saveAwardDecisionDraft(recommendationId: string, payload: AwardDecisionDraftInput) {
    const response = await apiClient.patch<AwardRecommendationDetailDto>(`/api/award-contract/recommendations/${recommendationId}/draft`, payload);
    return response.data;
  },
  async upsertAwardApprovalStep(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/recommendations/${recommendationId}/approval-steps`, payload);
    return response.data;
  },
  async createAwardTieBreaker(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/tie-breakers`, payload);
    return response.data;
  },
  async upsertDeliveryFeasibility(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/recommendations/${recommendationId}/delivery-feasibility`, payload);
    return response.data;
  },
  async upsertStandstillPeriod(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/recommendations/${recommendationId}/standstill`, payload);
    return response.data;
  },
  async createAwardNotification(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/notifications`, payload);
    return response.data;
  },
  async createBudgetCommitmentForRecommendation(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/budget-commitments`, payload);
    return response.data;
  },
  async upsertAwardClause(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/recommendations/${recommendationId}/clauses`, payload);
    return response.data;
  },
  async createAwardNegotiation(recommendationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/negotiations`, payload);
    return response.data;
  },
  async generateAwardBidPack(recommendationId: string) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/bid-pack`);
    return response.data;
  },
  async settleAwardGroup(recommendationId: string, note = '', payload: Record<string, unknown> = {}) {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/settle`, { note, payload });
    return response.data;
  },
  async approveRecommendation(recommendationId: string, note = '', payload: Partial<AwardDecisionDraftInput> = {}) {
    const response = await apiClient.post<AwardRecommendationDetailDto>(`/api/award-contract/recommendations/${recommendationId}/approve`, { ...payload, note });
    return response.data;
  },
  async returnRecommendation(recommendationId: string, note = '') {
    const response = await apiClient.post(`/api/award-contract/recommendations/${recommendationId}/return`, { note });
    return response.data;
  },
  async respondToNotice(noticeId: string, action: 'ACCEPT' | 'REQUEST_CLARIFICATION' | 'DECLINE', note = '', payload: Record<string, unknown> = {}) {
    const response = await apiClient.post(`/api/award-contract/notices/${noticeId}/respond`, { action, note, payload });
    return response.data;
  },
  async saveDraft(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/versions`, { payload });
    return response.data;
  },
  async createSignatureRequests(contractId: string, roles: Array<'BUYER' | 'SUPPLIER'> = ['BUYER', 'SUPPLIER']) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/signatures`, { roles });
    return response.data;
  },
  async updateContractStatus(contractId: string, status: string, note = '') {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/status`, { status, note });
    return response.data;
  },
  async upsertManagementPlan(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/management-plan`, payload);
    return response.data;
  },
  async updateMobilizationItem(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/mobilization/${itemId}`, payload);
    return response.data;
  },
  async createMilestone(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/milestones`, payload);
    return response.data;
  },
  async updateMilestone(contractId: string, milestoneId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/milestones/${milestoneId}`, payload);
    return response.data;
  },
  async addMilestoneEvidence(contractId: string, milestoneId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/milestones/${milestoneId}/evidence`, payload);
    return response.data;
  },
  async upsertClause(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/clauses`, payload);
    return response.data;
  },
  async createNegotiation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/negotiations`, payload);
    return response.data;
  },
  async createDeliverable(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/deliverables`, payload);
    return response.data;
  },
  async createAcceptance(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/acceptances`, payload);
    return response.data;
  },
  async createInspection(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/inspections`, payload);
    return response.data;
  },
  async createGoodsInspection(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/goods-inspections`, payload);
    return response.data;
  },
  async createInvoice(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/invoices`, payload);
    return response.data;
  },
  async upsertThreeWayMatch(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/three-way-match`, payload);
    return response.data;
  },
  async createPaymentApproval(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/payment-approvals`, payload);
    return response.data;
  },
  async createPaymentConfirmation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/payment-confirmations`, payload);
    return response.data;
  },
  async createPaymentSchedule(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/payment-schedules`, payload);
    return response.data;
  },
  async createPayment(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/payments`, payload);
    return response.data;
  },
  async createRisk(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/risks`, payload);
    return response.data;
  },
  async createRiskForecast(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/risk-forecasts`, payload);
    return response.data;
  },
  async updateRisk(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/risks/${itemId}`, payload);
    return response.data;
  },
  async createVariation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/variations`, payload);
    return response.data;
  },
  async updateVariation(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/variations/${itemId}`, payload);
    return response.data;
  },
  async createIssue(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/issues`, payload);
    return response.data;
  },
  async updateIssue(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/issues/${itemId}`, payload);
    return response.data;
  },
  async createDispute(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/disputes`, payload);
    return response.data;
  },
  async updateDispute(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/disputes/${itemId}`, payload);
    return response.data;
  },
  async createTermination(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/terminations`, payload);
    return response.data;
  },
  async updateTermination(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}`, payload);
    return response.data;
  },
  async addTerminationNotice(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}/notices`, payload);
    return response.data;
  },
  async addTerminationEvidence(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}/evidence`, payload);
    return response.data;
  },
  async upsertTerminationValuation(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}/valuation`, payload);
    return response.data;
  },
  async upsertTerminationSettlement(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}/settlement`, payload);
    return response.data;
  },
  async upsertReplacementProcurement(contractId: string, terminationId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/terminations/${terminationId}/replacement-procurement`, payload);
    return response.data;
  },
  async upsertCloseout(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/closeout`, payload);
    return response.data;
  },
  async upsertSupplierPerformance(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/supplier-performance`, payload);
    return response.data;
  },
  async createPerformanceScore(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/performance-scores`, payload);
    return response.data;
  },
  async upsertSupplierRiskProfile(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/supplier-risk-profile`, payload);
    return response.data;
  },
  async upsertWarranty(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/warranties`, payload);
    return response.data;
  },
  async upsertRequiredDocument(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/required-documents`, payload);
    return response.data;
  },
  async upsertWorkflowApproval(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put(`/api/award-contract/contracts/${contractId}/workflow-approvals`, payload);
    return response.data;
  },
  async updateInvoiceStatus(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch(`/api/award-contract/contracts/${contractId}/invoices/${invoiceId}/status`, payload);
    return response.data;
  },
  async signContractSignature(
    contractId: string,
    signatureId: string,
    input: {
      signerName: string;
      signerTitle?: string;
      signatureKeyphrase: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/signatures/${signatureId}/sign`, {
      signerName: input.signerName,
      signerTitle: input.signerTitle ?? '',
      signatureKeyphrase: input.signatureKeyphrase,
      payload: input.payload ?? {}
    });
    return response.data;
  }
};
