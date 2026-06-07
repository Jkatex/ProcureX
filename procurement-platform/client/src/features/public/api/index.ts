import { mockApi } from '@/shared/api/mockApi';
import { apiClient } from '@/shared/api/http';
import type { CurrentLegalVersions, PublicContentPageKey, PublicPageVersion, WelcomeLandingData } from '../types';

export const publicApi = {
  listOpenTenders: mockApi.getTenders,
  async getWelcomeLanding(): Promise<WelcomeLandingData> {
    const response = await apiClient.get<WelcomeLandingData>('/api/procurement/public/welcome');
    return response.data;
  },
  async getPublicPage(pageKey: PublicContentPageKey): Promise<PublicPageVersion> {
    const response = await apiClient.get<PublicPageVersion>(`/api/public/pages/${pageKey}`);
    return response.data;
  },
  async getCurrentLegalVersions(): Promise<CurrentLegalVersions> {
    const response = await apiClient.get<CurrentLegalVersions>('/api/public/legal/current');
    return response.data;
  }
};
