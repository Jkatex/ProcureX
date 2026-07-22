/* Wraps workspace HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
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
