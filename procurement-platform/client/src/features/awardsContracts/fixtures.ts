import type {
  AwardQueueId,
  AwardWorkflowStep,
  ContractAction,
  ContractTab,
  PostAwardTab,
  SupplierAward,
  SummaryCard,
  PendingAward
} from './types';

export const awardQueueLabels: Record<AwardQueueId, string> = {
  'sample-procurement': 'Samples',
  'contract-preparation': 'Contract Drafting',
  'awarding-in-progress': 'Award Decisions',
  'awards-received': 'Awards Received',
  'contracts-in-progress': 'Contract Negotiation',
  'contract-signing': 'Contract Signing'
};

export const pendingAwards: PendingAward[] = [
];

export const supplierAwards: SupplierAward[] = [
];

export const contractActions: ContractAction[] = [
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
    detail: 'Draft review, amendment requests, final acceptance, and communication confirmation',
    trend: 'Due'
  },
  {
    queue: 'contract-signing',
    label: 'Contract Signing',
    value: 0,
    detail: 'Contracts pending buyer or supplier digital signature',
    trend: 'Sign'
  }
];

export const awardWorkflowSteps: AwardWorkflowStep[] = [
  { id: 'evaluation-result', title: 'Evaluation Results', shortTitle: 'Evaluation Results', status: 'Evaluation completed' },
  { id: 'award-decision', title: 'Award Decision', shortTitle: 'Award Decision', status: 'Award Decision Pending' },
  { id: 'approval', title: 'Approval', shortTitle: 'Approval', status: 'Approval pending' },
  { id: 'award-notification', title: 'Notice Preparation', shortTitle: 'Notices', status: 'Required notices pending' },
  { id: 'standstill-period', title: 'Waiting / Complaint Period (standstill)', shortTitle: 'Waiting Period', status: 'Contract blocked' },
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
