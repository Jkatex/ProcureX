import { mockApi } from '@/shared/api/mockApi';
import { apiClient } from '@/shared/api/http';
import type { VerificationProfile } from '@/features/identity/types';
import type { RiskLevel, ScreeningStatus, SessionUser, TrustTier } from '@/shared/types/domain';

export type AdminVerification = VerificationProfile & {
  user: SessionUser;
  reviewReasons: string[];
  screeningStatus: ScreeningStatus;
  trustTier: TrustTier;
  riskLevel: RiskLevel;
};

export const adminApi = {
  getMetrics: mockApi.getAdminMetrics,
  getChartSeries: mockApi.getChartSeries,
  async listVerifications(status?: SessionUser['verificationStatus']) {
    const response = await apiClient.get<AdminVerification[]>('/api/identity/admin/verifications', {
      params: status ? { status } : undefined
    });
    return response.data;
  },
  async decideVerification(id: string, input: { decision: 'approve' | 'reject'; note?: string }) {
    const response = await apiClient.post<AdminVerification>(`/api/identity/admin/verifications/${id}/decision`, input);
    return response.data;
  },
  async rescreenVerification(id: string) {
    const response = await apiClient.post<AdminVerification>(`/api/identity/admin/verifications/${id}/rescreen`);
    return response.data;
  }
};
