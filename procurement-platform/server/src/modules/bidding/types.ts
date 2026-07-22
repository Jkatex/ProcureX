/* Defines bidding TypeScript contracts that keep API payloads, state, and UI props aligned. */
export const moduleDefinition = {
  key: 'bidding',
  name: 'Bidding',
  description: 'Supplier bid drafts, sealed versions, responses, bid documents, receipts, and submission state.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type BidDocumentInput = {
  documentId?: string;
  name: string;
  documentType: string;
  envelope?: 'ADMINISTRATIVE' | 'TECHNICAL' | 'FINANCIAL' | 'COMBINED';
  checksum?: string;
  objectKey?: string;
  size?: number;
  mimeType?: string;
  encryptionKeyRef?: string;
  metadata?: Record<string, unknown>;
};

export type BidValidationSeverity = 'warning' | 'error';

export type BidValidationIssue = {
  section: string;
  field: string;
  message: string;
  severity: BidValidationSeverity;
};

export type BidValidationMissingRequiredField = {
  section: string;
  field: string;
  label: string;
  requirementKey: string;
};

export type BidValidationResult = {
  valid: boolean;
  issues: BidValidationIssue[];
  missingRequiredFields: BidValidationMissingRequiredField[];
  computedTotalAmount: number;
  completeness: Record<string, boolean>;
  schemaVersion: string;
};

export type BidDraftInput = {
  workflowType?: 'goods' | 'works' | 'services' | 'consultancy' | 'generic';
  workflowVersion?: string;
  administrative: Record<string, unknown>;
  technical: Record<string, unknown>;
  financial: Record<string, unknown>;
  declarations: Record<string, unknown>;
  responses: Array<{ requirementKey: string; response: Record<string, unknown> }>;
  documents: BidDocumentInput[];
  fileManifest?: Record<string, unknown>;
  envelopes?: Record<string, unknown>;
  reviewReadiness?: Record<string, unknown>;
  workspaceState?: Record<string, unknown>;
  totalAmount?: number;
  currency?: string;
  completeness?: Record<string, unknown>;
  validationIssues?: string[];
};

export type BidDto = {
  id: string;
  tenderId: string;
  tenderReference: string;
  tenderTitle: string;
  buyerOrgId: string;
  buyerName: string;
  supplierOrgId: string;
  supplierName: string;
  reference: string;
  status: string;
  submittedAt: string | null;
  totalAmount: number;
  currency: string;
  payload: Record<string, unknown>;
  responses: Array<{ requirementKey: string; response: Record<string, unknown> }>;
  documents: Array<{
    id: string;
    documentId: string;
    name: string;
    documentType: string;
    envelope: string;
    reviewStatus: string;
    checksum: string | null;
    metadata: Record<string, unknown>;
  }>;
  validation?: BidValidationResult;
  receipt: {
    receiptRef: string;
    receiptHash: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type BidReceiptDto = NonNullable<BidDto['receipt']> & {
  bid: BidDto;
};

export type BidSampleStatusValue =
  | 'REQUIRED'
  | 'PENDING_SUBMISSION'
  | 'SUBMITTED'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'ACCEPTED'
  | 'REJECTED';

export type BidSampleDto = {
  id: string;
  bidId: string;
  tenderId: string;
  supplierOrgId: string;
  sampleName: string;
  relatedItem: string | null;
  quantity: number | null;
  deliveryLocation: string | null;
  deliveryDeadline: string | null;
  trackingStatus: BidSampleStatusValue;
  courier: string | null;
  trackingNumber: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  inspectionNotes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type BidSchemaEnvelope = 'ADMINISTRATIVE' | 'TECHNICAL' | 'FINANCIAL' | 'COMBINED';

export type BidSubmissionSection = 'administrative' | 'technical' | 'financial' | 'samples' | 'declarations' | 'review' | 'receipt';

export type BidSubmissionStepId =
  | BidSubmissionSection
  | 'goodsTechnical'
  | 'goodsFinancial'
  | 'goodsSamples'
  | 'goodsReview'
  | 'goodsDeclaration'
  | 'worksCapacity'
  | 'worksTechnicalProposal'
  | 'worksFinancial'
  | 'worksReview'
  | 'worksDeclaration'
  | 'servicesMethodology'
  | 'servicesDeliveryPlan'
  | 'servicesStaffing'
  | 'servicesSla'
  | 'servicesCommercial'
  | 'servicesReview'
  | 'consultancyTechnical'
  | 'consultancyFinancial'
  | 'consultancyReview';

export type BidSubmissionFieldType = 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'file' | 'table';

export type BidSubmissionResponseType =
  | 'acknowledgement'
  | 'attachment'
  | 'boolean'
  | 'date'
  | 'declaration'
  | 'money'
  | 'number'
  | 'pricing'
  | 'structured'
  | 'text';

export type BidSubmissionSchemaFieldDto = {
  id: string;
  requirementKey: string;
  label: string;
  type: BidSubmissionFieldType;
  section: BidSubmissionSection;
  required: boolean;
  responseType: BidSubmissionResponseType;
  envelope: BidSchemaEnvelope;
  source: string;
  validation: Record<string, unknown>;
};

export type BidSubmissionSchemaStepDto = {
  id: BidSubmissionStepId;
  label: string;
  envelope: BidSchemaEnvelope;
  required: boolean;
  fields: BidSubmissionSchemaFieldDto[];
};

export type BidSubmissionSchemaDto = {
  tenderId: string;
  tenderReference: string;
  tenderTitle: string;
  tenderType: string;
  schemaVersion: 'bid-submission-schema-v1';
  steps: BidSubmissionSchemaStepDto[];
};

export type BidSubmissionSchemaResponseDto = {
  success: true;
  data: BidSubmissionSchemaDto;
};

export type CreateBidSampleInput = {
  sampleName: string;
  relatedItem?: string;
  quantity: number;
  deliveryLocation?: string;
  deliveryDeadline?: string;
  trackingStatus?: Extract<BidSampleStatusValue, 'PENDING_SUBMISSION' | 'SUBMITTED'>;
  courier?: string;
  trackingNumber?: string;
  metadata?: Record<string, unknown>;
};

export type PatchBidSampleInput = Partial<{
  sampleName: string;
  relatedItem: string;
  quantity: number;
  deliveryLocation: string;
  deliveryDeadline: string;
  trackingStatus: BidSampleStatusValue;
  courier: string;
  trackingNumber: string;
  receivedAt: string;
  inspectedAt: string;
  inspectionNotes: string;
  metadata: Record<string, unknown>;
}>;
