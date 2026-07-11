import { apiClient } from '@/shared/api/http';
import type {
  RecordsCharts,
  RecordsDashboard,
  RecordsDetail,
  RecordsInsights,
  RecordsListResponse,
  RecordsQuery
} from '@/features/records/types';

export const recordsApi = {
  async getDashboard() {
    const response = await apiClient.get<RecordsDashboard>('/api/records/dashboard');
    return response.data;
  },

  async listRecords(query: RecordsQuery) {
    const response = await apiClient.get<RecordsListResponse>('/api/records', {
      params: query
    });
    return response.data;
  },

  async getCharts(query: RecordsQuery) {
    const response = await apiClient.get<RecordsCharts>('/api/records/charts', {
      params: query
    });
    return response.data;
  },

  async getInsights(query: RecordsQuery) {
    const response = await apiClient.get<RecordsInsights>('/api/records/insights', {
      params: query
    });
    return response.data;
  },

  async getDetail(recordId: string) {
    const response = await apiClient.get<RecordsDetail>(`/api/records/${encodeURIComponent(recordId)}`);
    return response.data;
  },

  async exportCsv(query: RecordsQuery) {
    const response = await apiClient.get<Blob>('/api/records/export/csv', {
      params: query,
      responseType: 'blob'
    });
    return response.data;
  },

  async exportPdf(query: RecordsQuery) {
    const response = await apiClient.get<Blob>('/api/records/export/pdf', {
      params: query,
      responseType: 'blob'
    });
    return response.data;
  }
};
