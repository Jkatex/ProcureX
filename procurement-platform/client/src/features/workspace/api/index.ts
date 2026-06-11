import { apiClient } from '@/shared/api/http';
import type { WorkspaceDashboardData } from '@/features/workspace/types';

export const workspaceDashboardApi = {
  async getWorkspaceDashboard(query: { organizationId?: string; deadlineWindowDays?: number; itemLimit?: number } = {}) {
    const response = await apiClient.get<WorkspaceDashboardData>('/api/dashboard/workspace', {
      params: query
    });
    return response.data;
  }
};
