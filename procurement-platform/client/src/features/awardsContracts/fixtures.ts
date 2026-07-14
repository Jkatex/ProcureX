import type {
  ActiveContract,
  AwardQueueId,
  AwardWorkflowStep,
  ClosedContract,
  ContractAction,
  ContractTab,
  PostAwardTab,
  SupplierAward,
  SummaryCard,
  PendingAward
} from './types';

export const awardQueueLabels: Record<AwardQueueId, string> = {
  'sample-procurement': 'Sample Procurement',
  'contract-preparation': 'Contract Preparation',
  'awarding-in-progress': 'Awarding in Progress',
  'awards-received': 'Awards Received',
  'contracts-in-progress': 'Contracts in Progress',
  'active-contracts': 'Active Contracts',
  'closed-contracts': 'Closed Contracts'
};

export const pendingAwards: PendingAward[] = [
];

export const supplierAwards: SupplierAward[] = [
];

export const contractActions: ContractAction[] = [
];

export const activeContracts: ActiveContract[] = [
];

export const closedContracts: ClosedContract[] = [
];

export const summaryCards: SummaryCard[] = [
  {
    queue: 'sample-procurement',
    label: 'Sample Procurement',
    value: 0,
    detail: 'Receipt, verification, custody, evaluation, testing, return, disposal, and reference samples',
    trend: 'Samples'
  },
  {
    queue: 'contract-preparation',
    label: 'Contract Preparation',
    value: 0,
    detail: 'Buyer-owned contract drafts prepared after tender publication and before award',
    trend: 'Draft'
  },
  {
    queue: 'awarding-in-progress',
    label: 'Awarding in Progress',
    value: pendingAwards.length,
    detail: 'Buyer-side tenders moving from evaluation results to draft contract',
    trend: 'Up'
  },
  {
    queue: 'awards-received',
    label: 'Awards Received',
    value: supplierAwards.length,
    detail: 'Supplier-side awards awaiting response, review, or signature',
    trend: 'Next'
  },
  {
    queue: 'contracts-in-progress',
    label: 'Contracts in Progress',
    value: contractActions.length,
    detail: 'Drafting, review, negotiation, approval, and signing actions',
    trend: 'Due'
  },
  {
    queue: 'active-contracts',
    label: 'Active Contracts',
    value: activeContracts.length,
    detail: 'Signed contracts under delivery and payment tracking',
    trend: 'Live'
  },
  {
    queue: 'closed-contracts',
    label: 'Closed Contracts',
    value: closedContracts.length,
    detail: 'Completed, terminated, or archived contract records',
    trend: 'Done'
  }
];

export const awardWorkflowSteps: AwardWorkflowStep[] = [
  { id: 'evaluation-result', title: 'Evaluation Results', shortTitle: 'Evaluation Results', status: 'Evaluation completed' },
  { id: 'award-decision', title: 'Award Decision', shortTitle: 'Award Decision', status: 'Award Decision Pending' },
  { id: 'approval', title: 'Approval', shortTitle: 'Approval', status: 'Approval pending' },
  { id: 'award-notification', title: 'Notice Preparation', shortTitle: 'Notices', status: 'Required notices pending' },
  { id: 'standstill-period', title: 'Standstill & Complaints', shortTitle: 'Standstill', status: 'Contract blocked' },
  { id: 'supplier-acceptance', title: 'Supplier Acceptance', shortTitle: 'Acceptance', status: 'Awaiting supplier response' },
  { id: 'pre-contract-documents', title: 'Pre-Contract Documents', shortTitle: 'Documents', status: 'Documents pending' },
  { id: 'draft-contract', title: 'Draft Contract', shortTitle: 'Draft Contract', status: 'Blocked' }
];

export const contractTabs: ContractTab[] = [
  { id: 'overview', label: 'Draft Contract' },
  { id: 'buyer-review', label: 'Buyer Review' },
  { id: 'supplier-review', label: 'Supplier Review' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'contract-owner-approval', label: 'Owner Approval' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'activity', label: 'Activity' }
];

export const postAwardTabs: PostAwardTab[] = [
  { id: 'milestones', label: 'Delivery / Milestones' },
  { id: 'payments', label: 'Invoices & Payments' },
  { id: 'issues', label: 'Issues' },
  { id: 'variations', label: 'Variations' },
  { id: 'closure', label: 'Closure' },
  { id: 'performance', label: 'Performance' }
];

export const awardContractSteps = awardWorkflowSteps.map((step) => step.id);
