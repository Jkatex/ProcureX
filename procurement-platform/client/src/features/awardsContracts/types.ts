export type AwardQueueId =
  | 'my-urgent-actions'
  | 'awarding-in-progress'
  | 'awards-received'
  | 'contracts-in-progress'
  | 'active-contracts'
  | 'closed-contracts';

export type AwardContractRole = 'Buyer' | 'Supplier';

export type AwardContractStep =
  | 'evaluation-result'
  | 'award-decision'
  | 'approval'
  | 'award-notification'
  | 'standstill-period'
  | 'supplier-acceptance'
  | 'pre-contract-documents'
  | 'draft-contract'
  | 'overview'
  | 'buyer-review'
  | 'supplier-review'
  | 'negotiation'
  | 'legal-review'
  | 'final-approval'
  | 'signatures'
  | 'execution';

export type AwardResponseAction = 'accept' | 'clarify' | 'decline';
export type ContractTabId = 'overview' | 'buyer-review' | 'supplier-review' | 'negotiation' | 'legal-review' | 'final-approval' | 'signatures' | 'activity';
export type PostAwardMode = 'active' | 'closed';
export type PostAwardTabId = 'milestones' | 'payments' | 'issues' | 'variations' | 'closure' | 'performance';

export type BadgeTone = 'success' | 'warning' | 'error' | 'info';

export type SummaryCard = {
  queue: AwardQueueId;
  label: string;
  value: number;
  detail: string;
  trend: string;
};

export type UrgentAction = {
  id: string;
  priority: string;
  action: string;
  item: string;
  party: string;
  dueDate: string;
  role: AwardContractRole;
  status: string;
  buttonLabel: string;
  nav: string;
  routeSearch?: string;
  tenderId?: string;
};

export type PendingAward = {
  id: string;
  title: string;
  reference: string;
  role: AwardContractRole;
  procurementType: string;
  evaluationStatus: string;
  recommendedSupplier: string;
  awardStatus: string;
  contractStatus: string;
  progressStatus: string;
  progressStep: string;
  progressDate: string;
  action: string;
};

export type SupplierAward = {
  id: string;
  title: string;
  buyer: string;
  procurementType: string;
  awardValue: number;
  currency: string;
  awardStatus: string;
  contractStatus: string;
  requiredAction: string;
  responseStatus: string;
  documents: Array<{ name: string; owner: string; status: string; action: string }>;
  activity: Array<{ time: string; actor: string; event: string; status: string }>;
};

export type ContractAction = {
  id: string;
  contract: string;
  role: AwardContractRole;
  otherParty: string;
  status: string;
  requiredAction: string;
  dueDate: string;
  routeSearch: string;
};

export type ActiveContract = {
  id: string;
  title: string;
  role: AwardContractRole;
  otherParty: string;
  progress: number;
  progressLabel: string;
  nextMilestone: string;
  paymentStatus: string;
};

export type ClosedContract = {
  id: string;
  title: string;
  role: AwardContractRole;
  otherParty: string;
  finalValue: number;
  currency: string;
  completionDate: string;
  performanceRating: string;
  status: string;
};

export type AwardWorkflowStep = {
  id: AwardContractStep;
  title: string;
  shortTitle: string;
  status: string;
};

export type ContractTab = {
  id: ContractTabId;
  label: string;
};

export type PostAwardTab = {
  id: PostAwardTabId;
  label: string;
};
