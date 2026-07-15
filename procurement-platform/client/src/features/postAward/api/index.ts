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
  createGoodsInspection: awardsContractsApi.createGoodsInspection,
  upsertThreeWayMatch: awardsContractsApi.upsertThreeWayMatch,
  createPaymentApproval: awardsContractsApi.createPaymentApproval,
  createPaymentConfirmation: awardsContractsApi.createPaymentConfirmation,
  createPaymentSchedule: awardsContractsApi.createPaymentSchedule,
  createRisk: awardsContractsApi.createRisk,
  updateRisk: awardsContractsApi.updateRisk,
  createRiskForecast: awardsContractsApi.createRiskForecast,
  updateVariation: awardsContractsApi.updateVariation,
  updateIssue: awardsContractsApi.updateIssue,
  createDispute: awardsContractsApi.createDispute,
  updateDispute: awardsContractsApi.updateDispute,
  createTermination: awardsContractsApi.createTermination,
  updateTermination: awardsContractsApi.updateTermination,
  addTerminationNotice: awardsContractsApi.addTerminationNotice,
  addTerminationEvidence: awardsContractsApi.addTerminationEvidence,
  upsertTerminationValuation: awardsContractsApi.upsertTerminationValuation,
  upsertTerminationSettlement: awardsContractsApi.upsertTerminationSettlement,
  upsertReplacementProcurement: awardsContractsApi.upsertReplacementProcurement,
  upsertSupplierPerformance: awardsContractsApi.upsertSupplierPerformance,
  createPerformanceScore: awardsContractsApi.createPerformanceScore,
  upsertSupplierRiskProfile: awardsContractsApi.upsertSupplierRiskProfile,
  upsertWarranty: awardsContractsApi.upsertWarranty,
  upsertRequiredDocument: awardsContractsApi.upsertRequiredDocument,
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
  async createSiteHandover(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/site-handovers`, payload);
    return response.data;
  },
  async createWorksProgressReport(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/progress-reports`, payload);
    return response.data;
  },
  async createBoqMeasurement(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/boq-measurements`, payload);
    return response.data;
  },
  async createInterimPaymentCertificate(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/interim-payment-certificates`, payload);
    return response.data;
  },
  async createContractDefect(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/works/defects`, payload);
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
  async createServiceCredit(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/services/credits`, payload);
    return response.data;
  },
  async createConsultancyDeliverable(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/deliverables`, payload);
    return response.data;
  },
  async createDeliverableVersion(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/versions`, payload);
    return response.data;
  },
  async createDeliverableReview(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/consultancy/reviews`, payload);
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
  async updateInvoiceStatus(contractId: string, invoiceId: string, payload: Record<string, unknown>) {
    const response = await apiClient.patch<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/invoices/${invoiceId}/status`, payload);
    return response.data;
  },
  async createPayment(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/payments`, payload);
    return response.data;
  },
  async createIssue(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/issues`, payload);
    return response.data;
  },
  async createVariation(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.post<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/variations`, payload);
    return response.data;
  },
  async upsertCloseout(contractId: string, payload: Record<string, unknown>) {
    const response = await apiClient.put<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/closeout`, payload);
    return response.data;
  }
};
