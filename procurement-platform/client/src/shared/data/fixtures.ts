/* Provides deterministic shared fixture data for demos and tests that need realistic workflow context. */
import type { AdminMetric, Bid, MessageItem, RecordItem, SessionUser, Tender, TimelineItem, WorkItem } from '@/shared/types/domain';

export const demoUsers: Record<'user' | 'admin', SessionUser> = {
  user: {
    id: 'demo-user-1',
    displayName: 'Verified User',
    email: 'demo@procurex.tz',
    accountType: 'USER',
    organization: 'Verified Company Account',
    capabilities: ['BUYER', 'SUPPLIER'],
    verificationStatus: 'APPROVED',
    permissions: [
      'identity.verify',
      'procurement.create',
      'procurement.publish',
      'bidding.submit',
      'evaluation.manage',
      'award.manage',
      'award.respond',
      'contract.manage',
      'contract.sign',
      'contract.track'
    ],
    trustTier: 'PLATINUM',
    riskLevel: 'LOW',
    screeningStatus: 'CLEAR',
    featureGates: {
      identityVerification: false,
      adminReview: false,
      tenderCreation: true,
      tenderPublication: true,
      bidSubmission: true,
      evaluationManagement: true,
      awardManagement: true,
      awardResponse: true,
      contractManagement: true,
      contractSigning: true,
      contractTracking: true,
      complianceReview: false
    }
  },
  admin: {
    id: 'admin-1',
    displayName: 'Admin User',
    email: 'admin@procurex.tz',
    accountType: 'ADMIN',
    organization: 'ProcureX Platform',
    capabilities: [],
    verificationStatus: 'APPROVED',
    permissions: [
      'identity.verify',
      'identity.review',
      'procurement.create',
      'procurement.publish',
      'bidding.submit',
      'evaluation.manage',
      'award.manage',
      'award.respond',
      'contract.manage',
      'contract.sign',
      'contract.track',
      'admin.access',
      'compliance.review'
    ],
    trustTier: 'PLATINUM',
    riskLevel: 'LOW',
    screeningStatus: 'CLEAR',
    featureGates: {
      identityVerification: false,
      adminReview: true,
      tenderCreation: true,
      tenderPublication: true,
      bidSubmission: true,
      evaluationManagement: true,
      awardManagement: true,
      awardResponse: true,
      contractManagement: true,
      contractSigning: true,
      contractTracking: true,
      complianceReview: true
    }
  }
};

export const tenders: Tender[] = [
  {
    id: 'tender-1',
    reference: 'PX-WRK-2026-001',
    title: 'Construction of District Maternal Health Wing',
    organization: 'Ministry of Health',
    buyerLogoUrl: '/assets/mock-business-logos/ministry-health.svg',
    type: 'WORKS',
    status: 'OPEN',
    budget: 6850000000,
    currency: 'TZS',
    closingDate: '2026-08-03',
    location: 'Dodoma Regional Referral Hospital',
    description: 'Construction, finishing, medical gas routing, and handover of a two-storey maternal health wing.',
    categories: ['Healthcare infrastructure', 'Construction', 'Medical facilities']
  },
  {
    id: 'tender-2',
    reference: 'PX-GDS-2026-014',
    title: 'Supply of Hospital Diagnostic Equipment',
    organization: 'Muhimbili National Hospital',
    buyerLogoUrl: '/assets/mock-business-logos/muhimbili-national-hospital.svg',
    type: 'GOODS',
    status: 'OPEN',
    budget: 2450000000,
    currency: 'TZS',
    closingDate: '2026-08-26',
    location: 'Dar es Salaam',
    description: 'Supply, delivery, installation, calibration, and warranty support for diagnostic equipment.',
    categories: ['Medical equipment', 'Warranty', 'Installation']
  },
  {
    id: 'tender-3',
    reference: 'PX-SVC-2026-022',
    title: 'Facilities Maintenance Services Framework',
    organization: 'Verified Company Account',
    buyerLogoUrl: '/assets/mock-business-logos/verified-company-account.svg',
    type: 'SERVICE',
    status: 'PUBLISHED',
    budget: 820000000,
    currency: 'TZS',
    closingDate: '2026-09-15',
    location: 'Arusha, Mwanza, Dar es Salaam',
    description: 'Multi-region building maintenance, response SLA, reporting, and quality assurance framework.',
    createdByCurrentUser: true,
    categories: ['Facilities', 'Maintenance', 'Framework']
  }
];

