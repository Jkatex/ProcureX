import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/shared/components/procurex/PlatformAppsDrawer';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';

type AppIconKind = 'iam' | 'procurement' | 'communication' | 'evaluation' | 'awarding' | 'records';

type AppRouteKey =
  | 'account-profile'
  | 'marketplace'
  | 'communication-center'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'award-recommendation'
  | 'award-response'
  | 'contract-negotiation'
  | 'post-award-tracking'
  | 'records-history'
  | 'create-tender'
  | 'tender-publication'
  | 'tender-details'
  | 'tender-document'
  | 'tender-detail'
  | 'bidding-workspace'
  | 'workspace-dashboard'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-analytics'
  | 'admin-audit'
  | 'sign-in';

type FirstRunStat = {
  label: string;
  value: string;
  note: string;
};

type FirstRunAction = {
  label: string;
  page: AppRouteKey;
  variant?: 'primary' | 'secondary';
};

type FirstRunCard = {
  title: string;
  description: string;
  page: AppRouteKey;
  icon: AppIconKind;
};

type FirstRunStep = {
  label: string;
  title: string;
  description: string;
};

type FirstRunNavItem = {
  label: string;
  page: AppRouteKey;
};

type FirstRunConfig = {
  title: string;
  pageKey: string;
  sidebarTitle?: string;
  sidebarNote?: string;
  kicker: string;
  heading: string;
  body: string;
  statusLabel: string;
  visualTitle: string;
  visualText: string;
  primaryAction: FirstRunAction;
  secondaryAction?: FirstRunAction;
  stats: FirstRunStat[];
  stepsKicker: string;
  stepsTitle: string;
  steps: FirstRunStep[];
  actionKicker: string;
  actionTitle: string;
  actions: FirstRunCard[];
  navItems?: FirstRunNavItem[];
};

export type FirstRunPageKey =
  | 'marketplace'
  | 'tender-publication'
  | 'tender-details'
  | 'tender-document'
  | 'tender-detail'
  | 'bidding-workspace'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'award-recommendation'
  | 'award-response'
  | 'contract-negotiation'
  | 'post-award-tracking'
  | 'records-history'
  | 'admin-dashboard'
  | 'admin-users'
  | 'admin-analytics'
  | 'admin-audit';

const pageToRoute: Record<AppRouteKey, string> = {
  'account-profile': '/identity/profile',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'award-recommendation': '/awards-contracts/recommendation',
  'award-response': '/awards-contracts/award-response',
  'contract-negotiation': '/awards-contracts/negotiation',
  'post-award-tracking': '/post-award',
  'records-history': '/records',
  'create-tender': '/procurement/create-tender',
  'tender-publication': '/procurement/tender-publication',
  'tender-details': '/procurement/tender-details',
  'tender-document': '/procurement/tender-document',
  'tender-detail': '/procurement/supplier-tender-detail',
  'bidding-workspace': '/bidding',
  'workspace-dashboard': '/dashboard',
  'admin-dashboard': '/admin',
  'admin-users': '/admin/users',
  'admin-analytics': '/admin/analytics',
  'admin-audit': '/admin/audit',
  'sign-in': '/sign-in'
};

const appNavItems: FirstRunNavItem[] = [
  { label: 'Dashboard', page: 'workspace-dashboard' },
  { label: 'Marketplace', page: 'marketplace' },
  { label: 'Create Tender', page: 'create-tender' },
  { label: 'Bidding', page: 'bidding-workspace' },
  { label: 'Evaluation', page: 'bid-evaluation' },
  { label: 'Awarding and Contract', page: 'awarding-contracts' },
  { label: 'Records and History', page: 'records-history' },
  { label: 'Communication Center', page: 'communication-center' }
];

const adminNavItems: FirstRunNavItem[] = [
  { label: 'Command Center', page: 'admin-dashboard' },
  { label: 'User Management', page: 'admin-users' },
  { label: 'Platform Analytics', page: 'admin-analytics' },
  { label: 'Full Audit Trail', page: 'admin-audit' },
  { label: 'User Dashboard', page: 'workspace-dashboard' }
];

const createTender: FirstRunCard = {
  title: 'Create tender',
  description: 'Start a buyer tender workflow.',
  page: 'create-tender',
  icon: 'procurement'
};

const viewMarketplace: FirstRunCard = {
  title: 'View marketplace',
  description: 'Browse published opportunities.',
  page: 'marketplace',
  icon: 'procurement'
};

