import { apiClient } from '@/shared/api/http';
import type { PostAwardContractRow, PostAwardDocument, PostAwardWorkspace } from '../types';

export const postAwardApi = {
  async contracts() {
    const response = await apiClient.get<PostAwardContractRow[]>('/api/post-award/contracts');
    return response.data;
  },
  async workspace(contractId: string) {
    const response = await apiClient.get<PostAwardWorkspace>(`/api/post-award/contracts/${contractId}/workspace`);
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
