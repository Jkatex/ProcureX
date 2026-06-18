import type {
  AwardNoticeStatus,
  AwardResponseAction,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractStatus,
  RecommendationStatus,
  SignatureStatus
} from '@prisma/client';

export const moduleDefinition = {
  key: 'award-contract',
  name: 'Award and Contract',
  description: 'Award handoff, contract negotiation, contract versions, signatures, and post-award contract state.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type AwardContractRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type AwardRecommendationQuery = {
  organizationId: string;
  status: RecommendationStatus | 'all';
  search: string;
  page: number;
  pageSize: number;
};

export type ContractQuery = {
  organizationId: string;
  status: ContractStatus | 'all';
  search: string;
  page: number;
  pageSize: number;
};

export type AwardRecommendationListItemDto = {
  id: string;
  tenderId: string;
  tenderReference: string;
  tenderTitle: string;
  buyerOrgId: string;
  buyerName: string;
  supplierOrgId: string | null;
  supplierName: string | null;
  bidId: string | null;
  status: RecommendationStatus;
  amount: number | null;
  currency: string;
  noticeStatus: AwardNoticeStatus | null;
  contractId: string | null;
  createdAt: string;
};

export type AwardNoticeDto = {
  id: string;
  status: AwardNoticeStatus;
  buyerOrgId: string;
  supplierOrgId: string;
  contractId: string | null;
  buyerNote: string;
  supplierNote: string;
  issuedAt: string;
  respondedAt: string | null;
  responses: AwardResponseDto[];
};

export type AwardResponseDto = {
  id: string;
  action: AwardResponseAction;
  note: string;
  actorOrgId: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export type ContractListItemDto = {
  id: string;
  reference: string;
  tenderId: string | null;
  tenderReference: string | null;
  title: string;
  buyerOrgId: string;
  buyerName: string;
  supplierOrgId: string | null;
  supplierName: string | null;
  status: ContractStatus;
  amount: number | null;
  currency: string;
  versionCount: number;
  signatureCount: number;
  pendingSignatureCount: number;
  milestoneCount: number;
  updatedAt: string;
};

export type ContractVersionDto = {
  id: string;
  versionNo: number;
  documentId: string | null;
  documentName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ContractSignatureDto = {
  id: string;
  role: ContractPartyRole;
  status: SignatureStatus;
  signerOrgId: string | null;
  signerUserId: string | null;
  signerName: string;
  signerTitle: string;
  signedAt: string | null;
  declinedAt: string | null;
};

export type ContractMilestoneEvidenceDto = {
  id: string;
  documentId: string;
  documentName: string;
  uploadedByUserId: string | null;
  uploaderOrgId: string | null;
  note: string;
  createdAt: string;
};

export type ContractMilestoneDto = {
  id: string;
  title: string;
  description: string;
  status: ContractMilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  amount: number | null;
  currency: string;
  payload: Record<string, unknown>;
  evidence: ContractMilestoneEvidenceDto[];
  createdAt: string;
  updatedAt: string;
};

export type AuditEventDto = {
  event: string;
  actorUserId: string | null;
  createdAt: string;
};

export type AwardRecommendationDetailDto = AwardRecommendationListItemDto & {
  reason: string;
  notice: AwardNoticeDto | null;
  contract: ContractDetailDto | null;
  approvals: Array<{
    id: string;
    status: string;
    action: string;
    actorUserId: string | null;
    decidedAt: string | null;
  }>;
  audit: AuditEventDto[];
};

export type ContractDetailDto = ContractListItemDto & {
  awardId: string | null;
  noticeId: string | null;
  payload: Record<string, unknown>;
  versions: ContractVersionDto[];
  signatures: ContractSignatureDto[];
  milestones: ContractMilestoneDto[];
  audit: AuditEventDto[];
  createdAt: string;
};

export type ListAwardRecommendationsResponseDto = {
  recommendations: AwardRecommendationListItemDto[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
};

export type ListContractsResponseDto = {
  contracts: ContractListItemDto[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
};

export type AwardDecisionInput = {
  note: string;
};

export type AwardNoticeResponseInput = {
  action: AwardResponseAction;
  note: string;
  payload: Record<string, unknown>;
};

export type ContractVersionInput = {
  documentId?: string;
  payload: Record<string, unknown>;
};

export type ContractSignatureRequestInput = {
  roles: ContractPartyRole[];
};

export type ContractSignatureSignInput = {
  signerName: string;
  signerTitle: string;
  signatureKeyphrase: string;
  payload: Record<string, unknown>;
};

export type ContractMilestoneInput = {
  title: string;
  description: string;
  dueDate?: string;
  amount?: number;
  currency: string;
  payload: Record<string, unknown>;
};

export type ContractMilestonePatchInput = Partial<ContractMilestoneInput> & {
  status?: ContractMilestoneStatus;
  completedAt?: string;
};

export type ContractMilestoneEvidenceInput = {
  documentId: string;
  note: string;
};

export type ContractStatusPatchInput = {
  status: ContractStatus;
  note: string;
};