const openCommunication: FirstRunCard = {
  title: 'Open communication',
  description: 'Send clarifications, notices, and procurement messages.',
  page: 'communication-center',
  icon: 'communication'
};

const openEvaluation: FirstRunCard = {
  title: 'Open evaluation',
  description: 'Review bids after submission.',
  page: 'bid-evaluation',
  icon: 'evaluation'
};

const openAwards: FirstRunCard = {
  title: 'Open awards',
  description: 'Manage awards and contracts after evaluation is complete.',
  page: 'awarding-contracts',
  icon: 'awarding'
};

const openRecords: FirstRunCard = {
  title: 'Open records',
  description: 'Review procurement history and evidence.',
  page: 'records-history',
  icon: 'records'
};

const procurementSequence: FirstRunStep[] = [
  {
    label: '01',
    title: 'Create or publish a tender',
    description: 'Use Create Tender to prepare the requirements, then publish the opportunity.'
  },
  {
    label: '02',
    title: 'Receive supplier activity',
    description: 'Suppliers can review the opportunity, ask questions, and submit bids.'
  },
  {
    label: '03',
    title: 'Move into later apps',
    description: 'Evaluation, awards, contracts, and records follow the tender workflow.'
  }
];

const firstRunConfigs: Record<FirstRunPageKey, FirstRunConfig> = {
  marketplace: {
    title: 'Procurement',
    pageKey: 'marketplace',
    sidebarTitle: 'Procurement',
    sidebarNote: 'Marketplace and tender creation',
    kicker: 'Tender marketplace',
    heading: 'No published tenders yet.',
    body: 'Manage open tenders, your published tenders, saved opportunities, and bid drafts from this workspace.',
    statusLabel: 'No tenders yet',
    visualTitle: 'Marketplace is ready',
    visualText: 'Create a tender to publish your first opportunity, or return here when public opportunities are available.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Open tenders', value: '0', note: 'Published opportunities.' },
      { label: 'My tenders', value: '0', note: 'Tenders created by your organization.' },
      { label: 'My bids', value: '0', note: 'Draft and submitted bid records.' },
      { label: 'Saved tenders', value: '0', note: 'Opportunities you mark for follow-up.' }
    ],
    stepsKicker: 'How it starts',
    stepsTitle: 'Marketplace activity comes after publication',
    steps: procurementSequence,
    actionKicker: 'Start procurement',
    actionTitle: 'Useful next actions',
    actions: [createTender, viewMarketplace, openCommunication]
  },
  'tender-publication': {
    title: 'Tender Publication',
    pageKey: 'tender-publication',
    kicker: 'Publication workspace',
    heading: 'There is no tender ready for publication yet.',
    body: 'Review and publish completed tender packages after the draft has the required information.',
    statusLabel: 'Awaiting tender draft',
    visualTitle: 'Publication checkpoint',
    visualText: 'Tender details, requirements, dates, and review confirmations are checked before publication.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Ready to publish', value: '0', note: 'Completed tender drafts.' },
      { label: 'Missing review', value: '0', note: 'Drafts waiting for confirmation.' },
      { label: 'Published today', value: '0', note: 'New marketplace postings.' },
      { label: 'Returned drafts', value: '0', note: 'Items needing correction.' }
    ],
    stepsKicker: 'Before publication',
    stepsTitle: 'A tender has to be prepared first',
    steps: procurementSequence,
    actionKicker: 'Continue',
    actionTitle: 'Start from the right place',
    actions: [createTender, openCommunication, viewMarketplace]
  },
  'tender-details': {
    title: 'Tender Details',
    pageKey: 'tender-details',
    kicker: 'Buyer tender record',
    heading: 'No buyer tender is selected yet.',
    body: 'Review requirements, supplier interest, clarifications, amendments, and evaluation readiness for buyer tenders.',
    statusLabel: 'No selected tender',
    visualTitle: 'Tender record waiting',
    visualText: 'Create and publish a tender before this page has a record to inspect.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Buyer tenders', value: '0', note: 'Tenders created by this account.' },
      { label: 'Clarifications', value: '0', note: 'Supplier questions for selected tenders.' },
      { label: 'Amendments', value: '0', note: 'Published tender changes.' },
      { label: 'Supplier interest', value: '0', note: 'Marketplace engagement.' }
    ],
    stepsKicker: 'Buyer record',
    stepsTitle: 'Tender details are created by the tender workflow',
    steps: procurementSequence,
    actionKicker: 'Next',
    actionTitle: 'Create activity first',
    actions: [createTender, viewMarketplace, openCommunication]
  },
  'tender-document': {
    title: 'Tender Document',
    pageKey: 'tender-document',
    kicker: 'Document workspace',
    heading: 'No tender document has been generated yet.',
    body: 'Tender documents are generated from the tender package after the buyer captures scope, requirements, evaluation criteria, and dates.',
    statusLabel: 'No document yet',
    visualTitle: 'Document builder waiting',
    visualText: 'Complete a tender draft to generate the document pack.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Generated packs', value: '0', note: 'Tender documents created from drafts.' },
      { label: 'Attachments', value: '0', note: 'Files uploaded to tender packages.' },
      { label: 'Ready for review', value: '0', note: 'Documents awaiting confirmation.' },
      { label: 'Published packs', value: '0', note: 'Documents visible to suppliers.' }
    ],
    stepsKicker: 'Document flow',
    stepsTitle: 'Documents come from a completed tender',
    steps: procurementSequence,
    actionKicker: 'Build',
    actionTitle: 'Prepare the source tender',
    actions: [createTender, openCommunication, viewMarketplace]
  },
  'tender-detail': {
    title: 'Tender Detail',
    pageKey: 'tender-detail',
    kicker: 'Supplier tender view',
    heading: 'No supplier tender has been selected.',
    body: 'Open a marketplace tender to review the tender pack, download documents, ask clarifications, and start a bid.',
    statusLabel: 'No selected opportunity',
    visualTitle: 'Supplier view waiting',
    visualText: 'Open the marketplace first, then choose a published tender to inspect or bid on.',
    primaryAction: { label: 'View marketplace', page: 'marketplace' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Selected tenders', value: '0', note: 'Marketplace opportunities opened.' },
      { label: 'Bid drafts', value: '0', note: 'Supplier bids started from tenders.' },
      { label: 'Clarifications', value: '0', note: 'Questions sent to buyers.' },
      { label: 'Downloads', value: '0', note: 'Tender documents accessed.' }
    ],
    stepsKicker: 'Supplier flow',
    stepsTitle: 'Select an opportunity before bidding',
    steps: [
      { label: '01', title: 'Open marketplace', description: 'Find a published tender that matches your capabilities.' },
      { label: '02', title: 'Review the tender pack', description: 'Read requirements, deadlines, documents, and clarification history.' },
      { label: '03', title: 'Start bid submission', description: 'The bid workspace is generated from that selected tender.' }
    ],
    actionKicker: 'Find work',
    actionTitle: 'Go to the opportunity source',
    actions: [viewMarketplace, openCommunication, createTender]
  },
  'bidding-workspace': {
    title: 'Bidding',
    pageKey: 'bidding-workspace',
    sidebarTitle: 'My Bids',
    sidebarNote: 'Supplier submission workspace',
    kicker: 'Bid submission workspace',
    heading: 'Choose a tender before preparing a bid.',
    body: 'Bid forms are generated from a selected tender, so this workspace stays empty until you open a published opportunity from the marketplace.',
    statusLabel: 'No bid draft',
    visualTitle: 'Bid workspace waiting',
    visualText: 'Select a tender to prepare eligibility documents, technical responses, pricing, and declarations.',
    primaryAction: { label: 'View marketplace', page: 'marketplace' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Draft bids', value: '0', note: 'Bids started but not submitted.' },
      { label: 'Submitted bids', value: '0', note: 'Sealed supplier submissions.' },
      { label: 'Selected tender', value: '0', note: 'Current opportunity loaded here.' },
      { label: 'Clarifications', value: '0', note: 'Questions linked to bid preparation.' }
    ],
    stepsKicker: 'Bid flow',
    stepsTitle: 'Bidding starts from a marketplace tender',
    steps: [
      { label: '01', title: 'Find a published tender', description: 'Use Marketplace to locate a tender that is open for bidding.' },
      { label: '02', title: 'Review requirements', description: 'The system builds the bid form from the tender documents.' },
      { label: '03', title: 'Submit the bid', description: 'Upload evidence, complete pricing, confirm declarations, and submit.' }
    ],
    actionKicker: 'Start bidding',
    actionTitle: 'Open a tender first',
    actions: [viewMarketplace, openCommunication, createTender]
  },
  'bid-evaluation': {
    title: 'Evaluation',
    pageKey: 'bid-evaluation',
    sidebarTitle: 'Bid Evaluation',
    sidebarNote: 'Tender review workspace',
    kicker: 'Evaluation app',
    heading: 'There are no bids ready for evaluation yet.',
    body: 'This is where you will evaluate bidders after a tender is published, the closing date passes, and supplier bids have been submitted.',
    statusLabel: 'Waiting for bids',
    visualTitle: 'Evaluation comes later',
    visualText: 'Create and publish a tender first. Submitted bids can then move into scoring, compliance checks, and award recommendation.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Ready to evaluate', value: '0', note: 'Closed tenders with submitted bids.' },
      { label: 'Submitted bids', value: '0', note: 'Supplier bids awaiting review.' },
      { label: 'Draft evaluations', value: '0', note: 'Saved scoring work.' },
      { label: 'Recommendations', value: '0', note: 'Evaluations ready for award.' }
    ],
    stepsKicker: 'Evaluation path',
    stepsTitle: 'Evaluation depends on real tender responses',
    steps: [
      { label: '01', title: 'Create and publish a tender', description: 'Capture requirements and evaluation criteria during tender setup.' },
      { label: '02', title: 'Wait for supplier bids', description: 'Suppliers submit bids from the marketplace before evaluation can begin.' },
      { label: '03', title: 'Score and recommend', description: 'Evaluate compliance, technical, and financial responses, then move to award.' }
    ],
    actionKicker: 'Next best action',
    actionTitle: 'Create the tender that will feed evaluation',
    actions: [createTender, viewMarketplace, openAwards]
  },
  'awarding-contracts': {
    title: 'Awarding and Contract',
    pageKey: 'awarding-contracts',
    sidebarTitle: 'Awarding and Contracts',
    sidebarNote: 'Awards, negotiations, signatures',
    kicker: 'Awarding and contracts',
    heading: 'No awards or contracts are in progress yet.',
    body: 'Awarding starts after evaluation is complete. Contracts begin after an award decision is accepted and the parties are ready to prepare terms.',
    statusLabel: 'No award queue',
    visualTitle: 'Contract lifecycle waiting',
    visualText: 'Create a tender, receive bids, and complete evaluation before award and contract actions begin.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'Open evaluation', page: 'bid-evaluation', variant: 'secondary' },
    stats: [
      { label: 'Urgent actions', value: '0', note: 'Award or contract tasks due now.' },
      { label: 'Award decisions', value: '0', note: 'Evaluated tenders ready for award.' },
      { label: 'Contracts in progress', value: '0', note: 'Drafting, negotiation, or signature.' },
      { label: 'Active contracts', value: '0', note: 'Signed contracts under delivery.' }
    ],
    stepsKicker: 'Lifecycle order',
    stepsTitle: 'Awarding is a secondary app',
    steps: [
      { label: '01', title: 'Evaluate submitted bids', description: 'Awards require an evaluated tender and a recommended supplier.' },
      { label: '02', title: 'Issue or respond to award', description: 'Buyers make decisions; suppliers accept, clarify, or decline.' },
      { label: '03', title: 'Prepare and track contract', description: 'Accepted awards move into contract review, signatures, and post-award tracking.' }
    ],
    actionKicker: 'Start upstream',
    actionTitle: 'Create the procurement record first',
    actions: [createTender, openEvaluation, openRecords]
  },
  'award-recommendation': {
    title: 'Award Recommendation',
    pageKey: 'award-recommendation',
    kicker: 'Award decision',
    heading: 'No evaluated tender is ready for award recommendation.',
    body: 'Award recommendations are prepared only after the evaluation team has reviewed submitted bids and identified the responsive supplier.',
    statusLabel: 'No evaluated tender',
    visualTitle: 'Recommendation waiting',
    visualText: 'Finish evaluation first to prepare the supplier, amount, justification, and approval trail.',
    primaryAction: { label: 'Open evaluation', page: 'bid-evaluation' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Evaluated tenders', value: '0', note: 'Evaluation records ready for award.' },
      { label: 'Draft recommendations', value: '0', note: 'Award decisions saved for review.' },
      { label: 'Pending approvals', value: '0', note: 'Recommendations awaiting authorization.' },
      { label: 'Awarded tenders', value: '0', note: 'Completed award decisions.' }
    ],
    stepsKicker: 'Award prerequisite',
    stepsTitle: 'Recommendation follows evaluation',
    steps: [
      { label: '01', title: 'Evaluate bids', description: 'Complete compliance, technical, and financial scoring.' },
      { label: '02', title: 'Select recommended supplier', description: 'Use evaluation evidence to justify the award decision.' },
      { label: '03', title: 'Move to contract', description: 'Accepted awards become contract preparation work.' }
    ],
    actionKicker: 'Continue',
    actionTitle: 'Go to the evaluation source',
    actions: [openEvaluation, createTender, openAwards]
  },
  'award-response': {
    title: 'Award Response',
    pageKey: 'award-response',
    kicker: 'Supplier award response',
    heading: 'No award notice has been received yet.',
    body: 'Suppliers can accept an award, request clarification, or decline before contract preparation begins.',
    statusLabel: 'No award notice',
    visualTitle: 'Supplier response waiting',
    visualText: 'Award notices appear here only after a buyer evaluates bids and issues an award to your organization.',
    primaryAction: { label: 'View marketplace', page: 'marketplace' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Awards received', value: '0', note: 'Award notices sent to this account.' },
      { label: 'Awaiting response', value: '0', note: 'Supplier actions pending.' },
      { label: 'Clarifications', value: '0', note: 'Award questions sent to buyers.' },
      { label: 'Accepted awards', value: '0', note: 'Awards moving to contract.' }
    ],
    stepsKicker: 'Supplier path',
    stepsTitle: 'Awards arrive after bidding and evaluation',
    steps: [
      { label: '01', title: 'Bid on a tender', description: 'Supplier award responses depend on submitted bids.' },
      { label: '02', title: 'Buyer evaluates and awards', description: 'The buyer issues an award decision after evaluation.' },
      { label: '03', title: 'Respond to the notice', description: 'Accept, clarify, or decline before contract preparation.' }
    ],
    actionKicker: 'Find opportunities',
    actionTitle: 'Start from marketplace activity',
    actions: [viewMarketplace, openCommunication, createTender]
  },
  'contract-negotiation': {
    title: 'Contract Negotiation',
    pageKey: 'contract-negotiation',
    kicker: 'Contract review',
    heading: 'No contract is ready for negotiation yet.',
    body: 'Contract negotiation opens after an award decision exists and the buyer or supplier needs to review terms, signatures, or requested changes.',
    statusLabel: 'No draft contract',
    visualTitle: 'Contract review waiting',
    visualText: 'Accepted awards will create contract tasks for negotiation, review, and signing.',
    primaryAction: { label: 'Open awards', page: 'awarding-contracts' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Draft contracts', value: '0', note: 'Contracts generated from awards.' },
      { label: 'Negotiations', value: '0', note: 'Open clause or term discussions.' },
      { label: 'Signatures due', value: '0', note: 'Buyer or supplier signing tasks.' },
      { label: 'Accepted terms', value: '0', note: 'Contracts ready to activate.' }
    ],
    stepsKicker: 'Contract prerequisite',
    stepsTitle: 'Negotiation follows an accepted award',
    steps: [
      { label: '01', title: 'Complete evaluation and award', description: 'A contract needs an award decision as its source.' },
      { label: '02', title: 'Generate draft terms', description: 'The draft contract uses tender, bid, award, and milestone details.' },
      { label: '03', title: 'Review and sign', description: 'Parties negotiate only the allowed terms, then sign.' }
    ],
    actionKicker: 'Go upstream',
    actionTitle: 'Open the award lifecycle first',
    actions: [openAwards, openEvaluation, createTender]
  },
  'post-award-tracking': {
    title: 'Post-Award Tracking',
    pageKey: 'post-award-tracking',
    kicker: 'Delivery and closure',
    heading: 'No active contract is ready for post-award tracking.',
    body: 'Post-award tracking begins after a contract is signed. This is where milestones, evidence, invoices, payments, and closure records will live.',
    statusLabel: 'No active contract',
    visualTitle: 'Delivery tracking waiting',
    visualText: 'Signed contracts will create delivery, payment, and closure records here.',
    primaryAction: { label: 'Open awards', page: 'awarding-contracts' },
    secondaryAction: { label: 'Create tender', page: 'create-tender', variant: 'secondary' },
    stats: [
      { label: 'Active contracts', value: '0', note: 'Signed contracts under delivery.' },
      { label: 'Milestones due', value: '0', note: 'Delivery checkpoints awaiting action.' },
      { label: 'Invoices', value: '0', note: 'Payment requests under review.' },
      { label: 'Closed records', value: '0', note: 'Completed contract files.' }
    ],
    stepsKicker: 'Post-award path',
    stepsTitle: 'Tracking starts after contract signature',
    steps: [
      { label: '01', title: 'Award the tender', description: 'Evaluation and award establish the supplier and value.' },
      { label: '02', title: 'Sign the contract', description: 'Both parties agree to contract terms and obligations.' },
      { label: '03', title: 'Track performance', description: 'Milestones, evidence, invoices, and closure records appear here.' }
    ],
    actionKicker: 'Prepare upstream',
    actionTitle: 'Open awards and contracts first',
    actions: [openAwards, openRecords, createTender]
  },
  'records-history': {
    title: 'Records and History',
    pageKey: 'records-history',
    sidebarTitle: 'Records and History',
    sidebarNote: 'Procurement archive',
    kicker: 'Procurement records',
    heading: 'No procurement records have been created yet.',
    body: 'Records are generated from real platform activity: tenders, bids, clarifications, evaluations, awards, contracts, and post-award events.',
    statusLabel: 'Archive empty',
    visualTitle: 'Records will build automatically',
    visualText: 'Use procurement apps normally; the archive will collect the evidence trail as work happens.',
    primaryAction: { label: 'Create tender', page: 'create-tender' },
    secondaryAction: { label: 'View marketplace', page: 'marketplace', variant: 'secondary' },
    stats: [
      { label: 'Tender records', value: '0', note: 'Created and published tenders.' },
      { label: 'Bid records', value: '0', note: 'Draft and submitted bids.' },
      { label: 'Contract records', value: '0', note: 'Award and contract files.' },
      { label: 'Evidence files', value: '0', note: 'Documents linked to activity.' }
    ],
    stepsKicker: 'Archive source',
    stepsTitle: 'Records are created by activity',
    steps: procurementSequence,
    actionKicker: 'Start activity',
    actionTitle: 'Create the first record source',
    actions: [createTender, viewMarketplace, openCommunication]
  },
  'admin-dashboard': {
    title: 'Platform Admin',
    pageKey: 'admin-dashboard',
    sidebarTitle: 'Platform Admin',
    sidebarNote: 'System oversight',
    kicker: 'Admin command center',
    heading: 'No platform activity has been indexed yet.',
    body: 'Admin metrics summarize account reviews, compliance flags, tender checks, and audit events.',
    statusLabel: 'No admin queue',
    visualTitle: 'Oversight ready',
    visualText: 'Admin totals remain empty until platform activity is recorded.',
    primaryAction: { label: 'Go to dashboard', page: 'workspace-dashboard' },
    secondaryAction: { label: 'Open communication', page: 'communication-center', variant: 'secondary' },
    stats: [
      { label: 'Pending reviews', value: '0', note: 'Accounts or tenders awaiting admin action.' },
      { label: 'Compliance flags', value: '0', note: 'Issues raised by real checks.' },
      { label: 'Audit events', value: '0', note: 'Tracked platform actions.' },
      { label: 'Reports ready', value: '0', note: 'Exportable admin reports.' }
    ],
    stepsKicker: 'Admin scope',
    stepsTitle: 'Admin tools observe platform activity',
    steps: [
      { label: '01', title: 'Users create activity', description: 'Accounts, tenders, bids, and contracts create reviewable records.' },
      { label: '02', title: 'Compliance checks run', description: 'Rules and review queues populate from those records.' },
      { label: '03', title: 'Admin acts on exceptions', description: 'Admins inspect evidence without changing buyer scores or award decisions.' }
    ],
    actionKicker: 'Admin navigation',
    actionTitle: 'Oversight areas',
    actions: [
      { title: 'User management', description: 'Review accounts after users register.', page: 'admin-users', icon: 'iam' },
      { title: 'Platform analytics', description: 'Track platform activity after records are submitted.', page: 'admin-analytics', icon: 'evaluation' },
      { title: 'Audit trail', description: 'Audit events will appear after platform actions occur.', page: 'admin-audit', icon: 'records' }
    ],
    navItems: adminNavItems
  },
  'admin-users': {
    title: 'Admin Users',
    pageKey: 'admin-users',
    kicker: 'User management',
    heading: 'No user accounts are waiting for admin review.',
    body: 'User management shows registered accounts, verification status, and review actions.',
    statusLabel: 'No user queue',
    visualTitle: 'Account review waiting',
    visualText: 'This page should not list sample people or organizations before registration happens.',
    primaryAction: { label: 'Go to admin', page: 'admin-dashboard' },
    secondaryAction: { label: 'Open communication', page: 'communication-center', variant: 'secondary' },
    stats: [
      { label: 'Registered users', value: '0', note: 'Accounts created through onboarding.' },
      { label: 'Pending verification', value: '0', note: 'Accounts awaiting review.' },
      { label: 'Approved users', value: '0', note: 'Accounts cleared for platform use.' },
      { label: 'Issues flagged', value: '0', note: 'Accounts needing attention.' }
    ],
    stepsKicker: 'User lifecycle',
    stepsTitle: 'Users appear after onboarding',
    steps: firstRunConfigsPlaceholderSteps(),
    actionKicker: 'Admin navigation',
    actionTitle: 'Review areas',
    actions: [
      { title: 'Platform analytics', description: 'Track account and platform activity.', page: 'admin-analytics', icon: 'evaluation' },
      { title: 'Admin command center', description: 'Return to the admin overview.', page: 'admin-dashboard', icon: 'records' },
      { title: 'Audit trail', description: 'Inspect user-related platform events.', page: 'admin-audit', icon: 'records' }
    ],
    navItems: adminNavItems
  },
  'admin-analytics': {
    title: 'Admin Analytics',
    pageKey: 'admin-analytics',
    kicker: 'Platform analytics',
    heading: 'There is no activity to chart yet.',
    body: 'Analytics will summarize real procurement volume, cycle times, supplier participation, compliance trends, and account activity after records exist.',
    statusLabel: 'No analytics data',
    visualTitle: 'Charts waiting for records',
    visualText: 'Analytics totals update when procurement records are available.',
    primaryAction: { label: 'Go to admin', page: 'admin-dashboard' },
    secondaryAction: { label: 'Open records', page: 'records-history', variant: 'secondary' },
    stats: [
      { label: 'Procurement value', value: 'TZS 0', note: 'Sum of real tender and contract records.' },
      { label: 'Published tenders', value: '0', note: 'Tenders created on the platform.' },
      { label: 'Average award cycle', value: '0 days', note: 'Calculated after award activity.' },
      { label: 'Reports', value: '0', note: 'Generated analytics exports.' }
    ],
    stepsKicker: 'Analytics source',
    stepsTitle: 'Charts need platform activity',
    steps: firstRunConfigsPlaceholderSteps(),
    actionKicker: 'Admin navigation',
    actionTitle: 'Where data will come from',
    actions: [
      { title: 'Records archive', description: 'Procurement records feed analytics.', page: 'records-history', icon: 'records' },
      { title: 'User management', description: 'Account activity feeds trend charts.', page: 'admin-users', icon: 'iam' },
      { title: 'Audit trail', description: 'Audit events feed platform activity reports.', page: 'admin-audit', icon: 'records' }
    ],
    navItems: adminNavItems
  },
  'admin-audit': {
    title: 'Admin Audit',
    pageKey: 'admin-audit',
    kicker: 'Full audit trail',
    heading: 'No audit events have been recorded yet.',
    body: 'The audit trail will list real sign-ins, account reviews, tender actions, bid events, award decisions, contract actions, and admin reviews.',
    statusLabel: 'Audit trail empty',
    visualTitle: 'Event log waiting',
    visualText: 'Platform actions will create audit rows automatically once users begin working.',
    primaryAction: { label: 'Go to admin', page: 'admin-dashboard' },
    secondaryAction: { label: 'Open records', page: 'records-history', variant: 'secondary' },
    stats: [
      { label: 'Audit events', value: '0', note: 'Tracked platform actions.' },
      { label: 'Admin actions', value: '0', note: 'Reviews performed by admins.' },
      { label: 'Record changes', value: '0', note: 'Tender, bid, award, and contract updates.' },
      { label: 'Exports', value: '0', note: 'Audit reports generated.' }
    ],
    stepsKicker: 'Audit source',
    stepsTitle: 'Audit trails follow real actions',
    steps: firstRunConfigsPlaceholderSteps(),
    actionKicker: 'Admin navigation',
    actionTitle: 'Oversight areas',
    actions: [
      { title: 'Admin command center', description: 'Return to the admin overview.', page: 'admin-dashboard', icon: 'records' },
      { title: 'Platform analytics', description: 'Review activity trends created by audit events.', page: 'admin-analytics', icon: 'evaluation' },
      { title: 'User management', description: 'Account reviews will be logged here.', page: 'admin-users', icon: 'iam' }
    ],
    navItems: adminNavItems
  }
};

