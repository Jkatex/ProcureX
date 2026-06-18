import { apiClient } from '@/shared/api/http';

export const awardsContractsApi = {
  saveDraft: async () => ({ status: 'DRAFT' as const }),
  async signContractSignature(
    contractId: string,
    signatureId: string,
    input: {
      signerName: string;
      signerTitle?: string;
      signatureKeyphrase: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const response = await apiClient.post(`/api/award-contract/contracts/${contractId}/signatures/${signatureId}/sign`, {
      signerName: input.signerName,
      signerTitle: input.signerTitle ?? '',
      signatureKeyphrase: input.signatureKeyphrase,
      payload: input.payload ?? {}
    });
    return response.data;
  }
};
