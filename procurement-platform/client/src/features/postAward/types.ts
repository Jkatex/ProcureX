export type PostAwardViewerRole = 'BUYER' | 'SUPPLIER' | 'ADMIN' | 'NONE';
export type PostAwardStageId = 'setup' | 'delivery' | 'acceptance' | 'finance' | 'issues' | 'variations' | 'closeout' | 'history';

export type PostAwardContractRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
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

export type PostAwardRecord = {
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

export type PostAwardAction = {
  key: string;
  label: string;
  stage: PostAwardStageId;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  enabled: boolean;
  reason: string | null;
};

export type PostAwardStage = {
  id: PostAwardStageId;
  label: string;
  description: string;
  count: number;
  records: PostAwardRecord[];
};

export type PostAwardWorkspace = {
  contract: PostAwardContractRow & {
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
  stages: PostAwardStage[];
  secondary: Array<{ id: string; label: string; count: number; records: PostAwardRecord[] }>;
  actions: PostAwardAction[];
};

export type PostAwardDocument = {
  id: string;
  name: string;
  documentType: string;
  createdAt: string;
  contentUrl: string;
  sourceLabel: string;
};
