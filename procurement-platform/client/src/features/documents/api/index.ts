/* Wraps documents HTTP calls behind typed operations so UI code does not depend on raw endpoints. */
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

export type DocumentObjectDto = {
  id: string;
  ownerOrgId: string | null;
  uploadedByUserId: string | null;
  name: string;
  objectKey: string;
  documentType: string;
  checksum: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  storageDriver: 'local' | 's3' | 'legacy' | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  contentUrl: string;
  downloadUrl: string;
};

export type DocumentUploadInput = {
  name?: string;
  documentType?: string;
  ownerOrgId?: string;
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  metadata?: Record<string, unknown>;
};

async function uploadDocumentRequest(file: File, input: DocumentUploadInput = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', input.name || file.name);
  formData.append('documentType', input.documentType || 'GENERAL_DOCUMENT');
  if (input.ownerOrgId) formData.append('ownerOrgId', input.ownerOrgId);
  if (input.sourceModule) formData.append('sourceModule', input.sourceModule);
  if (input.sourceEntityType) formData.append('sourceEntityType', input.sourceEntityType);
  if (input.sourceEntityId) formData.append('sourceEntityId', input.sourceEntityId);
  if (input.metadata) formData.append('metadata', JSON.stringify(input.metadata));
  const response = await apiClient.post<DocumentObjectDto>('/api/documents/uploads', formData, {
    headers: { 'Content-Type': undefined }
  });
  return response.data;
}

export const documentsApi = {
  requestUpload: uploadDocumentRequest,
  uploadDocument: uploadDocumentRequest,
  contentUrl(documentId: string, download = false) {
    return `/api/documents/${documentId}/content${download ? '?download=true' : ''}`;
  },
  async signDocument(documentId: string, input: { note?: string; signatureKeyphrase: string }) {
    const response = await apiClient.post<DocumentObjectDto>(`/api/documents/${documentId}/sign`, input);
    return response.data;
  },
  async approveDocument(documentId: string, input: { note?: string; signatureKeyphrase: string }) {
    const response = await apiClient.post<DocumentObjectDto>(`/api/documents/${documentId}/approve`, input);
    return response.data;
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
