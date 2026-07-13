import type {
  HelpCategoryListResponse,
  HelpFaq,
  HelpFaqCategory,
  HelpFaqListResponse,
  HelpMessageRequest,
  HelpMessageResponse,
  HelpSuggestionResponse
} from '@procurex/shared';
import { apiClient } from '@/shared/api/http';

export const helpCentreApi = {
  async status() {
    const response = await apiClient.get('/api/help-centre');
    return response.data;
  },

  async categories(): Promise<HelpFaqCategory[]> {
    const response = await apiClient.get<HelpCategoryListResponse>('/api/help-centre/categories');
    return response.data.categories;
  },

  async faqs(params?: { category?: string; role?: string; q?: string }): Promise<HelpFaqListResponse> {
    const response = await apiClient.get<HelpFaqListResponse>('/api/help-centre/faqs', { params });
    return response.data;
  },

  async faq(faqId: string): Promise<HelpFaq> {
    const response = await apiClient.get<HelpFaq>(`/api/help-centre/faqs/${encodeURIComponent(faqId)}`);
    return response.data;
  },

  async popular(): Promise<HelpFaqListResponse> {
    const response = await apiClient.get<HelpFaqListResponse>('/api/help-centre/popular');
    return response.data;
  },

  async category(categoryId: string): Promise<{ category: HelpFaqCategory; faqs: HelpFaq[]; total: number }> {
    const response = await apiClient.get<{ category: HelpFaqCategory; faqs: HelpFaq[]; total: number }>(
      `/api/help-centre/category/${encodeURIComponent(categoryId)}`
    );
    return response.data;
  },

  async suggestions(params?: { q?: string; category?: string; limit?: number }): Promise<HelpSuggestionResponse> {
    const response = await apiClient.get<HelpSuggestionResponse>('/api/help-centre/suggestions', { params });
    return response.data;
  },

  async message(input: HelpMessageRequest): Promise<HelpMessageResponse> {
    const response = await apiClient.post<HelpMessageResponse>('/api/help-centre/message', input);
    return response.data;
  }
};