function firstRunConfigsPlaceholderSteps(): FirstRunStep[] {
  return [
    {
      label: '01',
      title: 'Users create records',
      description: 'Registration, tender creation, bidding, and contracting create the data source.'
    },
    {
      label: '02',
      title: 'System records the activity',
      description: 'Submitted forms, workflow actions, and compliance checks create reviewable evidence.'
    },
    {
      label: '03',
      title: 'Admin tools surface exceptions',
      description: 'Search, compliance, analytics, and audit pages fill with actual platform activity.'
    }
  ];
}

type FirstRunAppPageProps = {
  page: FirstRunPageKey;
};

export function FirstRunAppPage({ page }: FirstRunAppPageProps) {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const config = firstRunConfigs[page];
  const organization = user?.organization || 'Your organization';
  const navItems = config.navItems ?? appNavItems;

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = config.pageKey;
    document.body.dataset.procurexReactPage = 'true';

    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
      delete document.body.dataset.procurexReactPage;
    };
  }, [config.pageKey]);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey as AppRouteKey] || '/dashboard');
  }

  function actionClass(action: FirstRunAction) {
    return action.variant === 'secondary' ? 'btn btn-secondary' : 'btn btn-primary';
  }

  return (
    <>
      <WorkspaceTopBar title={config.title} onNavigate={navigateToPage} />
      <div className="main-layout dashboard-command-center dashboard-first-run-page">
        <aside className="sidebar dashboard-sidebar">
          <div className="sidebar-heading">
            <h3>{config.sidebarTitle ?? config.title}</h3>
            <div>{config.sidebarNote ?? organization}</div>
          </div>
          <ul className="sidebar-nav">
            {navItems.map((item) => (
              <li key={item.page}>
                <button
                  type="button"
                  className={item.page === page ? 'active' : ''}
                  onClick={() => navigateToPage(item.page)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          <div className="workspace-home">
            <section className="dashboard-welcome-card dashboard-reference-welcome dashboard-first-run-hero">
              <div className="dashboard-reference-copy">
                <span className="section-kicker">{config.kicker}</span>
                <h1>{config.heading}</h1>
                <p>{config.body}</p>
                <div className="inline-actions dashboard-welcome-actions">
                  <button className={actionClass(config.primaryAction)} type="button" onClick={() => navigateToPage(config.primaryAction.page)}>
                    {config.primaryAction.label}
                  </button>
                  {config.secondaryAction ? (
                    <button className={actionClass(config.secondaryAction)} type="button" onClick={() => navigateToPage(config.secondaryAction!.page)}>
                      {config.secondaryAction.label}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="dashboard-reference-visual" aria-label={`${config.title} first-run overview`}>
                <div className="dashboard-reference-avatar" aria-hidden="true">
                  PX
                </div>
                <article className="dashboard-reference-profile">
                  <span className="badge badge-info">{config.statusLabel}</span>
                  <strong>{config.visualTitle}</strong>
                  <p>{config.visualText}</p>
                </article>
                <div className="dashboard-reference-pills" aria-label={`${config.title} totals`}>
                  {config.stats.slice(0, 3).map((stat) => (
                    <span key={stat.label}>{stat.value} {stat.label.toLowerCase()}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="analytics-grid dashboard-real-metrics">
              {config.stats.map((stat) => (
                <article className="analytics-card" key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <p>{stat.note}</p>
                </article>
              ))}
            </section>

            <section className="dashboard-grid-main">
              <div className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{config.stepsKicker}</span>
                    <h2>{config.stepsTitle}</h2>
                  </div>
                </div>
                <div className="dashboard-first-run-actions">
                  {config.steps.map((step) => (
                    <article className="dashboard-first-run-action" key={step.label}>
                      <span className="app-menu-icon">
                        <strong>{step.label}</strong>
                      </span>
                      <span>
                        <strong>{step.title}</strong>
                        <em>{step.description}</em>
                      </span>
                    </article>
                  ))}
                </div>
              </div>

            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">{config.actionKicker}</span>
                  <h2>{config.actionTitle}</h2>
                </div>
              </div>
              <div className="dashboard-first-run-actions">
                {config.actions.map((action) => (
                  <button className="dashboard-first-run-action" type="button" key={action.title} onClick={() => navigateToPage(action.page)}>
                    <AppMenuIcon kind={action.icon} />
                    <span>
                      <strong>{action.title}</strong>
                      <em>{action.description}</em>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
