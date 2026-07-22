/* Wraps evaluation HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import type {
  EvaluationDashboard,
  EvaluationDraftsResponse,
  EvaluationRecordsQuery,
  EvaluationRecordsResponse,
  EvaluationWorkspace,
  ReadyEvaluationResponse,
  SaveEvaluationWorkspaceInput
} from '@/features/evaluation/types';

export const evaluationApi = {
  async getDashboard() {
    const response = await apiClient.get<EvaluationDashboard>('/api/evaluations/dashboard');
    return response.data;
  },
  async listRecords(query: EvaluationRecordsQuery) {
    const response = await apiClient.get<EvaluationRecordsResponse>('/api/evaluations/records', {
      params: query
    });
    return response.data;
  },
  async listDrafts() {
    const response = await apiClient.get<EvaluationDraftsResponse>('/api/evaluations/drafts');
    return response.data;
  },
  async listReady() {
    const response = await apiClient.get<ReadyEvaluationResponse>('/api/evaluations/ready');
    return response.data;
  },
  async getWorkspace(tenderId: string) {
    const response = await apiClient.get<EvaluationWorkspace>(`/api/evaluations/tenders/${tenderId}/workspace`);
    return response.data;
  },
  async saveWorkspace(tenderId: string, payload: SaveEvaluationWorkspaceInput) {
    const response = await apiClient.put<EvaluationWorkspace>(`/api/evaluations/tenders/${tenderId}/workspace`, payload);
    return response.data;
  }
};
