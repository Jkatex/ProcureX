/* Supports the help centre server workflow with reusable logic kept close to the module that owns it. */
import type { HelpFaqCategory } from '@procurex/shared';

export const approvedHelpActionPaths = [
  '/dashboard',
  '/identity/profile',
  '/identity/verification',
  '/tender-planning',
  '/procurement/marketplace',
  '/procurement/create-tender',
  '/procurement/tender-publication',
  '/procurement/tender-details',
  '/procurement/my-tenders',
  '/procurement/my-bids',
  '/bidding',
  '/evaluation',
  '/awards-contracts',
  '/awards-contracts/recommendation',
  '/awards-contracts/award-response',
  '/awards-contracts/negotiation',
  '/awards-contracts/post-award',
  '/communication',
  '/records',
  '/privacy',
  '/terms',
  '/contact',
  '/support',
  '/help'
] as const;

export const genericWeakTerms = new Set([
  'tender',
  'bid',
  'account',
  'contract',
  'help',
  'status',
  'document',
  'payment',
  'company'
]);

export const stopWords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'do',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'my',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'when',
  'where',
  'with',
  'you',
  'your'
]);

export const helpCategories = [
  category('getting-started', 'Getting started', 'Platform basics, roles, dashboard, navigation, and first steps.', ['Overview', 'Roles', 'Navigation', 'First steps'], ['PUBLIC', 'BUYER', 'SUPPLIER'], 300),
  category('registration', 'Registration', 'Account creation, company registration, verification codes, and registration corrections.', ['Account creation', 'Company details', 'Verification codes', 'Review outcome'], ['PUBLIC'], 295),
  category('login-security', 'Login and account security', 'Sign-in, passwords, sessions, recovery, and account protection.', ['Login', 'Passwords', 'Sessions', 'Recovery'], ['PUBLIC', 'BUYER', 'SUPPLIER'], 290),
  category('company-verification', 'Company verification', 'Required documents, verification statuses, review comments, and resubmission.', ['Documents', 'Review status', 'Rejection', 'Resubmission'], ['BUYER', 'SUPPLIER'], 285),
  category('company-profile', 'Company profile', 'Business details, capabilities, contacts, documents, and profile completeness.', ['Business details', 'Capabilities', 'Documents', 'Visibility'], ['BUYER', 'SUPPLIER'], 280),
  category('dashboard-navigation', 'Dashboard and navigation', 'Dashboard summaries, quick actions, notifications, and module navigation.', ['Dashboard', 'Quick actions', 'Notifications', 'Finding work'], ['BUYER', 'SUPPLIER'], 275),
  category('procurement-planning', 'Procurement planning', 'Plans, plan items, budgets, approvals, drafts, and tender handoff.', ['Plan creation', 'Items', 'Approval', 'Handoff'], ['BUYER'], 270),
  category('tender-creation', 'Tender creation', 'Tender details, requirements, criteria, lots, drafts, and validation.', ['Tender details', 'Requirements', 'Criteria', 'Drafts'], ['BUYER'], 265),
  category('goods-tender-requirements', 'Goods tender requirements', 'Specifications, quantities, delivery, warranty, and product evidence.', ['Specifications', 'Delivery', 'Warranty', 'Evidence'], ['BUYER', 'SUPPLIER'], 260),
  category('works-tender-requirements', 'Works tender requirements', 'Scope, BOQ, drawings, site visits, milestones, and completion.', ['Scope', 'BOQ', 'Site visits', 'Completion'], ['BUYER', 'SUPPLIER'], 255),
  category('services-tender-requirements', 'Services tender requirements', 'Service levels, deliverables, performance indicators, and support.', ['Service levels', 'Deliverables', 'Schedules', 'Acceptance'], ['BUYER', 'SUPPLIER'], 250),
  category('consultancy-tender-requirements', 'Consultancy tender requirements', 'Terms of reference, experts, methodology, proposals, and reports.', ['Terms of reference', 'Experts', 'Proposals', 'Reports'], ['BUYER', 'SUPPLIER'], 245),
  category('tender-publication', 'Tender publication', 'Publication, addenda, status, deadline changes, cancellation, and archive.', ['Publication', 'Addenda', 'Dates', 'Cancellation'], ['BUYER'], 240),
  category('marketplace', 'Marketplace', 'Tender discovery, search, filters, details, saving, alerts, and eligibility.', ['Search', 'Filters', 'Details', 'Saved tenders'], ['SUPPLIER'], 235),
  category('bid-preparation', 'Bid preparation', 'Bid drafts, technical and financial sections, uploads, declarations, and validation.', ['Drafts', 'Technical proposal', 'Financial proposal', 'Documents'], ['SUPPLIER'], 230),
  category('bid-submission', 'Bid submission', 'Submission, receipts, late bids, withdrawal, resubmission, and confidentiality.', ['Submission', 'Receipts', 'Withdrawal', 'Confidentiality'], ['SUPPLIER'], 225),
  category('clarifications', 'Clarifications', 'Tender questions, deadlines, buyer responses, attachments, and history.', ['Requests', 'Responses', 'Deadlines', 'History'], ['BUYER', 'SUPPLIER'], 220),
  category('communication-centre', 'Communication Centre', 'Messages, attachments, notifications, support conversations, and archives.', ['Messages', 'Attachments', 'Notifications', 'Support'], ['BUYER', 'SUPPLIER'], 215),
  category('evaluation', 'Evaluation', 'Evaluation stages, criteria, committees, reports, confidentiality, and audit history.', ['Stages', 'Criteria', 'Reports', 'Audit'], ['BUYER'], 210),
  category('awards', 'Awards', 'Recommendations, award notices, responses, unsuccessful notices, lots, and disputes.', ['Recommendations', 'Notices', 'Responses', 'History'], ['BUYER', 'SUPPLIER'], 205),
  category('contract-formation', 'Contract formation', 'Draft contracts, clauses, negotiation, signatures, versions, and securities.', ['Drafts', 'Negotiation', 'Signatures', 'Versions'], ['BUYER', 'SUPPLIER'], 200),
  category('contract-management', 'Active contract management', 'Active contracts, milestones, inspections, variations, completion, and closure.', ['Milestones', 'Inspections', 'Variations', 'Closure'], ['BUYER', 'SUPPLIER'], 195),
  category('post-award', 'Post-award activities', 'Mobilisation, delivery evidence, acceptance, performance, and closeout.', ['Mobilisation', 'Delivery', 'Acceptance', 'Performance'], ['BUYER', 'SUPPLIER'], 190),
  category('invoices', 'Invoices', 'Invoice creation, documents, duplicate checks, approval, rejection, and history.', ['Creation', 'Documents', 'Approval', 'History'], ['SUPPLIER', 'BUYER'], 185),
  category('payments', 'Payments', 'Payment status, approval, confirmation, bank details, deductions, and reconciliation.', ['Status', 'Approval', 'Confirmation', 'Reconciliation'], ['SUPPLIER', 'BUYER'], 180),
  category('complaints-disputes-appeals', 'Complaints, disputes and appeals', 'Complaints, appeals, evidence, escalations, sanctions, and misconduct reports.', ['Complaints', 'Appeals', 'Evidence', 'Escalation'], ['BUYER', 'SUPPLIER'], 175),
  category('records-history', 'Records and history', 'Procurement history, audit trails, archives, search, filters, and exports.', ['History', 'Audit trails', 'Archive', 'Exports'], ['BUYER', 'SUPPLIER'], 170),
  category('notifications', 'Notifications', 'Email and in-app alerts, preferences, missing notifications, and read states.', ['Email', 'In-app', 'Preferences', 'Read states'], ['BUYER', 'SUPPLIER'], 165),
  category('technical-support', 'Technical support', 'Loading issues, uploads, browser support, errors, cache, and bug reporting.', ['Performance', 'Uploads', 'Browsers', 'Bug reports'], ['PUBLIC', 'BUYER', 'SUPPLIER'], 160),
  category('privacy-security', 'Privacy and security', 'Data privacy, confidentiality, audit logs, secure uploads, and incident reporting.', ['Privacy', 'Confidentiality', 'Audit logs', 'Incidents'], ['PUBLIC', 'BUYER', 'SUPPLIER'], 155)
] as const satisfies HelpFaqCategory[];

function category(
  id: string,
  title: string,
  description: string,
  subcategories: string[],
  roles: HelpFaqCategory['roles'],
  priority: number
): HelpFaqCategory {
  return { id, title, description, subcategories, roles, priority };
}
