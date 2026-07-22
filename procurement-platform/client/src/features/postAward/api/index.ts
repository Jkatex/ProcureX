/* Wraps post Award HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import { awardsContractsApi } from '@/features/awardsContracts/api';
import type { PostAwardContractRow, PostAwardDocument, PostAwardWorkspace } from '../types';

export const postAwardApi = {
  dashboard: awardsContractsApi.dashboard,
  contract: awardsContractsApi.contract,
  contractDocuments: awardsContractsApi.contractDocuments,
  uploadContractDocument: awardsContractsApi.uploadContractDocument,
  updateContractStatus: awardsContractsApi.updateContractStatus,
  upsertCommencement: awardsContractsApi.upsertCommencement,
  createMilestone: awardsContractsApi.createMilestone,
  updateMilestone: awardsContractsApi.updateMilestone,
  updateMobilizationItem: awardsContractsApi.updateMobilizationItem,
  createPaymentConfirmation: awardsContractsApi.createPaymentConfirmation,
  createPaymentSchedule: awardsContractsApi.createPaymentSchedule,
  createRisk: awardsContractsApi.createRisk,
  updateRisk: awardsContractsApi.updateRisk,
  createRiskForecast: awardsContractsApi.createRiskForecast,
  updateVariation: awardsContractsApi.updateVariation,
  updateIssue: awardsContractsApi.updateIssue,
  updateDispute: awardsContractsApi.updateDispute,
  updateTermination: awardsContractsApi.updateTermination,
  addTerminationNotice: awardsContractsApi.addTerminationNotice,
  addTerminationEvidence: awardsContractsApi.addTerminationEvidence,
  upsertTerminationValuation: awardsContractsApi.upsertTerminationValuation,
  upsertTerminationSettlement: awardsContractsApi.upsertTerminationSettlement,
  upsertReplacementProcurement: awardsContractsApi.upsertReplacementProcurement,
  createPerformanceScore: awardsContractsApi.createPerformanceScore,
  upsertSupplierRiskProfile: awardsContractsApi.upsertSupplierRiskProfile,
  upsertWorkflowApproval: awardsContractsApi.upsertWorkflowApproval,
  async contracts() {
    const response = await apiClient.get<PostAwardContractRow[]>('/api/post-award/contracts');
    return response.data;
  },
  async workspace(contractId: string) {
    const response = await apiClient.get<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/workspace`);
    return response.data;
  },
  async actions(contractId: string) {
    const response = await apiClient.get<PostAwardWorkspace['actions']>(`/api/post-award/contracts/${contractId}/actions`);
    return response.data;
  },
  async uploadDocument(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardDocument>(`/api/post-award/contracts/${contractId}/documents`, payload);
    return response.data;
  },
  async upsertManagementPlan(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/management-plan`, payload);
    return response.data;
  },
  async generateManagementPlanDraft(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/management-plan/generate-draft`, payload);
    return response.data;
  },
  async submitActivationItem(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/activation/items/${itemId}/submit`, payload);
    return response.data;
  },
  async reviewActivationItem(contractId: string, itemId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/activation/items/${itemId}/review`, payload);
    return response.data;
  },
  async activateContract(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/activate`, payload);
    return response.data;
  },
  async createObligation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/obligations`, payload);
    return response.data;
  },
  async createEvidenceRequirement(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/evidence-requirements`, payload);
    return response.data;
  },
  async createDeliverySchedule(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/goods/delivery-schedules`, payload);
    return response.data;
  },
  async createDispatchNotice(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/goods/dispatch-notices`, payload);
    return response.data;
  },
  async createGoodsReceipt(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/goods/receipts`, payload);
    return response.data;
  },
  async createGoodsInspection(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/goods/inspections`, payload);
    return response.data;
  },
  async createSiteHandover(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/site-handovers`, payload);
    return response.data;
  },
  async createWorksProgressReport(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/progress-reports`, payload);
    return response.data;
  },
  async reviewWorksProgressReport(contractId: string, reportId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/progress-reports/${reportId}/review`, payload);
    return response.data;
  },
  async createBoqMeasurement(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/boq-measurements`, payload);
    return response.data;
  },
  async reviewBoqMeasurement(contractId: string, measurementId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/boq-measurements/${measurementId}/review`, payload);
    return response.data;
  },
  async createInterimPaymentCertificate(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/interim-payment-certificates`, payload);
    return response.data;
  },
  async certifyInterimPaymentCertificate(contractId: string, certificateId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/interim-payment-certificates/${certificateId}/certify`, payload);
    return response.data;
  },
  async createWorksCompletionCertificate(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/completion-certificates`, payload);
    return response.data;
  },
  async createContractDefect(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/defects`, payload);
    return response.data;
  },
  async respondToContractDefect(contractId: string, defectId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/defects/${defectId}/respond`, payload);
    return response.data;
  },
  async verifyContractDefect(contractId: string, defectId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/defects/${defectId}/verify`, payload);
    return response.data;
  },
  async closeContractDefect(contractId: string, defectId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/defects/${defectId}/close`, payload);
    return response.data;
  },
  async createServiceLevel(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/levels`, payload);
    return response.data;
  },
  async createServicePeriod(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/periods`, payload);
    return response.data;
  },
  async createServiceReport(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/reports`, payload);
    return response.data;
  },
  async reviewServiceReport(contractId: string, reportId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/reports/${reportId}/review`, payload);
    return response.data;
  },
  async createServiceCredit(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/credits`, payload);
    return response.data;
  },
  async reviewServiceCredit(contractId: string, creditId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/credits/${creditId}/review`, payload);
    return response.data;
  },
  async createServiceIncident(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/incidents`, payload);
    return response.data;
  },
  async respondToServiceIncident(contractId: string, incidentId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/incidents/${incidentId}/respond`, payload);
    return response.data;
  },
  async verifyServiceIncident(contractId: string, incidentId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/incidents/${incidentId}/verify`, payload);
    return response.data;
  },
  async closeServiceIncident(contractId: string, incidentId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/incidents/${incidentId}/close`, payload);
    return response.data;
  },
  async createConsultancyDeliverable(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/deliverables`, payload);
    return response.data;
  },
  async reviewConsultancyDeliverable(contractId: string, deliverableId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/deliverables/${deliverableId}/review`, payload);
    return response.data;
  },
  async createDeliverableVersion(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/versions`, payload);
    return response.data;
  },
  async reviewDeliverableVersion(contractId: string, versionId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/versions/${versionId}/review`, payload);
    return response.data;
  },
  async createDeliverableReview(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/reviews`, payload);
    return response.data;
  },
  async confirmDeliverableReviewPaymentEligibility(contractId: string, reviewId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/reviews/${reviewId}/confirm-payment-eligibility`, payload);
    return response.data;
  },
  async upsertConsultancyFinalReport(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/final-report`, payload);
    return response.data;
  },
  async reviewConsultancyFinalReport(contractId: string, reportId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/final-report/${reportId}/review`, payload);
    return response.data;
  },
  async createClaim(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/claims`, payload);
    return response.data;
  },
  async createClaimResponse(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/claim-responses`, payload);
    return response.data;
  },
  async createExtensionRequest(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/extension-requests`, payload);
    return response.data;
  },
  async createAmendment(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/amendments`, payload);
    return response.data;
  },
  async createContractChangeRequest(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/change-requests`, payload);
    return response.data;
  },
  async controlChangeRequest(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/change-requests/${recordId}/${action}`, payload);
    return response.data;
  },
  async createNonConformance(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/non-conformances`, payload);
    return response.data;
  },
  async controlNonConformance(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/non-conformances/${recordId}/${action}`, payload);
    return response.data;
  },
  async createContractSecurity(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/securities`, payload);
    return response.data;
  },
  async controlContractSecurity(contractId: string, securityId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/securities/${securityId}/${action}`, payload);
    return response.data;
  },
  async createContractPenalty(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/penalties`, payload);
    return response.data;
  },
  async createDeliverable(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/deliverables`, payload);
    return response.data;
  },
  async addMilestoneEvidence(contractId: string, milestoneId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/milestones/${milestoneId}/evidence`, payload);
    return response.data;
  },
  async createInspection(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/inspections`, payload);
    return response.data;
  },
  async createAcceptance(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/acceptances`, payload);
    return response.data;
  },
  async createInvoice(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices`, payload);
    return response.data;
  },
  async upsertThreeWayMatch(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/three-way-match`, payload);
    return response.data;
  },
  async createPaymentApproval(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payment-approvals`, payload);
    return response.data;
  },
  async verifyInvoiceFinance(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/verify`, payload);
    return response.data;
  },
  async returnInvoiceFinance(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/return`, payload);
    return response.data;
  },
  async rejectInvoiceFinance(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/reject`, payload);
    return response.data;
  },
  async correctInvoiceFinance(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/correct`, payload);
    return response.data;
  },
  async createPaymentRecommendation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payment-recommendations`, payload);
    return response.data;
  },
  async reviewPaymentApproval(contractId: string, approvalId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payment-approvals/${approvalId}/${action}`, payload);
    return response.data;
  },
  async updateInvoiceStatus(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/status`, payload);
    return response.data;
  },
  async createPayment(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payments`, payload);
    return response.data;
  },
  async controlPayment(contractId: string, paymentId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payments/${paymentId}/${action}`, payload);
    return response.data;
  },
  async createPostAwardPaymentConfirmation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payment-confirmations`, payload);
    return response.data;
  },
  async createFinanceDeduction(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/finance/deductions`, payload);
    return response.data;
  },
  async createFinanceRetention(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/finance/retention`, payload);
    return response.data;
  },
  async createFinanceAdvanceRecovery(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/finance/advance-recovery`, payload);
    return response.data;
  },
  async createFinanceLiquidatedDamages(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/finance/liquidated-damages`, payload);
    return response.data;
  },
  async createIssue(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/issues`, payload);
    return response.data;
  },
  async controlIssue(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/issues/${recordId}/${action}`, payload);
    return response.data;
  },
  async createVariation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/variations`, payload);
    return response.data;
  },
  async controlVariation(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/variations/${recordId}/${action}`, payload);
    return response.data;
  },
  async controlExtensionRequest(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/extension-requests/${recordId}/${action}`, payload);
    return response.data;
  },
  async controlClaim(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/claims/${recordId}/${action}`, payload);
    return response.data;
  },
  async createDispute(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/disputes`, payload);
    return response.data;
  },
  async controlDispute(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/disputes/${recordId}/${action}`, payload);
    return response.data;
  },
  async controlRisk(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/risks/${recordId}/${action}`, payload);
    return response.data;
  },
  async createTermination(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/terminations`, payload);
    return response.data;
  },
  async controlTermination(contractId: string, recordId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/terminations/${recordId}/${action}`, payload);
    return response.data;
  },
  async upsertWarranty(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/warranties`, payload);
    return response.data;
  },
  async controlWarranty(contractId: string, warrantyId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/warranties/${warrantyId}/${action}`, payload);
    return response.data;
  },
  async createContractNotice(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/notices`, payload);
    return response.data;
  },
  async controlContractNotice(contractId: string, noticeId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/notices/${noticeId}/${action}`, payload);
    return response.data;
  },
  async createContractMeeting(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/meetings`, payload);
    return response.data;
  },
  async createContractMeetingAction(contractId: string, meetingId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/meetings/${meetingId}/actions`, payload);
    return response.data;
  },
  async controlContractMeetingAction(contractId: string, actionId: string, action: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/meeting-actions/${actionId}/${action}`, payload);
    return response.data;
  },
  async recalculateUrgentActions(contractId: string) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/urgent-actions/recalculate`, {});
    return response.data;
  },
  async updateCloseoutStep(contractId: string, stepId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/closeout/steps/${stepId}`, payload);
    return response.data;
  },
  async upsertRequiredDocument(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/required-documents`, payload);
    return response.data;
  },
  async upsertSupplierPerformance(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/supplier-performance`, payload);
    return response.data;
  },
  async upsertCloseout(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/closeout`, payload);
    return response.data;
  }
};
