/* Wraps bidding HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
import { apiClient } from '@/shared/api/http';
import type { BidDocumentInput, BidDocumentUploadInput, BidDraftPayload, BidDto, BidReceiptDto, BidSampleDto, BidSubmissionSchemaResponseDto, CreateBidSampleInput, PatchBidSampleInput } from '../types';

export const biddingApi = {
  async listBids() {
    const response = await apiClient.get<BidDto[]>('/api/bidding/my');
    return response.data;
  },
  async getTenderDraft(tenderId: string) {
    const response = await apiClient.get<BidDto | null>(`/api/bidding/tenders/${tenderId}/draft`);
    return response.data;
  },
  async getTenderSchema(tenderId: string) {
    const response = await apiClient.get<BidSubmissionSchemaResponseDto>(`/api/bidding/tenders/${tenderId}/schema`);
    return response.data.data;
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
  async uploadDocuments(bidId: string, input: BidDocumentUploadInput) {
    const formData = new FormData();
    formData.append('documentType', input.documentType);
    formData.append('envelope', input.envelope);
    if (input.metadata) formData.append('metadata', JSON.stringify(input.metadata));
    input.files.forEach((file) => formData.append('files', file));

    const response = await apiClient.post<BidDto>(`/api/bidding/${bidId}/documents`, formData, {
      headers: { 'Content-Type': undefined }
    });
    return response.data;
  },
  async deleteDocument(bidId: string, documentId: string) {
    const response = await apiClient.delete<{ bid: BidDto }>(`/api/bidding/${bidId}/documents/${documentId}`);
    return response.data.bid;
  },
  async listSamples(bidId: string) {
    const response = await apiClient.get<BidSampleDto[]>(`/api/bidding/${bidId}/samples`);
    return response.data;
  },
  async createSample(bidId: string, input: CreateBidSampleInput) {
    const response = await apiClient.post<BidSampleDto>(`/api/bidding/${bidId}/samples`, input);
    return response.data;
  },
  async patchSample(bidId: string, sampleId: string, input: PatchBidSampleInput) {
    const response = await apiClient.patch<BidSampleDto>(`/api/bidding/${bidId}/samples/${sampleId}`, input);
    return response.data;
  },
  async submitBid(bidId: string, input: { signatureKeyphrase?: string } = {}) {
    const response = await apiClient.post<BidReceiptDto>(`/api/bidding/${bidId}/submit`, input);
    return response.data;
  },
  async withdrawBid(bidId: string, input: { signatureKeyphrase?: string } = {}) {
    const response = await apiClient.post<BidDto>(`/api/bidding/${bidId}/withdraw`, input);
    return response.data;
  },
  async getBid(bidId: string) {
    const response = await apiClient.get<BidDto>(`/api/bidding/${bidId}`);
    return response.data;
  }
};
