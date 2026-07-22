/* Wraps account HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import type { SupportedLanguage } from '@/i18n';

export type UserPreferencesResponse = {
  preferredLanguage: SupportedLanguage;
  timezone: string;
};

export type AccountActivityEvent = 'identity.profile.opened' | 'communication.messages.opened' | 'support.help.opened';

export const accountApi = {
  async getPreferences() {
    const response = await apiClient.get<UserPreferencesResponse>('/api/identity/preferences');
    return response.data;
  },

  async updatePreferences(input: { preferredLanguage: SupportedLanguage }) {
    const response = await apiClient.patch<UserPreferencesResponse>('/api/identity/preferences', input);
    return response.data;
  },

  async recordActivity(event: AccountActivityEvent) {
    const response = await apiClient.post<{ ok: boolean }>('/api/identity/activity', { event });
    return response.data;
  }
};
