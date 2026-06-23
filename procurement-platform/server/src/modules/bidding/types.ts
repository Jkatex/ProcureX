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
  name: string;
  documentType: string;
  envelope?: 'TECHNICAL' | 'FINANCIAL' | 'COMBINED';
  checksum?: string;
  metadata?: Record<string, unknown>;
};

export type BidDraftInput = {
  administrative: Record<string, unknown>;
  technical: Record<string, unknown>;
  financial: Record<string, unknown>;
  declarations: Record<string, unknown>;
  responses: Array<{ requirementKey: string; response: Record<string, unknown> }>;
  documents: BidDocumentInput[];
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
