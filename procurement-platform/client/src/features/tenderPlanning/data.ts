import type { ProcurementPlanningColumn, ProcurementPlanningRecord, ProcurementPlanningStatus } from './types';

export const procurementPlanningStorageKey = 'procurex.procurementPlans.v4';
export const procurementPlanningSelectedTenderKey = 'procurex.planning.selectedTenderPlan';
export const procurementPlanningCreateTenderDraftKey = 'procurex.createTender.v2.savedDraft';
export const procurementPlanningMilestoneKey = 'procurex.createTender.v2.milestones';

export const procurementPlanningDefaultColumns: ProcurementPlanningColumn[] = [
  { id: 'tenderTitle', label: 'Tender Title', type: 'text' },
  {
    id: 'category',
    label: 'Category',
    type: 'select',
    options: ['Goods', 'Works', 'Non Consultancy', 'Consultancy']
  },
  {
    id: 'procurementMethod',
    label: 'Procurement Method',
    type: 'select',
    options: ['Open Tender', 'Invited Tender', 'RFQ', 'Framework', 'Single Source']
  },
  { id: 'openingDate', label: 'Opening Date', type: 'date' },
  { id: 'closingDate', label: 'Closing Date', type: 'date' },
  {
    id: 'sourceOfFunds',
    label: 'Source of Funds',
    type: 'select',
    options: ['Government of Tanzania', 'Own Source', 'Donor Funded', 'Development Partner', 'Loan', 'Grant', 'Other']
  },
  { id: 'budget', label: 'Budget', type: 'number' },
  { id: 'expectedCompletionDate', label: 'Expected Completion Date', type: 'date' }
];

export const procurementPlanningCreateColumns = procurementPlanningDefaultColumns.filter((column) =>
  ['tenderTitle', 'category', 'procurementMethod', 'openingDate', 'closingDate'].includes(column.id)
);

export const procurementPlanningStatuses: ProcurementPlanningStatus[] = [
  { value: 'Inactive', label: 'Not Open', description: 'This tender has not opened yet.', page: '', tone: 'info' },
  {
    value: 'Draft planning',
    label: 'Not Open',
    description: 'Tender details are still being prepared from the plan.',
    page: 'create-tender',
    tone: 'warning'
  },
  {
    value: 'Opened',
    label: 'Marketplace',
    description: 'This tender is open in the marketplace.',
    page: 'marketplace',
    tone: 'success'
  },
  {
    value: 'In evaluation',
    label: 'Evaluation',
    description: 'This tender is in bid evaluation.',
    page: 'bid-evaluation',
    tone: 'warning'
  },
  {
    value: 'Contract management',
    label: 'Contract',
    description: 'This tender is in contract negotiation.',
    page: 'contract-negotiation',
    tone: 'info'
  },
  {
    value: 'Awarded',
    label: 'Awarding',
    description: 'This tender is in award and contract processing.',
    page: 'awarding-contracts',
    tone: 'success'
  },
  {
    value: 'Finished',
    label: 'Records',
    description: 'This tender is closed and archived in records.',
    page: 'records-history',
    tone: 'success'
  }
];

export const procurementPlanningSeedRecords: ProcurementPlanningRecord[] = [];

export const pageToRoute: Record<string, string> = {
  'account-profile': '/identity/profile',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'contract-negotiation': '/awards-contracts/negotiation',
  'records-history': '/records',
  'create-tender': '/procurement/create-tender',
  'workspace-dashboard': '/dashboard',
  'sign-in': '/sign-in'
};
