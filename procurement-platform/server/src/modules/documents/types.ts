import type { SupportedLanguage } from '@procurex/shared';

export const moduleDefinition = {
  key: 'documents',
  name: 'Documents',
  description: 'Object storage metadata, checksums, encryption references, and document attachments.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type DocumentRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
  language?: SupportedLanguage;
};

export type DocumentContent = {
  filename: string;
  contentType: string;
  body: string | Buffer;
};

export const officialDocumentStatuses = ['DRAFT', 'PENDING_APPROVAL', 'SIGNED', 'OFFICIAL', 'VOID'] as const;

export type OfficialDocumentStatus = (typeof officialDocumentStatuses)[number];

export const officialDocumentTypes = [
  'ANNUAL_PROCUREMENT_PLAN',
  'PROCUREMENT_PLAN_EXTRACT',
  'TENDER_DOCUMENT',
  'SPECIFIC_TENDER_NOTICE',
  'TENDER_AMENDMENT',
  'BID_SUBMISSION_RECEIPT',
  'SEALED_BID_RECORD',
  'BID_OPENING_RECORD',
  'EVALUATION_REPORT',
  'CONSULTANCY_EVALUATION_REPORT',
  'AWARD_RECOMMENDATION',
  'AWARD_APPROVAL_REQUEST',
  'NOTICE_OF_INTENTION_TO_AWARD',
  'AWARD_RESPONSE_RECORD',
  'NEGOTIATION_PLAN',
  'NEGOTIATION_RECORD',
  'CONTRACT_DOCUMENT',
  'CONTRACT_VERSION_CERTIFICATE',
  'CONTRACT_SIGNATURE_CERTIFICATE',
  'PURCHASE_ORDER',
  'DELIVERY_ACCEPTANCE_CERTIFICATE',
  'INVOICE_PAYMENT_CERTIFICATE',
  'CONTRACT_VARIATION_REQUEST',
  'CONTRACT_CLOSEOUT_CERTIFICATE',
  'PROCUREMENT_RECORD_ARCHIVE_REPORT',
  'OFFICIAL_RECORD_CERTIFICATE'
] as const;

export type OfficialDocumentType = (typeof officialDocumentTypes)[number];

export const officialProcurementTypes = ['GOODS', 'WORKS', 'NON_CONSULTANCY', 'CONSULTANCY', 'MIXED', 'NOT_APPLICABLE'] as const;

export type OfficialProcurementType = (typeof officialProcurementTypes)[number];

export type OfficialTemplateSection = {
  key: string;
  title: string;
  description: string;
};

export type OfficialTemplateField = {
  path: string;
  label: string;
};

export type OfficialTemplateDto = {
  code: string;
  name: string;
  description: string;
  documentType: OfficialDocumentType;
  procurementType: OfficialProcurementType | null;
  jurisdiction: 'TZ';
  language: SupportedLanguage;
  version: string;
  sourceAuthority: 'PPRA';
  sourceUrl: string;
  sections: OfficialTemplateSection[];
  requiredFields: OfficialTemplateField[];
};

export type OfficialDocumentGenerateInput = {
  templateCode?: string;
  documentType: OfficialDocumentType;
  procurementType?: OfficialProcurementType;
  language?: SupportedLanguage;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
};

export type OfficialDocumentActionInput = {
  note?: string;
  signatureKeyphrase?: string;
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
  status: OfficialDocumentStatus;
  contentHash: string;
  pdfObjectKey: string;
  pdfSizeBytes: number;
  validationWarnings: OfficialValidationWarning[];
  approvalMetadata: Record<string, unknown>;
  signatureMetadata: Record<string, unknown>;
  generatedAt: string;
  officialAt: string | null;
  voidedAt: string | null;
  openUrl: string;
  downloadUrl: string;
};

export type OfficialValidationWarning = {
  path: string;
  label: string;
  message: string;
};

export type OfficialDocumentGenerateResponse = {
  document: OfficialDocumentVersionDto;
  validationWarnings: OfficialValidationWarning[];
};

export type OfficialDocumentFile = {
  filename: string;
  contentType: 'application/pdf';
  body: Buffer;
};