export const bids: Bid[] = [
  { id: 'bid-1', tenderReference: 'PX-WRK-2026-001', supplier: 'Lake Builders Ltd', status: 'SUBMITTED', amount: 6200000000, score: 86 },
  { id: 'bid-2', tenderReference: 'PX-SVC-2026-022', supplier: 'Prime Facilities Tanzania', status: 'UNDER_EVALUATION', amount: 790000000, score: 79 },
  { id: 'bid-3', tenderReference: 'PX-GDS-2026-014', supplier: 'MedTech East Africa', status: 'DRAFT', amount: 2380000000, score: 0 }
];

export const procurementTimeline: TimelineItem[] = [
  { id: 'planning', label: 'Planning', date: '2026-05-10', status: 'complete' },
  { id: 'publication', label: 'Publication', date: '2026-05-18', status: 'complete' },
  { id: 'clarification', label: 'Clarification', date: '2026-06-19', status: 'current' },
  { id: 'closing', label: 'Closing', date: '2026-08-03', status: 'pending' },
  { id: 'evaluation', label: 'Evaluation', date: '2026-07-24', status: 'pending' },
  { id: 'award', label: 'Award', date: '2026-08-07', status: 'pending' }
];

export const workItems: WorkItem[] = [
  { id: 'work-1', title: 'Publish tender draft', subtitle: 'Facilities Maintenance Services Framework', status: 'Draft', nav: '/procurement/tender-publication', priority: 'High' },
  { id: 'work-2', title: 'Respond to clarification', subtitle: 'Maternal Health Wing', status: 'Action required', nav: '/communication', priority: 'Urgent' },
  { id: 'work-3', title: 'Continue bid package', subtitle: 'Hospital Diagnostic Equipment', status: 'Draft', nav: '/bidding', priority: 'Normal' },
  { id: 'work-4', title: 'Review evaluation report', subtitle: 'Facilities Maintenance Framework', status: 'Review', nav: '/evaluation', priority: 'High' }
];

export const messages: MessageItem[] = [
  { id: 'msg-1', subject: 'Clarification window update', body: 'Site visit dates have been confirmed for the maternal health wing tender.', category: 'Clarification', status: 'Unread', priority: 'High', tenderReference: 'PX-WRK-2026-001' },
  { id: 'msg-2', subject: 'Verification profile approved', body: 'Your company profile is approved for buyer and supplier capability.', category: 'Identity', status: 'Read', priority: 'Normal' },
  { id: 'msg-3', subject: 'Award draft autosaved', body: 'A new award recommendation draft is available for continuation.', category: 'Award', status: 'Action required', priority: 'Urgent', tenderReference: 'PX-SVC-2026-022' }
];

export const records: RecordItem[] = [
  { id: 'rec-1', entityType: 'Tender', reference: 'PX-WRK-2026-001', title: 'Publication notice and annexes', status: 'Published', owner: 'Ministry of Health', date: '2026-05-18' },
  { id: 'rec-2', entityType: 'Bid', reference: 'BID-PX-WRK-001-LBL', title: 'Submitted technical and financial bid', status: 'Submitted', owner: 'Lake Builders Ltd', date: '2026-06-01' },
  { id: 'rec-3', entityType: 'Contract', reference: 'CTR-PX-SVC-022', title: 'Facilities framework contract draft', status: 'Negotiation', owner: 'Prime Facilities Tanzania', date: '2026-06-08' },
  { id: 'rec-4', entityType: 'Audit', reference: 'AUD-2026-3481', title: 'Admin compliance review log', status: 'Complete', owner: 'ProcureX Platform', date: '2026-06-10' }
];

export const adminMetrics: AdminMetric[] = [
  { label: 'Active Tenders', value: '128', note: 'Published or in-flight' },
  { label: 'Pending Reviews', value: '23', note: 'Need compliance action' },
  { label: 'Flagged Issues', value: '8', note: 'Warnings and returns' },
  { label: 'Compliance Rate', value: '94%', note: 'Current platform signal' }
];

export const chartSeries = [
  { name: 'Jan', tenders: 18, bids: 42, awards: 8 },
  { name: 'Feb', tenders: 24, bids: 51, awards: 11 },
  { name: 'Mar', tenders: 30, bids: 68, awards: 16 },
  { name: 'Apr', tenders: 27, bids: 61, awards: 14 },
  { name: 'May', tenders: 35, bids: 82, awards: 20 },
  { name: 'Jun', tenders: 40, bids: 91, awards: 24 }
];
