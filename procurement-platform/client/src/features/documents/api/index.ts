import { apiClient } from '@/shared/api/http';

export type OfficialDocumentGenerateInput = {
  templateCode?: string;
  documentType: string;
  procurementType?: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
};

export type OfficialDocumentVersionDto = {
  id: string;
  templateCode: string | null;
  documentObjectId: string | null;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  documentType: string;
  procurementType: string | null;
  title: string;
  reference: string;
  versionNo: number;
  templateVersion: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'SIGNED' | 'OFFICIAL' | 'VOID';
  contentHash: string;
  pdfObjectKey: string;
  pdfSizeBytes: number;
  validationWarnings: Array<{ path: string; label: string; message: string }>;
  approvalMetadata: Record<string, unknown>;
  signatureMetadata: Record<string, unknown>;
  generatedAt: string;
  officialAt: string | null;
  voidedAt: string | null;
  openUrl: string;
  downloadUrl: string;
};

export const documentsApi = {
  requestUpload: async (name: string) => ({ objectKey: `mock/${name}` }),
  contentUrl(documentId: string, download = false) {
    return `/api/documents/${documentId}/content${download ? '?download=true' : ''}`;
  },
  async generateOfficialDocument(input: OfficialDocumentGenerateInput) {
    const response = await apiClient.post<{ document: OfficialDocumentVersionDto; validationWarnings: OfficialDocumentVersionDto['validationWarnings'] }>(
      '/api/documents/official/generate',
      input
    );
    return response.data;
  },
  async officialDocumentBlob(url: string) {
    const response = await apiClient.get<Blob>(url, { responseType: 'blob' });
    return response;
  }
};
