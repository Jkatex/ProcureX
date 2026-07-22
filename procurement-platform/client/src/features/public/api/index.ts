/* Wraps public HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import type { MarketplacePayload } from '@/features/procurement/types';
import type { CurrentLegalVersions, PublicContentPageKey, PublicPageVersion, WelcomeLandingData } from '../types';

export const publicApi = {
  async listOpenTenders() {
    const response = await apiClient.get<MarketplacePayload>('/api/procurement/marketplace');
    return response.data.tenders ?? [];
  },
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
