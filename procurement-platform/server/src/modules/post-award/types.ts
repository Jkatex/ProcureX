import type { ContractStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'post-award',
  name: 'Post Award',
  description: 'Standalone contract execution workspace for delivery, acceptance, finance, issues, variations, close-out, and history.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type PostAwardRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type PostAwardViewerRole = 'BUYER' | 'SUPPLIER' | 'ADMIN' | 'NONE';
export type PostAwardStageId = 'setup' | 'delivery' | 'acceptance' | 'finance' | 'issues' | 'variations' | 'closeout' | 'history';
export type PostAwardSecondaryId = 'termination' | 'documents' | 'performance' | 'securities' | 'audit';

export type PostAwardContractRowDto = {
  id: string;
  reference: string;
  title: string;
  status: ContractStatus | string;
  buyerName: string;
  supplierName: string | null;
  viewerRole: PostAwardViewerRole;
  amount: number | null;
  currency: string;
  stage: string;
  nextAction: string;
  dueDate: string | null;
  riskLevel: string;
};

export type PostAwardRecordDto = {
  id: string;
  type: string;
  title: string;
  status: string;
  ownerRole?: string | null;
  dueDate?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  payload?: Record<string, unknown>;
};

export type PostAwardActionDto = {
  key: string;
  label: string;
  stage: PostAwardStageId;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  enabled: boolean;
  reason: string | null;
};

export type PostAwardStageDto = {
  id: PostAwardStageId;
  label: string;
  description: string;
  count: number;
  records: PostAwardRecordDto[];
};

export type PostAwardSecondaryRegisterDto = {
  id: PostAwardSecondaryId;
  label: string;
  count: number;
  records: PostAwardRecordDto[];
};

export type PostAwardWorkspaceDto = {
  contract: PostAwardContractRowDto & {
    tenderId?: string | null;
    tenderReference?: string | null;
    access: {
      viewerRole: PostAwardViewerRole;
      canSubmitSupplierActions: boolean;
      canManageBuyerActions: boolean;
      readOnlyReason: string | null;
    };
  };
  metrics: Array<{ label: string; value: string | number; tone?: 'success' | 'warning' | 'error' | 'info' }>;
  stages: PostAwardStageDto[];
  secondary: PostAwardSecondaryRegisterDto[];
  actions: PostAwardActionDto[];
};
