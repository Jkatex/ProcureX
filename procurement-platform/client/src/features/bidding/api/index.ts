import { apiClient } from '@/shared/api/http';
import type { BidDocumentInput, BidDraftPayload, BidDto, BidReceiptDto } from '../types';

export const biddingApi = {
  async listBids() {
    const response = await apiClient.get<BidDto[]>('/api/bidding/my');
    return response.data;
  },
  async getTenderDraft(tenderId: string) {
    const response = await apiClient.get<BidDto | null>(`/api/bidding/tenders/${tenderId}/draft`);
    return response.data;
  },
  async saveTenderDraft(tenderId: string, payload: BidDraftPayload) {
    const response = await apiClient.post<BidDto>(`/api/bidding/tenders/${tenderId}/draft`, payload);
    return response.data;
  },
  async updateBid(bidId: string, payload: BidDraftPayload) {
    const response = await apiClient.patch<BidDto>(`/api/bidding/${bidId}`, payload);
    return response.data;
  },
  async addDocuments(bidId: string, documents: BidDocumentInput[]) {
    const response = await apiClient.post<BidDto>(`/api/bidding/${bidId}/documents`, { documents });
    return response.data;
  },
  async submitBid(bidId: string) {
    const response = await apiClient.post<BidReceiptDto>(`/api/bidding/${bidId}/submit`);
    return response.data;
  },
  async withdrawBid(bidId: string) {
    const response = await apiClient.post<BidDto>(`/api/bidding/${bidId}/withdraw`);
    return response.data;
  },
  async getBid(bidId: string) {
    const response = await apiClient.get<BidDto>(`/api/bidding/${bidId}`);
    return response.data;
  }
};
