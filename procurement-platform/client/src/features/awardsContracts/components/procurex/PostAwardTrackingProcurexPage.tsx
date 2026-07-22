/* Renders the awards Contracts Post Award Tracking ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { postAwardApi } from '@/features/postAward/api';
import type { PostAwardContractRow } from '@/features/postAward/types';
import { awardsContractsApi } from '../../api';
import type {
  AwardContractDocumentDto,
  AwardContractDocumentUploadInput,
  ContractDetailDto,
  ContractLifecycleItemDto,
  LifecycleAction,
  PickerOption
} from '../../types';
import {
  ActionFormPanel,
  contractStatusOptions,
  invoiceStatusOptions,
  itemOptions,
  lifecycleStatusOptions,
  milestoneStatusOptions,
  option,
  recordPickerOptions,
  riskLevelOptions,
  trustTierOptions,
  terminationStatusOptions,
  terminationTypeOptions
} from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { LockedFlowStepPanel } from './AwardContractFlow';
import { flowStepFromSearch } from './AwardContractFlowState';
import {
  AwardHero,
  ProcurexAwardFrame,
  RemoteStatePanel,
  RegisterCard,
  SimpleTable,
  StatusBadge,
  type WorkflowSection
} from './AwardsContractsProcurexShared';

function getContractId(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

type PostAwardGroupId = 'cmp' | 'delivery' | 'inspections' | 'payments' | 'risk' | 'changes' | 'termination' | 'warranty' | 'closeout' | 'performance' | 'registers';
const postAwardFlowStepIds = ['cmp', 'delivery', 'inspections', 'payments', 'risk', 'changes', 'termination', 'warranty', 'closeout', 'performance', 'registers'] as const;
type PostAwardSectionId = typeof postAwardFlowStepIds[number];
type PostAwardWorkGroupId = 'setup' | 'delivery' | 'finance' | 'risk-changes' | 'closeout-performance';
type ContractExecutionType = 'GOODS' | 'WORKS' | 'SERVICES' | 'CONSULTANCY' | 'GENERAL';

const sectionSlugByStep: Record<PostAwardSectionId, string> = {
  cmp: 'setup',
  delivery: 'delivery',
  inspections: 'inspections',
  payments: 'finance',
  risk: 'risk',
  changes: 'changes',
  termination: 'termination',
  warranty: 'documents',
  closeout: 'closeout',
  performance: 'performance',
  registers: 'history'
};

const stepBySectionSlug: Record<string, PostAwardSectionId> = {
  ...(Object.fromEntries(
    Object.entries(sectionSlugByStep).map(([step, slug]) => [slug, step])
  ) as Record<string, PostAwardSectionId>),
  claims: 'changes'
};

const legacyStageToStep: Record<string, PostAwardSectionId> = {
  setup: 'cmp',
  delivery: 'delivery',
  acceptance: 'inspections',
  finance: 'payments',
  issues: 'changes',
  variations: 'changes',
  closeout: 'closeout',
  history: 'registers'
};

function postAwardPagePath(step: PostAwardSectionId) {
  return `/post-award/${sectionSlugByStep[step]}`;
}

function postAwardSearch(search: string) {
  const params = new URLSearchParams(search);
  params.delete('stage');
  params.delete('step');
  const next = params.toString();
  return next ? `?${next}` : '';
}

function activeStepFromLocation(sectionSlug: string | undefined, search: string): PostAwardSectionId {
  const routeStep = sectionSlug ? stepBySectionSlug[sectionSlug] : undefined;
  if (routeStep) return routeStep;
  const params = new URLSearchParams(search);
  const legacyStage = params.get('stage');
  if (legacyStage && legacyStageToStep[legacyStage]) return legacyStageToStep[legacyStage];
  return flowStepFromSearch(search, postAwardFlowStepIds, 'cmp');
}

function legacyPostAwardTarget(sectionSlug: string | undefined, search: string) {
  if (sectionSlug && stepBySectionSlug[sectionSlug]) return '';
  const params = new URLSearchParams(search);
  const legacyStage = params.get('stage');
  const legacyStep = params.get('step');
  const step = legacyStage ? legacyStageToStep[legacyStage] : legacyStep && postAwardFlowStepIds.includes(legacyStep as PostAwardSectionId) ? legacyStep as PostAwardSectionId : null;
  if (step) return `${postAwardPagePath(step)}${postAwardSearch(search)}`;
  if (params.has('contract')) return `${postAwardPagePath('cmp')}${postAwardSearch(search)}`;
  return '';
}

function postAwardSectionFromPath(pathname: string) {
  const match = pathname.match(/\/post-award\/([^/?#]+)/);
  return match?.[1] ?? '';
}

function postAwardRouteFromPath(pathname: string) {
  const [, tail = ''] = pathname.split('/post-award/');
  const [sectionSlug = '', registerSlug = '', recordId = ''] = tail.split('/').filter(Boolean);
  return { sectionSlug, registerSlug, recordId };
}

function postAwardDeepPath(step: PostAwardSectionId, registerSlug: string, search: string, recordId?: string) {
  const base = `${postAwardPagePath(step)}/${registerSlug}${recordId ? `/${encodeURIComponent(recordId)}` : ''}`;
  return `${base}${postAwardSearch(search)}`;
}

const postAwardWorkGroups: Array<{
  id: PostAwardWorkGroupId;
  label: string;
  description: string;
  sectionIds: PostAwardSectionId[];
}> = [
  { id: 'setup', label: 'Setup', description: 'Plans, documents, and securities.', sectionIds: ['cmp', 'warranty'] },
  { id: 'delivery', label: 'Delivery', description: 'Milestones, deliverables, and acceptance.', sectionIds: ['delivery', 'inspections'] },
  { id: 'finance', label: 'Finance', description: 'Invoices, payments, and penalties.', sectionIds: ['payments'] },
  { id: 'risk-changes', label: 'Risk & Changes', description: 'Risks, changes, issues, and disputes.', sectionIds: ['risk', 'changes', 'termination'] },
  { id: 'closeout-performance', label: 'Close-out & Performance', description: 'Close-out, performance, and history.', sectionIds: ['closeout', 'performance', 'registers'] }
];

const executionWorkflowConfig: Record<ContractExecutionType, {
  label: string;
  summary: string;
  deliveryForms: string[];
  inspectionForms: string[];
  financeForms: string[];
  deliveryRegisters: string[];
  inspectionRegisters: string[];
  financeRegisters: string[];
  recommended: Array<{ step: PostAwardSectionId; title: string; detail: string; priority: string }>;
}> = {
  GOODS: {
    label: 'Goods execution',
    summary: 'Schedule, dispatch, receive, inspect, accept, invoice, and pay delivered goods.',
    deliveryForms: ['Milestone progress', 'Milestone evidence', 'Deliverable', 'Goods delivery schedule', 'Dispatch notice', 'Goods receipt'],
    inspectionForms: ['Inspection', 'Goods inspection', 'Acceptance certificate'],
    financeForms: ['Payment schedule', 'Invoice submission', 'Three-way match', 'Payment review', 'Invoice status', 'Payment approval', 'Payment confirmation', 'Penalty or deduction'],
    deliveryRegisters: ['Mobilization', 'Milestones', 'Deliverables', 'Delivery schedules', 'Dispatch notices', 'Goods receipts'],
    inspectionRegisters: ['Inspections', 'Goods inspections', 'Acceptance'],
    financeRegisters: ['Payment schedule', 'Purchase orders', 'Invoices', 'Payments', 'Three-way matches', 'Penalties and deductions', 'Payment approvals', 'Payment confirmations'],
    recommended: [
      { step: 'delivery', title: 'Record dispatch or receipt', detail: 'Capture supplier dispatch and buyer receipt before inspection.', priority: 'High' },
      { step: 'inspections', title: 'Inspect received goods', detail: 'Approve, reject, or record defects before invoicing.', priority: 'High' },
      { step: 'payments', title: 'Match invoice to accepted goods', detail: 'Use acceptance and receipt records for payment control.', priority: 'Medium' }
    ]
  },
  WORKS: {
    label: 'Works execution',
    summary: 'Handover the site, track progress, measure BOQ items, certify IPCs, and manage defects.',
    deliveryForms: ['Milestone progress', 'Milestone evidence', 'Deliverable', 'Site handover', 'Works progress report', 'BOQ measurement', 'Interim payment certificate'],
    inspectionForms: ['Inspection', 'Acceptance certificate', 'Works defect'],
    financeForms: ['Payment schedule', 'Invoice submission', 'Three-way match', 'Payment review', 'Invoice status', 'Payment approval', 'Payment confirmation', 'Penalty or deduction'],
    deliveryRegisters: ['Mobilization', 'Milestones', 'Deliverables', 'Site handovers', 'Progress reports', 'BOQ measurements', 'Interim payment certificates'],
    inspectionRegisters: ['Inspections', 'Acceptance', 'Defects'],
    financeRegisters: ['Payment schedule', 'Purchase orders', 'Invoices', 'Payments', 'Three-way matches', 'Penalties and deductions', 'Payment approvals', 'Payment confirmations'],
    recommended: [
      { step: 'delivery', title: 'Update works progress', detail: 'Record progress, BOQ measurements, or IPC certification.', priority: 'High' },
      { step: 'inspections', title: 'Track defects', detail: 'Log defects and closure obligations after inspection.', priority: 'Medium' },
      { step: 'payments', title: 'Approve certified payment', detail: 'Connect IPCs to invoices and payment approvals.', priority: 'Medium' }
    ]
  },
  SERVICES: {
    label: 'Services execution',
    summary: 'Define service levels, track periods and reports, verify performance, apply credits, and pay eligible work.',
    deliveryForms: ['Milestone progress', 'Milestone evidence', 'Deliverable', 'Service level', 'Service period', 'Service report'],
    inspectionForms: ['Inspection', 'Acceptance certificate'],
    financeForms: ['Payment schedule', 'Invoice submission', 'Payment review', 'Invoice status', 'Payment approval', 'Payment confirmation', 'Penalty or deduction', 'Service credit'],
    deliveryRegisters: ['Mobilization', 'Milestones', 'Deliverables', 'Service levels', 'Service periods', 'Service reports'],
    inspectionRegisters: ['Inspections', 'Acceptance'],
    financeRegisters: ['Payment schedule', 'Purchase orders', 'Invoices', 'Payments', 'Penalties and deductions', 'Payment approvals', 'Payment confirmations', 'Service credits'],
    recommended: [
      { step: 'delivery', title: 'Submit service report', detail: 'Capture the reporting period and service result.', priority: 'High' },
      { step: 'payments', title: 'Review SLA credits', detail: 'Apply service credits or deductions before payment.', priority: 'Medium' },
      { step: 'inspections', title: 'Verify service period', detail: 'Accept the report before invoice approval.', priority: 'Medium' }
    ]
  },
  CONSULTANCY: {
    label: 'Consultancy execution',
    summary: 'Manage deliverables, versions, reviews, revisions, approvals, and payment eligibility.',
    deliveryForms: ['Milestone progress', 'Milestone evidence', 'Deliverable', 'Consultancy deliverable', 'Consultancy deliverable version'],
    inspectionForms: ['Inspection', 'Acceptance certificate', 'Consultancy review'],
    financeForms: ['Payment schedule', 'Invoice submission', 'Payment review', 'Invoice status', 'Payment approval', 'Payment confirmation', 'Penalty or deduction'],
    deliveryRegisters: ['Mobilization', 'Milestones', 'Deliverables', 'Consultancy deliverables', 'Deliverable versions'],
    inspectionRegisters: ['Inspections', 'Acceptance', 'Deliverable reviews'],
    financeRegisters: ['Payment schedule', 'Purchase orders', 'Invoices', 'Payments', 'Payment approvals', 'Payment confirmations', 'Penalties and deductions'],
    recommended: [
      { step: 'delivery', title: 'Submit deliverable version', detail: 'Upload the next consultancy deliverable version for review.', priority: 'High' },
      { step: 'inspections', title: 'Review submitted version', detail: 'Approve, reject, or request revision from the consultant.', priority: 'High' },
      { step: 'payments', title: 'Invoice approved deliverables', detail: 'Only pay after accepted deliverable records exist.', priority: 'Medium' }
    ]
  },
  GENERAL: {
    label: 'General execution',
    summary: 'Track milestones, evidence, acceptance, risk, finance, and close-out.',
    deliveryForms: ['Milestone progress', 'Milestone evidence', 'Deliverable'],
    inspectionForms: ['Inspection', 'Acceptance certificate'],
    financeForms: ['Payment schedule', 'Invoice submission', 'Three-way match', 'Payment review', 'Invoice status', 'Payment approval', 'Payment confirmation', 'Penalty or deduction'],
    deliveryRegisters: ['Mobilization', 'Milestones', 'Deliverables'],
    inspectionRegisters: ['Inspections', 'Acceptance'],
    financeRegisters: ['Payment schedule', 'Purchase orders', 'Invoices', 'Payments', 'Three-way matches', 'Penalties and deductions', 'Payment approvals', 'Payment confirmations'],
    recommended: [
      { step: 'delivery', title: 'Update milestone evidence', detail: 'Add delivery evidence against the next milestone.', priority: 'High' },
      { step: 'inspections', title: 'Accept completed work', detail: 'Record inspection and acceptance before invoicing.', priority: 'Medium' },
      { step: 'payments', title: 'Process eligible invoice', detail: 'Connect invoice to accepted execution records.', priority: 'Medium' }
    ]
  }
};

function asRecords(items: Array<Record<string, unknown>> | ContractLifecycleItemDto[] | undefined) {
  return (items ?? []) as Array<Record<string, unknown>>;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function payloadText(contract: ContractDetailDto | null | undefined, ...keys: string[]) {
  if (!contract?.payload) return '';
  for (const key of keys) {
    const value = contract.payload[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return '';
}

function contractExecutionType(contract: ContractDetailDto | null | undefined): ContractExecutionType {
  if (!contract) return 'GENERAL';
  const source = [
    payloadText(contract, 'procurementType', 'tenderType', 'contractType', 'category'),
    contract.title,
    contract.tenderReference
  ].join(' ').toUpperCase();
  if (/CONSULT/.test(source) || (contract.consultancyDeliverables?.length ?? 0) > 0 || (contract.deliverableVersions?.length ?? 0) > 0) return 'CONSULTANCY';
  if (/WORK|BOQ|CONSTRUCTION|SITE/.test(source) || (contract.siteHandovers?.length ?? 0) > 0 || (contract.boqMeasurements?.length ?? 0) > 0 || (contract.interimPaymentCertificates?.length ?? 0) > 0) return 'WORKS';
  if (/SERVICE|NON.?CONSULT/.test(source) || (contract.serviceReports?.length ?? 0) > 0 || (contract.serviceLevels?.length ?? 0) > 0) return 'SERVICES';
  if (/GOOD|SUPPL|DELIVER|EQUIPMENT|MATERIAL/.test(source) || (contract.deliverySchedules?.length ?? 0) > 0 || (contract.goodsReceipts?.length ?? 0) > 0 || (contract.goodsInspections?.length ?? 0) > 0) return 'GOODS';
  return 'GENERAL';
}

function shouldShowWorkflowItem(config: { deliveryForms: string[]; inspectionForms: string[]; financeForms: string[]; deliveryRegisters: string[]; inspectionRegisters: string[]; financeRegisters: string[] }, group: 'deliveryForms' | 'inspectionForms' | 'financeForms' | 'deliveryRegisters' | 'inspectionRegisters' | 'financeRegisters', title: string) {
  return config[group].includes(title);
}

function recordCount(contract: ContractDetailDto, key: keyof ContractDetailDto) {
  const value = contract[key];
  return Array.isArray(value) ? value.length : value ? 1 : 0;
}

function executionMetrics(contract: ContractDetailDto, type: ContractExecutionType) {
  if (type === 'GOODS') {
    return [
      { label: 'Schedules', value: recordCount(contract, 'deliverySchedules') },
      { label: 'Dispatches', value: recordCount(contract, 'dispatchNotices') },
      { label: 'Receipts', value: recordCount(contract, 'goodsReceipts') },
      { label: 'Accepted', value: recordCount(contract, 'acceptances') }
    ];
  }
  if (type === 'WORKS') {
    return [
      { label: 'Handovers', value: recordCount(contract, 'siteHandovers') },
      { label: 'Progress reports', value: recordCount(contract, 'worksProgressReports') },
      { label: 'BOQ records', value: recordCount(contract, 'boqMeasurements') },
      { label: 'IPCs', value: recordCount(contract, 'interimPaymentCertificates') }
    ];
  }
  if (type === 'SERVICES') {
    return [
      { label: 'SLAs', value: recordCount(contract, 'serviceLevels') },
      { label: 'Periods', value: recordCount(contract, 'servicePeriods') },
      { label: 'Reports', value: recordCount(contract, 'serviceReports') },
      { label: 'Credits', value: recordCount(contract, 'serviceCredits') }
    ];
  }
  if (type === 'CONSULTANCY') {
    return [
      { label: 'Deliverables', value: recordCount(contract, 'consultancyDeliverables') },
      { label: 'Versions', value: recordCount(contract, 'deliverableVersions') },
      { label: 'Reviews', value: recordCount(contract, 'deliverableReviews') },
      { label: 'Accepted', value: recordCount(contract, 'acceptances') }
    ];
  }
  return [
    { label: 'Milestones', value: contract.milestones.length },
    { label: 'Evidence', value: contract.milestones.reduce((count, milestone) => count + (milestone.evidence?.length ?? 0), 0) },
    { label: 'Acceptance', value: recordCount(contract, 'acceptances') },
    { label: 'Invoices', value: recordCount(contract, 'invoices') }
  ];
}

function workflowRecordTotal(contract: ContractDetailDto, step: PostAwardSectionId, type: ContractExecutionType) {
  const metrics = executionMetrics(contract, type);
  if (step === 'delivery') return metrics.reduce((sum, metric) => sum + metric.value, 0) + contract.milestones.length + (contract.deliverables?.length ?? 0);
  if (step === 'inspections') return (contract.inspections.length ?? 0) + (contract.acceptances?.length ?? 0) + (contract.goodsInspections?.length ?? 0) + (contract.defects?.length ?? 0) + (contract.deliverableReviews?.length ?? 0);
  if (step === 'payments') return (contract.invoices?.length ?? 0) + (contract.payments?.length ?? 0) + (contract.paymentApprovals?.length ?? 0) + (contract.serviceCredits?.length ?? 0);
  if (step === 'changes') return (contract.variations.length ?? 0) + (contract.changeRequests?.length ?? 0) + (contract.claims?.length ?? 0) + (contract.extensionRequests?.length ?? 0) + (contract.amendments?.length ?? 0);
  return 1;
}

function emptyStateForStep(step: PostAwardSectionId, type: ContractExecutionType) {
  const config = executionWorkflowConfig[type];
  if (step === 'delivery') return { title: `Start ${config.label.toLowerCase()}`, detail: 'Add a delivery record.', actionLabel: 'Use first delivery form' };
  if (step === 'inspections') return { title: 'No inspection yet', detail: 'Add an inspection record.', actionLabel: 'Use inspection form' };
  if (step === 'payments') return { title: 'No finance record yet', detail: 'Add a finance record.', actionLabel: 'Use finance form' };
  if (step === 'changes') return { title: 'No change record yet', detail: 'Add a change record.', actionLabel: 'Use changes form' };
  return { title: 'No records yet', detail: 'Add a record.', actionLabel: 'Review forms' };
}

function workGroupForSection(sectionId: PostAwardSectionId) {
  return postAwardWorkGroups.find((group) => group.sectionIds.includes(sectionId)) ?? postAwardWorkGroups[0];
}

function sectionDisplayTitle(section: WorkflowSection<PostAwardSectionId>) {
  if (section.id === 'cmp') return 'Contract management plan (CMP)';
  if (section.id === 'inspections') return 'Inspections and acceptance';
  if (section.id === 'payments') return 'Finance records';
  if (section.id === 'risk') return 'Risks and non-conformance';
  if (section.id === 'changes') return 'Changes, issues, and disputes';
  if (section.id === 'warranty') return 'Documents, securities, and warranty';
  if (section.id === 'registers') return 'Saved history';
  return section.label;
}

function driverLines(value: unknown) {
  const drivers = Array.isArray(value) ? value : [];
  return drivers
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && 'driver' in entry) return String((entry as { driver?: unknown }).driver ?? '');
      return String(entry ?? '');
    })
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n');
}

function dateLabel(value?: string | null) {
  if (!value) return 'Not dated';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function documentOptions(documents: AwardContractDocumentDto[]): PickerOption[] {
  return [
    { value: '', label: 'Upload or choose a document', description: 'Choose evidence' },
    ...documents.map((document) => ({
      value: document.id,
      label: document.name,
      description: `${document.sourceLabel} | ${document.documentType} | ${dateLabel(document.createdAt)}`,
      status: document.sourceLabel
    }))
  ];
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      resolve(value.includes(',') ? value.split(',').pop() ?? '' : value);
    };
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
}

function riskLevel(value: string): LifecycleAction['riskLevel'] {
  if (value === 'Critical' || value === 'High' || value === 'Medium' || value === 'Low') return value;
  return 'Low';
}

function roleContext(value: PostAwardContractRow['viewerRole']): LifecycleAction['roleContext'] {
  return value === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER';
}

function contractChooserRows(rows: PostAwardContractRow[]): LifecycleAction[] {
  return rows.map((row) => {
    const role = roleContext(row.viewerRole);
    const nextRoute = `/post-award/setup?contract=${encodeURIComponent(row.id)}`;
    return {
      id: `post-award-${row.id}`,
      roleContext: role,
      sourceType: 'CONTRACT_ACTIVE',
      tenderId: null,
      awardId: null,
      noticeId: null,
      contractId: row.id,
      reference: row.reference,
      noticeReference: null,
      title: row.title,
      otherParty: role === 'BUYER' ? row.supplierName ?? 'Supplier pending' : row.buyerName,
      currentStage: row.stage,
      requiredAction: row.nextAction,
      dueDate: row.dueDate,
      riskLevel: riskLevel(row.riskLevel),
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      nextRoute,
      nextAction: {
        key: 'post-award',
        label: 'Open tracking',
        url: nextRoute,
        method: 'GET',
        canAct: true,
        disabledReason: null,
        requiredRole: 'ANY',
        requiredEvidence: []
      }
    };
  });
}

function recommendedPostAwardActions(contract: ContractDetailDto, sections: Array<WorkflowSection<PostAwardSectionId>>) {
  const actions: Array<{ step: PostAwardSectionId; title: string; detail: string; priority: string }> = [];
  if (!contract.managementPlan) actions.push({ step: 'cmp', title: 'Create contract management plan', detail: 'Set the plan.', priority: 'High' });
  if (contract.milestones.length === 0) actions.push({ step: 'cmp', title: 'Create first milestone', detail: 'Add delivery tracking.', priority: 'High' });
  if (contract.milestones.length > 0 && (contract.deliverables?.length ?? 0) === 0) actions.push({ step: 'delivery', title: 'Record deliverable', detail: 'Add supplier delivery.', priority: 'Medium' });
  if ((contract.deliverables?.length ?? 0) > 0 && contract.inspections.length === 0 && (contract.goodsInspections?.length ?? 0) === 0) actions.push({ step: 'inspections', title: 'Inspect and accept delivery', detail: 'Record inspection results.', priority: 'Medium' });
  if ((contract.invoices?.length ?? 0) > 0 && (contract.paymentConfirmations?.length ?? 0) === 0) actions.push({ step: 'payments', title: 'Review payment evidence', detail: 'Check payment records.', priority: 'Medium' });
  if (contract.risks.length > 0) actions.push({ step: 'risk', title: 'Update open risk', detail: 'Update risk ownership.', priority: 'Medium' });
  if (contract.status === 'COMPLETED' && !contract.closeout) actions.push({ step: 'closeout', title: 'Prepare close-out', detail: 'Complete close-out records.', priority: 'High' });
  if ((contract.supplierPerformanceRecords.length ?? 0) === 0) actions.push({ step: 'performance', title: 'Score supplier performance', detail: 'Add performance score.', priority: 'Low' });

  if (actions.length === 0) {
    const busiest = [...sections].sort((left, right) => (right.count ?? 0) - (left.count ?? 0))[0];
    return [{ step: (busiest?.id ?? 'registers') as PostAwardSectionId, title: 'Review saved history', detail: 'Review records.', priority: 'Info' }];
  }
  return actions.slice(0, 4);
}

function GuidedExecutionHeader({
  contract,
  executionType,
  activeSection,
  activeWorkGroup,
  nextAction
}: {
  contract: ContractDetailDto;
  executionType: ContractExecutionType;
  activeSection: WorkflowSection<PostAwardSectionId> | undefined;
  activeWorkGroup: typeof postAwardWorkGroups[number];
  nextAction: { title: string; detail: string; priority: string };
}) {
  const config = executionWorkflowConfig[executionType];
  const role = contract.access?.viewerRole ?? 'NONE';
  const roleLabel = role === 'SUPPLIER' ? 'Supplier workspace' : role === 'BUYER' ? 'Buyer workspace' : role === 'ADMIN' ? 'Admin workspace' : 'Read-only workspace';
  return (
    <section className="post-award-compact-header">
      <div className="post-award-compact-title">
        <div>
          <span className="section-kicker">{config.label}</span>
          <h1>{activeSection ? sectionDisplayTitle(activeSection) : 'Post-award workspace'}</h1>
          <p>{contract.title}</p>
        </div>
        <div className="post-award-compact-badges">
          <StatusBadge value={activeWorkGroup.label} />
          <StatusBadge value={contract.status} />
        </div>
      </div>
      <section className="post-award-command-grid" aria-label="Contract execution summary">
        <article>
          <span>Role</span>
          <strong>{roleLabel}</strong>
          <em>{contract.access?.readOnlyReason || 'Actions are filtered to your role.'}</em>
        </article>
        <article>
          <span>Status</span>
          <strong>{contract.status}</strong>
          <em>{contract.reference}</em>
        </article>
        <article>
          <span>Next action</span>
          <strong>{nextAction.title}</strong>
          <em>{nextAction.detail}</em>
        </article>
        <article>
          <span>Health</span>
          <strong>{contract.risks.length > 0 ? 'Watch risks' : contract.status === 'AT_RISK' ? 'At risk' : 'On track'}</strong>
          <em>{contract.risks.length} risk record{contract.risks.length === 1 ? '' : 's'}</em>
        </article>
      </section>
      <section className="post-award-health-grid post-award-compact-metrics" aria-label="Execution metrics">
        {executionMetrics(contract, executionType).map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>
    </section>
  );
}

function GuidedEmptyState({
  title,
  detail,
  actionLabel,
  onAction
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <section className="post-award-guided-empty" aria-label={title}>
      <div>
        <span className="section-kicker">Next step</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {onAction ? <button className="btn btn-primary btn-sm" type="button" onClick={onAction}>{actionLabel}</button> : null}
    </section>
  );
}

function GuidedTaskQueue({
  actions,
  onSelect
}: {
  actions: Array<{ step: PostAwardSectionId; title: string; detail: string; priority: string }>;
  onSelect: (step: PostAwardSectionId) => void;
}) {
  return (
    <section className="post-award-action-queue post-award-guided-queue" aria-label="My work queue">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">My actions</span>
          <h2>My actions</h2>
        </div>
      </div>
      <div className="post-award-action-table" role="table" aria-label="Priority post-award actions">
        {actions.map((action) => (
          <button className="post-award-action-row" type="button" onClick={() => onSelect(action.step)} key={`${action.step}-${action.title}`}>
            <span>{action.priority}</span>
            <strong>{action.title}</strong>
            <b>{sectionSlugByStep[action.step]}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function WorkflowRegisterCard({
  allowed,
  kicker,
  title,
  records,
  countLabel
}: {
  allowed: string[];
  kicker: string;
  title: string;
  records: Array<Record<string, unknown>>;
  countLabel?: string;
}) {
  if (!allowed.includes(title)) return null;
  return <RegisterCard kicker={kicker} title={title} records={records} countLabel={countLabel} />;
}

type WorkflowRegisterGroup = 'deliveryRegisters' | 'inspectionRegisters' | 'financeRegisters';

type PostAwardRegisterConfig = {
  slug: string;
  section: PostAwardSectionId;
  title: string;
  kicker: string;
  description: string;
  workflowGroup?: WorkflowRegisterGroup;
  records: (contract: ContractDetailDto) => Array<Record<string, unknown>>;
};

const postAwardRegisterConfigs: PostAwardRegisterConfig[] = [
  { slug: 'activation-checklist', section: 'cmp', kicker: 'Activation', title: 'Activation checklist', description: 'Activation checklist items, evidence, review, and waiver status.', records: (contract) => asRecords(contract.activationItems) },
  { slug: 'baselines', section: 'cmp', kicker: 'Activation', title: 'Contract baselines', description: 'Original and current baselines used for execution control.', records: (contract) => asRecords(contract.baselines) },
  { slug: 'obligations', section: 'cmp', kicker: 'Obligations', title: 'Contract obligations', description: 'Buyer and supplier obligations linked to milestones and acceptance.', records: (contract) => asRecords(contract.obligations) },
  { slug: 'evidence-requirements', section: 'cmp', kicker: 'Evidence', title: 'Evidence requirements', description: 'Required documents and proof needed before review or payment.', records: (contract) => asRecords(contract.evidenceRequirements) },
  { slug: 'commencement', section: 'cmp', kicker: 'Commencement', title: 'Commencement notices', description: 'Start, effective, and commencement control records.', records: (contract) => asRecords(contract.commencements) },
  { slug: 'mobilization', section: 'delivery', kicker: 'Delivery', title: 'Mobilization', description: 'Mobilization requirements and readiness confirmations.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.mobilizationItems) },
  { slug: 'milestones', section: 'delivery', kicker: 'Delivery', title: 'Milestones', description: 'Milestone dates, amounts, progress, and evidence status.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.milestones as ContractLifecycleItemDto[]) },
  { slug: 'deliverables', section: 'delivery', kicker: 'Delivery', title: 'Deliverables', description: 'Supplier deliverables submitted for review or acceptance.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.deliverables as ContractLifecycleItemDto[] | undefined) },
  { slug: 'schedules', section: 'delivery', kicker: 'Goods', title: 'Delivery schedules', description: 'Goods delivery schedule and planned quantities.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.deliverySchedules) },
  { slug: 'dispatch', section: 'delivery', kicker: 'Goods', title: 'Dispatch notices', description: 'Supplier dispatch notices and shipment details.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.dispatchNotices) },
  { slug: 'receipts', section: 'delivery', kicker: 'Goods', title: 'Goods receipts', description: 'Buyer goods receipt and reconciliation records.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.goodsReceipts) },
  { slug: 'site-handovers', section: 'delivery', kicker: 'Works', title: 'Site handovers', description: 'Works site handover and access records.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.siteHandovers) },
  { slug: 'progress-reports', section: 'delivery', kicker: 'Works', title: 'Progress reports', description: 'Works progress reporting and site updates.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.worksProgressReports) },
  { slug: 'boq-measurements', section: 'delivery', kicker: 'Works', title: 'BOQ measurements', description: 'Measured BOQ quantities and valuation records.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.boqMeasurements) },
  { slug: 'interim-payment-certificates', section: 'delivery', kicker: 'Works', title: 'Interim payment certificates', description: 'IPC certification records for works payments.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.interimPaymentCertificates) },
  { slug: 'service-levels', section: 'delivery', kicker: 'Services', title: 'Service levels', description: 'SLA requirements and target service levels.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.serviceLevels) },
  { slug: 'service-periods', section: 'delivery', kicker: 'Services', title: 'Service periods', description: 'Service periods and reporting windows.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.servicePeriods) },
  { slug: 'service-reports', section: 'delivery', kicker: 'Services', title: 'Service reports', description: 'Submitted service reports and verification status.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.serviceReports) },
  { slug: 'consultancy-deliverables', section: 'delivery', kicker: 'Consultancy', title: 'Consultancy deliverables', description: 'Consultancy deliverables and expected outputs.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.consultancyDeliverables) },
  { slug: 'deliverable-versions', section: 'delivery', kicker: 'Consultancy', title: 'Deliverable versions', description: 'Submitted versions, revisions, and approval state.', workflowGroup: 'deliveryRegisters', records: (contract) => asRecords(contract.deliverableVersions) },
  { slug: 'inspections', section: 'inspections', kicker: 'Inspections', title: 'Inspections', description: 'Inspection records and inspection decisions.', workflowGroup: 'inspectionRegisters', records: (contract) => asRecords(contract.inspections) },
  { slug: 'goods-inspections', section: 'inspections', kicker: 'Inspections', title: 'Goods inspections', description: 'Goods inspection details, defects, and decisions.', workflowGroup: 'inspectionRegisters', records: (contract) => asRecords(contract.goodsInspections) },
  { slug: 'acceptance', section: 'inspections', kicker: 'Inspections', title: 'Acceptance', description: 'Acceptance certificates and payment eligibility.', workflowGroup: 'inspectionRegisters', records: (contract) => asRecords(contract.acceptances as ContractLifecycleItemDto[] | undefined) },
  { slug: 'defects', section: 'inspections', kicker: 'Works', title: 'Defects', description: 'Works defect records and rectification tracking.', workflowGroup: 'inspectionRegisters', records: (contract) => asRecords(contract.defects) },
  { slug: 'deliverable-reviews', section: 'inspections', kicker: 'Consultancy', title: 'Deliverable reviews', description: 'Consultancy review comments, revision, and approval history.', workflowGroup: 'inspectionRegisters', records: (contract) => asRecords(contract.deliverableReviews) },
  { slug: 'payment-schedule', section: 'payments', kicker: 'Payments', title: 'Payment schedule', description: 'Planned payments, retention, and schedule status.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.paymentSchedules as ContractLifecycleItemDto[] | undefined) },
  { slug: 'purchase-orders', section: 'payments', kicker: 'Payments', title: 'Purchase orders', description: 'Purchase order references and committed amounts.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.purchaseOrders) },
  { slug: 'invoices', section: 'payments', kicker: 'Payments', title: 'Invoices', description: 'Supplier invoices and review status.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.invoices) },
  { slug: 'payments', section: 'payments', kicker: 'Payments', title: 'Payments', description: 'Payment records and disbursement confirmation.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.payments) },
  { slug: 'three-way-matches', section: 'payments', kicker: 'Payments', title: 'Three-way matches', description: 'Invoice, acceptance, and payment matching records.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.threeWayMatches) },
  { slug: 'penalties', section: 'payments', kicker: 'Payments', title: 'Penalties and deductions', description: 'Deductions, penalties, retention, and recoveries.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.penalties) },
  { slug: 'payment-approvals', section: 'payments', kicker: 'Payments', title: 'Payment approvals', description: 'Payment approval workflow and decisions.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.paymentApprovals) },
  { slug: 'payment-confirmations', section: 'payments', kicker: 'Payments', title: 'Payment confirmations', description: 'Supplier receipt and buyer payment confirmation.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.paymentConfirmations) },
  { slug: 'service-credits', section: 'payments', kicker: 'Payments', title: 'Service credits', description: 'SLA credits and service deductions.', workflowGroup: 'financeRegisters', records: (contract) => asRecords(contract.serviceCredits) },
  { slug: 'risks', section: 'risk', kicker: 'Risk', title: 'Risks', description: 'Risk records, ownership, mitigation, and status.', records: (contract) => asRecords(contract.risks as ContractLifecycleItemDto[]) },
  { slug: 'risk-forecasts', section: 'risk', kicker: 'Risk', title: 'Risk forecasts', description: 'Forecasted risk trends and drivers.', records: (contract) => asRecords(contract.riskForecasts) },
  { slug: 'non-conformance', section: 'risk', kicker: 'Risk', title: 'Non-conformance', description: 'Non-conformance and corrective action records.', records: (contract) => asRecords(contract.nonConformances) },
  { slug: 'variations', section: 'changes', kicker: 'Changes', title: 'Variations', description: 'Variation records and commercial impact.', records: (contract) => asRecords(contract.variations as ContractLifecycleItemDto[]) },
  { slug: 'change-requests', section: 'changes', kicker: 'Changes', title: 'Change requests and amendments', description: 'Change request records before amendment completion.', records: (contract) => asRecords(contract.changeRequests) },
  { slug: 'extension-requests', section: 'changes', kicker: 'Changes', title: 'Extension requests', description: 'Time extension requests and decisions.', records: (contract) => asRecords(contract.extensionRequests) },
  { slug: 'amendments', section: 'changes', kicker: 'Changes', title: 'Amendments', description: 'Signed or pending contract amendment records.', records: (contract) => asRecords(contract.amendments) },
  { slug: 'claims', section: 'changes', kicker: 'Claims', title: 'Claims', description: 'Supplier or buyer claims and claim status.', records: (contract) => asRecords(contract.claims) },
  { slug: 'claim-responses', section: 'changes', kicker: 'Claims', title: 'Claim responses', description: 'Formal responses to submitted claims.', records: (contract) => asRecords(contract.claimResponses) },
  { slug: 'issues', section: 'changes', kicker: 'Changes', title: 'Issues', description: 'Execution issues and resolution status.', records: (contract) => asRecords(contract.issues) },
  { slug: 'disputes', section: 'changes', kicker: 'Changes', title: 'Disputes', description: 'Disputes, escalation, and settlement records.', records: (contract) => asRecords(contract.disputes) },
  { slug: 'termination', section: 'termination', kicker: 'Termination', title: 'Termination', description: 'Termination notices, cure periods, and close decisions.', records: (contract) => asRecords(contract.terminations as ContractLifecycleItemDto[]) },
  { slug: 'securities', section: 'warranty', kicker: 'Securities', title: 'Securities and guarantees', description: 'Performance securities, guarantees, and expiry tracking.', records: (contract) => asRecords(contract.securities) },
  { slug: 'warranty', section: 'warranty', kicker: 'Warranty', title: 'Warranty and defects', description: 'Warranty obligations and defect liability records.', records: (contract) => asRecords(contract.warranties as ContractLifecycleItemDto[] | undefined) },
  { slug: 'required-documents', section: 'warranty', kicker: 'Warranty', title: 'Required documents', description: 'Required document submissions and status.', records: (contract) => asRecords(contract.requiredDocuments) },
  { slug: 'reference-samples', section: 'warranty', kicker: 'Samples', title: 'Reference samples', description: 'Reference sample submissions and inspections.', records: (contract) => asRecords(contract.referenceSamples) },
  { slug: 'closeout', section: 'closeout', kicker: 'Close-out', title: 'Close-out', description: 'Completion certificate, final account, warranty, and lessons learned.', records: (contract) => contract.closeout ? [contract.closeout as Record<string, unknown>] : [] },
  { slug: 'audit-events', section: 'closeout', kicker: 'Audit', title: 'Audit events', description: 'Audit events linked to this contract.', records: (contract) => asRecords(contract.audit) },
  { slug: 'supplier-performance', section: 'performance', kicker: 'Performance', title: 'Supplier performance', description: 'Supplier performance records and assessment notes.', records: (contract) => asRecords(contract.supplierPerformanceRecords) },
  { slug: 'performance-scores', section: 'performance', kicker: 'Performance', title: 'Performance scores', description: 'Performance scorecards and scoring decisions.', records: (contract) => asRecords(contract.performanceScores) },
  { slug: 'supplier-risk-profile', section: 'performance', kicker: 'Risk', title: 'Supplier risk profile', description: 'Supplier risk profile and trust indicators.', records: (contract) => contract.supplierRiskProfile ? [contract.supplierRiskProfile as Record<string, unknown>] : [] }
];

function registerRecordKey(record: Record<string, unknown>, index: number) {
  return textValue(record.id || record.reference || record.noticeReference || record.invoiceNo || record.paymentNo || `row-${index + 1}`);
}

function recordField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return '';
}

function recordTitle(record: Record<string, unknown>, fallback = 'Record') {
  return recordField(record, 'title', 'name', 'subject', 'reference', 'noticeReference', 'invoiceNo', 'paymentNo', 'certificateNo', 'inspectionNo') || fallback;
}

function recordDetail(record: Record<string, unknown>) {
  return recordField(record, 'note', 'summary', 'description', 'detail', 'reason', 'decisionReason', 'amount', 'paidAmount', 'score', 'probability') || '-';
}

function visibleRegisterConfigs(contract: ContractDetailDto, step: PostAwardSectionId, workflowConfig: (typeof executionWorkflowConfig)[ContractExecutionType], routeSectionSlug = '') {
  const hiddenForSupplier = new Set(['risk-forecasts', 'supplier-risk-profile', 'audit-events']);
  const viewerRole = contract.access?.viewerRole;
  const byStep = step === 'registers'
    ? postAwardRegisterConfigs
    : postAwardRegisterConfigs.filter((config) => config.section === step);
  const byRoute = routeSectionSlug === 'claims'
    ? byStep.filter((config) => ['claims', 'claim-responses'].includes(config.slug))
    : byStep;
  return byRoute.filter((config) => viewerRole !== 'SUPPLIER' || !hiddenForSupplier.has(config.slug)).filter((config) => {
    if (!config.workflowGroup) return true;
    return shouldShowWorkflowItem(workflowConfig, config.workflowGroup, config.title);
  }).map((config) => ({ ...config, count: config.records(contract).length }));
}

function findRegisterConfig(slug: string, configs: Array<PostAwardRegisterConfig & { count?: number }>) {
  return configs.find((config) => config.slug === slug) ?? null;
}

function PostAwardPageNav({
  sections,
  activeGroup,
  routeSectionSlug,
  search,
  onOpen
}: {
  sections: Array<WorkflowSection<PostAwardSectionId>>;
  activeGroup: PostAwardSectionId;
  routeSectionSlug: string;
  search: string;
  onOpen: (path: string) => void;
}) {
  const countFor = (id: PostAwardSectionId) => sections.find((section) => section.id === id)?.count ?? 0;
  const navItems: Array<{ label: string; step: PostAwardSectionId; slug?: string; count: number }> = [
    { label: 'Setup', step: 'cmp', count: countFor('cmp') },
    { label: 'Delivery', step: 'delivery', count: countFor('delivery') },
    { label: 'Inspections', step: 'inspections', count: countFor('inspections') },
    { label: 'Finance', step: 'payments', count: countFor('payments') },
    { label: 'Risk', step: 'risk', count: countFor('risk') },
    { label: 'Changes', step: 'changes', count: countFor('changes') },
    { label: 'Claims', step: 'changes', slug: 'claims', count: countFor('changes') },
    { label: 'Termination', step: 'termination', count: countFor('termination') },
    { label: 'Documents', step: 'warranty', count: countFor('warranty') },
    { label: 'Close-out', step: 'closeout', count: countFor('closeout') },
    { label: 'Performance', step: 'performance', count: countFor('performance') },
    { label: 'History', step: 'registers', count: countFor('registers') }
  ];
  return (
    <nav className="post-award-page-nav" aria-label="Post-award pages">
      {navItems.map((item) => {
        const slug = item.slug ?? sectionSlugByStep[item.step];
        const active = routeSectionSlug === slug || (!item.slug && activeGroup === item.step && routeSectionSlug !== 'claims');
        return (
          <button
            className={active ? 'active' : ''}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onOpen(`/post-award/${slug}${postAwardSearch(search)}`)}
            key={`${item.step}-${slug}`}
          >
            <span>{item.label}</span>
            <em>{item.count}</em>
          </button>
        );
      })}
    </nav>
  );
}

function PostAwardRegisterOverview({
  configs,
  search,
  onOpen
}: {
  configs: Array<PostAwardRegisterConfig & { count?: number }>;
  search: string;
  onOpen: (path: string) => void;
}) {
  return (
    <section className="post-award-register-overview" aria-label="Section registers">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Tables</span>
          <h2>Tables</h2>
        </div>
      </div>
      <SimpleTable headers={['Table', 'Records', 'Action']} className="post-award-full-table">
        {configs.length === 0 ? (
          <tr><td colSpan={3}><div className="scope-empty">No tables available.</div></td></tr>
        ) : configs.map((config) => (
          <tr key={config.slug}>
            <td>
              <div className="award-record-title">
                <strong>{config.title}</strong>
                <span>{config.kicker}</span>
              </div>
            </td>
            <td><StatusBadge value={`${config.count ?? 0} records`} /></td>
            <td>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(postAwardDeepPath(config.section, config.slug, search))}>
                Open table
              </button>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </section>
  );
}

function PostAwardRegisterDataTable({
  config,
  contract,
  search,
  onOpen,
  onBack
}: {
  config: PostAwardRegisterConfig & { count?: number };
  contract: ContractDetailDto;
  search: string;
  onOpen: (path: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const records = config.records(contract);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(normalized));
  }, [query, records]);
  return (
    <section className="procurement-panel evaluation-panel post-award-panel post-award-deep-page">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{config.kicker}</span>
          <h2>{config.title}</h2>
        </div>
        <StatusBadge value={`${records.length} records`} />
      </div>
      <div className="post-award-table-toolbar">
        <label>
          Search
          <input
            className="form-input"
            type="search"
            placeholder="Search records"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="inline-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onBack}>Back to section</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onBack}>Add or update records</button>
        </div>
      </div>
      <SimpleTable headers={['Record', 'Status', 'Owner / role', 'Date', 'Detail', 'Action']} className="post-award-full-table post-award-register-table">
        {records.length === 0 ? (
          <tr><td colSpan={6}><div className="scope-empty">No records yet.</div></td></tr>
        ) : filtered.length === 0 ? (
          <tr><td colSpan={6}><div className="scope-empty">No matching records.</div></td></tr>
        ) : filtered.map((record, index) => {
          const key = registerRecordKey(record, index);
          return (
            <tr key={key}>
              <td>
                <div className="award-record-title">
                  <strong>{recordTitle(record, `${config.title} record`)}</strong>
                  <span>{recordField(record, 'reference', 'noticeReference', 'invoiceNo', 'paymentNo', 'id') || key}</span>
                </div>
              </td>
              <td><StatusBadge value={recordField(record, 'status', 'riskLevel', 'decision', 'Recorded') || 'Recorded'} /></td>
              <td>{recordField(record, 'ownerRole', 'owner', 'ownerName', 'submittedBy', 'createdByUserId') || '-'}</td>
              <td>{dateLabel(recordField(record, 'dueDate', 'createdAt', 'updatedAt'))}</td>
              <td>{recordDetail(record)}</td>
              <td>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(postAwardDeepPath(config.section, config.slug, search, key))}>
                  View
                </button>
              </td>
            </tr>
          );
        })}
      </SimpleTable>
    </section>
  );
}

function PostAwardRecordDetailPage({
  config,
  contract,
  recordId,
  onBack
}: {
  config: PostAwardRegisterConfig & { count?: number };
  contract: ContractDetailDto;
  recordId: string;
  onBack: () => void;
}) {
  const records = config.records(contract);
  const found = records.find((record, index) => registerRecordKey(record, index) === recordId);
  const visibleEntries = found
    ? Object.entries(found).filter(([key, value]) => value !== null && value !== undefined && key !== 'payload' && key !== 'metadata')
    : [];
  return (
    <section className="procurement-panel evaluation-panel post-award-panel post-award-record-page">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{config.title}</span>
          <h2>{found ? recordTitle(found, 'Record detail') : 'Record not found'}</h2>
        </div>
        <div className="inline-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onBack}>Back to table</button>
        </div>
      </div>
      {!found ? (
        <div className="scope-empty">This record could not be found in the current contract workspace.</div>
      ) : (
        <>
          <section className="post-award-record-summary">
            <article><span>Status</span><strong>{recordField(found, 'status', 'riskLevel', 'decision', 'Recorded') || 'Recorded'}</strong></article>
            <article><span>Owner</span><strong>{recordField(found, 'ownerRole', 'owner', 'ownerName', 'submittedBy') || 'Not recorded'}</strong></article>
            <article><span>Date</span><strong>{dateLabel(recordField(found, 'dueDate', 'createdAt', 'updatedAt'))}</strong></article>
            <article><span>Detail</span><strong>{recordDetail(found)}</strong></article>
          </section>
          <SimpleTable headers={['Field', 'Value']} className="post-award-full-table">
            {visibleEntries.map(([key, value]) => (
              <tr key={key}>
                <td><strong>{key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ')}</strong></td>
                <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
              </tr>
            ))}
          </SimpleTable>
          {'payload' in found || 'metadata' in found ? (
            <details className="post-award-record-advanced">
              <summary>Advanced system data</summary>
              <pre>{JSON.stringify({ payload: found.payload, metadata: found.metadata }, null, 2)}</pre>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function PostAwardContractChooser({
  rows,
  isLoading,
  error,
  onRetry,
  onOpen,
  onBack
}: {
  rows: LifecycleAction[];
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  onOpen: (row: LifecycleAction, step?: PostAwardSectionId) => void;
  onBack: () => void;
}) {
  return (
    <section className="procurement-panel evaluation-panel post-award-panel post-award-contract-chooser">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Post-award dashboard</span>
          <h2>Choose a contract</h2>
        </div>
        <StatusBadge value={rows.length ? `${rows.length} contracts` : 'No contract selected'} />
      </div>
      {isLoading ? (
        <div className="scope-empty">Loading contracts...</div>
      ) : error ? (
        <div className="scope-empty">
          <p>{error}</p>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onRetry}>Retry</button>
        </div>
      ) : rows.length ? (
        <div className="data-table evaluation-table-scroll awarding-contracts-table">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Role</th>
                <th>Other party</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Due / stage</th>
                <th>Quick pages</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <span>{row.reference ?? row.contractId}</span>
                  </td>
                  <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} tone="info" /></td>
                  <td>{row.otherParty}</td>
                  <td><StatusBadge value={row.status} /></td>
                  <td><StatusBadge value={row.riskLevel || 'Normal'} /></td>
                  <td>{row.dueDate ? dateLabel(row.dueDate) : row.currentStage}</td>
                  <td>
                    <div className="inline-actions post-award-dashboard-actions">
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => onOpen(row, 'cmp')}>Setup</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(row, 'delivery')}>Delivery</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(row, 'payments')}>Finance</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty award-card-empty">
          <p>No contracts ready yet. Finish award, contract, and signing first.</p>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onBack}>Back to Awards and Contracts</button>
        </div>
      )}
    </section>
  );
}

export function PostAwardTrackingProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { section } = useParams();
  const route = useMemo(() => postAwardRouteFromPath(location.pathname), [location.pathname]);
  const routeSection = section ?? route.sectionSlug ?? postAwardSectionFromPath(location.pathname);
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [contractDocuments, setContractDocuments] = useState<AwardContractDocumentDto[]>([]);
  const [postAwardContracts, setPostAwardContracts] = useState<PostAwardContractRow[]>([]);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activeGroup = useMemo(() => activeStepFromLocation(routeSection, location.search), [location.search, routeSection]);

  useEffect(() => {
    const target = legacyPostAwardTarget(routeSection, location.search);
    if (target) navigate(target, { replace: true });
  }, [location.search, navigate, routeSection]);

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setContractDocuments([]);
      setLoadError('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const [nextContract, nextDocuments] = await Promise.all([
        awardsContractsApi.contract(contractId),
        awardsContractsApi.contractDocuments(contractId)
      ]);
      setContract(nextContract);
      setContractDocuments(nextDocuments);
    } catch (error) {
      setContract(null);
      setContractDocuments([]);
      setLoadError(apiErrorMessage(error, 'Post-award contract detail could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  const loadDashboard = useCallback(async () => {
    if (contractId) return;
    setIsDashboardLoading(true);
    setDashboardError('');
    try {
      setPostAwardContracts(await postAwardApi.contracts());
    } catch (error) {
      setPostAwardContracts([]);
      setDashboardError(apiErrorMessage(error, 'Active and closed contracts could not be loaded.'));
    } finally {
      setIsDashboardLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  useEffect(() => {
    if (!contractId) void loadDashboard();
  }, [contractId, loadDashboard]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  function selectFlowStep(step: PostAwardGroupId) {
    navigate({ pathname: postAwardPagePath(step), search: postAwardSearch(location.search) });
  }

  function openContractTracking(row: LifecycleAction, step: PostAwardSectionId = 'cmp') {
    if (!row.contractId) return;
    navigate(`${postAwardPagePath(step)}?contract=${encodeURIComponent(row.contractId)}`);
  }

  function refreshContractAndAdvance(step: PostAwardGroupId) {
    return (result: unknown) => {
      refreshContract(result);
      selectFlowStep(step);
    };
  }

  async function uploadEvidenceDocument(file: File): Promise<PickerOption> {
    if (!contract) throw new Error('Choose a contract before uploading evidence.');
    const payload: AwardContractDocumentUploadInput = {
      name: file.name,
      documentType: file.type || 'POST_AWARD_EVIDENCE',
      mimeType: file.type || undefined,
      size: file.size,
      contentBase64: await fileToBase64(file)
    };
    const uploaded = await awardsContractsApi.uploadContractDocument(contract.id, payload);
    setContractDocuments((current) => [uploaded, ...current.filter((document) => document.id !== uploaded.id)]);
    return {
      value: uploaded.id,
      label: uploaded.name,
      description: `${uploaded.sourceLabel} | ${uploaded.documentType} | ${dateLabel(uploaded.createdAt)}`,
      status: uploaded.sourceLabel
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const isSupplierViewer = contract?.access?.viewerRole === 'SUPPLIER';
  const invoices = contract?.invoices ?? [];
  const payments = contract?.payments ?? [];
  const purchaseOrders = contract?.purchaseOrders ?? [];
  const invoiceOptions = recordPickerOptions(invoices, 'Select invoice');
  const paymentOptions = recordPickerOptions(payments, 'Select payment');
  const purchaseOrderOptions = recordPickerOptions(purchaseOrders, 'No linked purchase order');
  const executionReferenceOptions = [
    option('', 'Select accepted execution record'),
    ...recordPickerOptions(contract?.acceptances ?? [], 'Accepted certificates').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | acceptance`.trim(), status: 'acceptance' })),
    ...recordPickerOptions(contract?.goodsReceipts ?? [], 'Goods receipts').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | goods_receipt`.trim(), status: 'goods_receipt' })),
    ...recordPickerOptions(contract?.goodsInspections ?? [], 'Goods inspections').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | goods_inspection`.trim(), status: 'goods_inspection' })),
    ...recordPickerOptions(contract?.interimPaymentCertificates ?? [], 'Interim payment certificates').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | interim_payment_certificate`.trim(), status: 'interim_payment_certificate' })),
    ...recordPickerOptions(contract?.serviceReports ?? [], 'Service reports').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | service_report`.trim(), status: 'service_report' })),
    ...recordPickerOptions(contract?.consultancyDeliverables ?? [], 'Consultancy deliverables').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | consultancy_deliverable`.trim(), status: 'consultancy_deliverable' })),
    ...recordPickerOptions(contract?.deliverableVersions ?? [], 'Deliverable versions').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | deliverable_version`.trim(), status: 'deliverable_version' })),
    ...itemOptions((contract?.milestones as ContractLifecycleItemDto[] | undefined) ?? [], 'Milestones').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | milestone`.trim(), status: 'milestone' })),
    ...itemOptions((contract?.deliverables as ContractLifecycleItemDto[] | undefined) ?? [], 'Deliverables').slice(1).map((item) => ({ ...item, description: `${item.description ?? ''} | deliverable`.trim(), status: 'deliverable' }))
  ];
  const evidenceDocumentOptions = documentOptions(contractDocuments);
  const contractManagerOptions = [
    option('', contract?.managementPlan?.contractManagerId ? 'Keep current manager' : 'Assign later from user administration'),
    ...(contract?.managementPlan?.contractManagerId ? [option(contract.managementPlan.contractManagerId, 'Current contract manager')] : [])
  ];
  const userOwnerOptions = [option('', 'Use logged-in owner / assign later')];
  const supplierOrgOptions = [
    option('', 'Use selected contract supplier'),
    ...(contract?.supplierOrgId ? [option(contract.supplierOrgId, contract.supplierName ?? 'Selected contract supplier')] : [])
  ];
  const tenderOptions = [
    option('', 'Use tender from selected contract'),
    ...(contract?.tenderId ? [option(contract.tenderId, contract.tenderReference ?? 'Selected contract tender')] : [])
  ];
  const workflowRoleOptions = [option('Buyer'), option('Supplier'), option('Contract Manager'), option('Inspector'), option('Finance'), option('Legal'), option('Technical')];
  const documentOwnerOptions = [option('Supplier Representative'), option('Buyer Representative'), option('Contract Manager'), option('Inspector'), option('Finance')];
  const sections: Array<WorkflowSection<PostAwardSectionId>> = [
    { id: 'cmp', label: 'Contract management plan (CMP)', description: 'Plan and status.', count: (contract?.managementPlan ? 1 : 0) + (contract?.commencements?.length ?? 0) + (contract?.activationItems?.length ?? 0) + (contract?.baselines?.length ?? 0) + (contract?.obligations?.length ?? 0) + (contract?.evidenceRequirements?.length ?? 0) },
    { id: 'delivery', label: 'Delivery', description: 'Milestones and deliverables.', count: (contract?.mobilizationItems.length ?? 0) + (contract?.milestones.length ?? 0) + (contract?.deliverables?.length ?? 0) + (contract?.deliverySchedules?.length ?? 0) + (contract?.dispatchNotices?.length ?? 0) + (contract?.goodsReceipts?.length ?? 0) + (contract?.siteHandovers?.length ?? 0) + (contract?.worksProgressReports?.length ?? 0) + (contract?.boqMeasurements?.length ?? 0) + (contract?.interimPaymentCertificates?.length ?? 0) + (contract?.serviceReports?.length ?? 0) + (contract?.consultancyDeliverables?.length ?? 0) + (contract?.deliverableVersions?.length ?? 0) },
    { id: 'inspections', label: 'Inspections and acceptance', description: 'Inspections and acceptance.', count: (contract?.inspections.length ?? 0) + (contract?.goodsInspections?.length ?? 0) + (contract?.acceptances?.length ?? 0) + (contract?.defects?.length ?? 0) + (contract?.deliverableReviews?.length ?? 0) },
    { id: 'payments', label: 'Finance records', description: 'Invoices and payments.', count: invoices.length + payments.length + (contract?.paymentApprovals?.length ?? 0) + (contract?.penalties?.length ?? 0) + (contract?.serviceCredits?.length ?? 0) },
    { id: 'risk', label: 'Risks and non-conformance', description: 'Risks and non-conformance.', count: (contract?.risks.length ?? 0) + (isSupplierViewer ? 0 : (contract?.riskForecasts?.length ?? 0)) + (contract?.nonConformances?.length ?? 0) },
    { id: 'changes', label: 'Changes, issues, and disputes', description: 'Changes and disputes.', count: (contract?.variations.length ?? 0) + (contract?.changeRequests?.length ?? 0) + (contract?.extensionRequests?.length ?? 0) + (contract?.amendments?.length ?? 0) + (contract?.claims?.length ?? 0) + (contract?.claimResponses?.length ?? 0) + (contract?.issues.length ?? 0) + (contract?.disputes.length ?? 0) },
    { id: 'termination', label: 'Termination', description: 'Termination records.', count: contract?.terminations.length ?? 0 },
    { id: 'warranty', label: 'Documents, securities, and warranty', description: 'Documents and warranty.', count: (contract?.securities?.length ?? 0) + (contract?.warranties?.length ?? 0) + (contract?.requiredDocuments?.length ?? 0) + (contract?.referenceSamples?.length ?? 0) },
    { id: 'closeout', label: 'Close-out', description: 'Close-out records.', count: contract?.closeout ? 1 : 0 },
    { id: 'performance', label: 'Supplier performance', description: 'Scores and risk profile.', count: (contract?.supplierPerformanceRecords.length ?? 0) + (contract?.performanceScores?.length ?? 0) },
    { id: 'registers', label: 'Saved history', description: 'Saved records.', count: contract ? 1 : 0 }
  ];
  const formationLocked = Boolean(contract && ['DRAFT', 'NEGOTIATION', 'SIGNATURE_PENDING'].includes(contract.status));
  const activeFlowLock = useMemo(() => {
    const noContract = { message: 'Select a signed or active contract first.', actionLabel: 'Back to Post Award', navigatePage: 'post-award-tracking', routeSearch: '' };
    const notReady = { message: 'Sign the contract before recording execution work.', actionLabel: 'Open contract signing', navigatePage: 'contract-signing', routeSearch: `contract=${contractId}` };
    if (!contract) return noContract;
    if (formationLocked && !['cmp', 'registers'].includes(activeGroup)) return notReady;
    return null;
  }, [activeGroup, contract, contractId, formationLocked]);
  const activeSection = sections.find((section) => section.id === activeGroup);
  const activeWorkGroup = workGroupForSection(activeGroup);
  const chooserRows = contractChooserRows(postAwardContracts);
  const executionType = contractExecutionType(contract);
  const workflowConfig = executionWorkflowConfig[executionType];
  const recommendedActions = contract ? [...recommendedPostAwardActions(contract, sections), ...workflowConfig.recommended].slice(0, 5) : [];
  const primaryRecommendedAction = recommendedActions[0] ?? workflowConfig.recommended[0] ?? { title: 'Review saved history', detail: 'Open the register and inspect contract activity.', priority: 'Info', step: 'registers' as PostAwardSectionId };
  const showDeliveryForm = (title: string) => shouldShowWorkflowItem(workflowConfig, 'deliveryForms', title);
  const showInspectionForm = (title: string) => shouldShowWorkflowItem(workflowConfig, 'inspectionForms', title);
  const showFinanceForm = (title: string) => shouldShowWorkflowItem(workflowConfig, 'financeForms', title);
  const activeRecordTotal = contract ? workflowRecordTotal(contract, activeGroup, executionType) : 0;
  const activeEmptyState = emptyStateForStep(activeGroup, executionType);
  const activeRegisterConfigs = contract ? visibleRegisterConfigs(contract, activeGroup, workflowConfig, route.sectionSlug) : [];
  const activeRegisterConfig = route.registerSlug ? findRegisterConfig(route.registerSlug, activeRegisterConfigs) : null;
  const isDeepRegisterPage = Boolean(activeRegisterConfig && route.registerSlug && !route.recordId);
  const isRecordPage = Boolean(activeRegisterConfig && route.recordId);
  const openPostAwardPath = (path: string) => navigate(path);
  const backToSection = () => navigate({ pathname: postAwardPagePath(activeGroup), search: postAwardSearch(location.search) });
  const backToRegister = () => {
    if (!activeRegisterConfig) return backToSection();
    navigate(postAwardDeepPath(activeRegisterConfig.section, activeRegisterConfig.slug, location.search));
  };

  return (
    <ProcurexAwardFrame pageKey="post-award-tracking">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content post-award-workspace">
          {!contractId ? (
            <AwardHero
              kicker="Contracts"
              title="Post-award"
              copy="Manage active contracts."
              stats={[
                { value: postAwardContracts.length, label: 'Eligible contracts' },
                { value: postAwardContracts.filter((row) => row.viewerRole === 'BUYER').length, label: 'Buyer workspaces' },
                { value: postAwardContracts.filter((row) => row.viewerRole === 'SUPPLIER').length, label: 'Supplier workspaces' }
              ]}
            />
          ) : null}

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading post-award workspace"
              message="Loading contract records."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Post-award workspace could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadContract()}
            />
          ) : null}

          {!isLoading && !loadError && !contract ? (
            <PostAwardContractChooser
              rows={chooserRows}
              isLoading={isDashboardLoading}
              error={dashboardError}
              onRetry={() => void loadDashboard()}
              onOpen={openContractTracking}
              onBack={() => navigate('/post-award')}
            />
          ) : !isLoading && !loadError && contract ? (
            <AwardContractAccessProvider access={contract.access ? { ...contract.access, hideLockedActions: false } : undefined}>
          <GuidedExecutionHeader
            contract={contract}
            executionType={executionType}
            activeSection={activeSection}
            activeWorkGroup={activeWorkGroup}
            nextAction={primaryRecommendedAction}
          />
          <PostAwardPageNav
            sections={sections}
            activeGroup={activeGroup}
            routeSectionSlug={route.sectionSlug}
            search={location.search}
            onOpen={openPostAwardPath}
          />
          {!isDeepRegisterPage && !isRecordPage ? <GuidedTaskQueue actions={recommendedActions} onSelect={selectFlowStep} /> : null}
          {activeFlowLock ? (
            <LockedFlowStepPanel title={`${activeSection ? sectionDisplayTitle(activeSection) : 'Work area'} is locked`} reason={activeFlowLock} />
          ) : null}
          {!activeFlowLock ? (
          isRecordPage && activeRegisterConfig ? (
            <PostAwardRecordDetailPage
              config={activeRegisterConfig}
              contract={contract}
              recordId={decodeURIComponent(route.recordId)}
              onBack={backToRegister}
            />
          ) : isDeepRegisterPage && activeRegisterConfig ? (
            <PostAwardRegisterDataTable
              config={activeRegisterConfig}
              contract={contract}
              search={location.search}
              onOpen={openPostAwardPath}
              onBack={backToSection}
            />
          ) : (
          <div className="post-award-grouped" data-post-award-active-group={activeGroup}>
          {activeGroup === 'cmp' ? (
          <section className="procurement-panel evaluation-panel post-award-panel post-award-forms-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Contract management plan (CMP)</span><h2>Objectives and monitoring</h2></div>
              <StatusBadge value={contract.managementPlan ? 'Created' : 'Required'} />
            </div>
            <section className="contract-overview-grid">
              <article><span>Status</span><strong>{contract.status}</strong></article>
              <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
              <article><span>Supplier</span><strong>{contract.supplierName ?? 'Supplier pending'}</strong></article>
              <article><span>Reference</span><strong>{contract.reference}</strong></article>
            </section>
            <div className="award-control-grid">
              <ActionFormPanel
                title="Contract management plan (CMP)"
                badge="CMP"
                submitLabel="Save plan"
                fields={[
                  { name: 'contractManagerId', label: 'Contract manager', kind: 'select', options: contractManagerOptions, helpText: 'Select a manager or assign later.' },
                  { name: 'objectives', label: 'Objectives', kind: 'textarea', rows: 4 },
                  { name: 'monitoringPlan', label: 'Monitoring plan', kind: 'textarea', rows: 4 },
                  { name: 'reportingPlan', label: 'Reporting plan', kind: 'textarea', rows: 4 },
                  { name: 'communicationPlan', label: 'Communication plan', kind: 'textarea', rows: 4 },
                  { name: 'payload', label: 'Contract management plan payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  contractManagerId: contract.managementPlan?.contractManagerId ?? '',
                  objectives: contract.managementPlan?.objectives || `Deliver ${contract.title} within approved scope, time, cost, and quality.`,
                  monitoringPlan: contract.managementPlan?.monitoringPlan || 'Track milestones, inspections, risks, payments, variations, disputes, and close-out in ProcureX.',
                  reportingPlan: contract.managementPlan?.reportingPlan || 'Contract manager submits progress and exception reports through ProcureX.',
                  communicationPlan: contract.managementPlan?.communicationPlan || 'All formal notices and decisions are recorded in ProcureX.',
                  payload: JSON.stringify(contract.managementPlan?.payload ?? {}, null, 2)
                }}
                onSubmit={(payload) => awardsContractsApi.upsertManagementPlan(contract.id, payload)}
                onComplete={refreshContractAndAdvance('delivery')}
                defaultSelected
              />
              <ActionFormPanel
                title="Contract status"
                badge={contract.status}
                submitLabel="Update Status"
                fields={[
                  { name: 'status', label: 'Status', kind: 'select', required: true, options: contractStatusOptions },
                  { name: 'note', label: 'Status note', kind: 'textarea' }
                ]}
                initialValues={{ status: contract.status, note: '' }}
                onSubmit={(payload) => awardsContractsApi.updateContractStatus(contract.id, String(payload.status), String(payload.note ?? ''))}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Activation item submission"
                badge={`${contract.activationItems?.length ?? 0} items`}
                submitLabel="Submit Item"
                fields={[
                  { name: 'itemId', label: 'Activation item', kind: 'select', required: true, options: itemOptions(contract.activationItems ?? [], 'Select activation item') },
                  { name: 'documentId', label: 'Evidence document', kind: 'select', options: documentOptions(contractDocuments) },
                  { name: 'note', label: 'Submission note', kind: 'textarea' },
                  { name: 'payload', label: 'Submission payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.activationItems?.[0]?.id ?? '', documentId: '', note: '', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return postAwardApi.submitActivationItem(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Activation review"
                badge="Buyer review"
                submitLabel="Review Item"
                fields={[
                  { name: 'itemId', label: 'Activation item', kind: 'select', required: true, options: itemOptions(contract.activationItems ?? [], 'Select activation item') },
                  { name: 'status', label: 'Decision', kind: 'select', required: true, options: lifecycleStatusOptions },
                  { name: 'note', label: 'Review note', kind: 'textarea' },
                  { name: 'payload', label: 'Review payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.activationItems?.[0]?.id ?? '', status: 'APPROVED', note: '', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return postAwardApi.reviewActivationItem(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Activate contract"
                badge={contract.status === 'ACTIVE' ? 'Active' : 'Gate'}
                submitLabel="Activate"
                fields={[
                  { name: 'note', label: 'Activation note', kind: 'textarea' },
                  { name: 'payload', label: 'Activation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ note: 'Activation requirements reviewed and approved.', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.activateContract(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Contract obligation"
                badge="Obligation"
                submitLabel="Create Obligation"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'obligationType', label: 'Type', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'ownerRole', label: 'Owner role', kind: 'text', required: true },
                  { name: 'relatedMilestoneId', label: 'Related milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'acceptanceMethod', label: 'Acceptance method', kind: 'text' },
                  { name: 'acceptanceCriteria', label: 'Acceptance criteria', kind: 'textarea' },
                  { name: 'paymentEligible', label: 'Payment eligible', kind: 'checkbox' },
                  { name: 'payload', label: 'Obligation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Execution obligation', obligationType: 'DELIVERY', ownerRole: 'supplier', status: 'OPEN', dueDate: today, currency: contract.currency, paymentEligible: false, payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createObligation(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Evidence requirement"
                badge="Evidence"
                submitLabel="Create Requirement"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'obligationId', label: 'Obligation', kind: 'select', options: itemOptions(contract.obligations ?? [], 'No linked obligation') },
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'evidenceType', label: 'Evidence type', kind: 'text' },
                  { name: 'ownerRole', label: 'Owner role', kind: 'text', required: true },
                  { name: 'mandatory', label: 'Mandatory', kind: 'checkbox' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'documentId', label: 'Evidence document', kind: 'select', options: documentOptions(contractDocuments) },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Requirement payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Delivery evidence', evidenceType: 'DOCUMENT', ownerRole: 'supplier', mandatory: true, status: 'OPEN', dueDate: today, documentId: '', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createEvidenceRequirement(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Commencement"
                badge="Start"
                submitLabel="Save Commencement"
                fields={[
                  { name: 'noticeDate', label: 'Notice date', kind: 'date' },
                  { name: 'startDate', label: 'Start date', kind: 'date' },
                  { name: 'effectiveDate', label: 'Effective date', kind: 'date' },
                  { name: 'completionDate', label: 'Completion date', kind: 'date' },
                  { name: 'deliveryLocation', label: 'Delivery location', kind: 'text' },
                  { name: 'buyerContractManager', label: 'Buyer contract manager', kind: 'text' },
                  { name: 'supplierContractManager', label: 'Supplier contract manager', kind: 'text' },
                  { name: 'initialMeetingDate', label: 'Initial meeting date', kind: 'date' },
                  { name: 'approvedWorkPlan', label: 'Approved work plan', kind: 'textarea' },
                  { name: 'approvedDeliverySchedule', label: 'Approved delivery schedule', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Commencement payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  noticeDate: today,
                  startDate: today,
                  effectiveDate: today,
                  deliveryLocation: contract.payload?.deliveryLocation ? String(contract.payload.deliveryLocation) : '',
                  status: 'OPEN',
                  payload: '{}'
                }}
                onSubmit={(payload) => awardsContractsApi.upsertCommencement(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Milestone"
                badge="Milestone"
                submitLabel="Create Milestone"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'payload', label: 'Milestone payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  title: 'Delivery milestone',
                  dueDate: today,
                  amount: contract.amount === null ? '' : String(contract.amount),
                  currency: contract.currency,
                  payload: '{}'
                }}
                onSubmit={(payload) => awardsContractsApi.createMilestone(contract.id, payload)}
                onComplete={refreshContract}
              />
            </div>
            <p>{contract.managementPlan?.objectives || 'Contract objectives are not yet confirmed.'}</p>
            <SimpleTable headers={['Plan area', 'Content']}>
              <tr><td><strong>Monitoring</strong></td><td>{contract.managementPlan?.monitoringPlan || 'Pending'}</td></tr>
              <tr><td><strong>Reporting</strong></td><td>{contract.managementPlan?.reportingPlan || 'Pending'}</td></tr>
              <tr><td><strong>Communication</strong></td><td>{contract.managementPlan?.communicationPlan || 'Pending'}</td></tr>
            </SimpleTable>
            <PostAwardRegisterOverview configs={activeRegisterConfigs} search={location.search} onOpen={openPostAwardPath} />
            <div className="post-award-register-grid">
              <RegisterCard kicker="Activation" title="Activation checklist" records={asRecords(contract.activationItems)} />
              <RegisterCard kicker="Activation" title="Contract baselines" records={asRecords(contract.baselines)} />
              <RegisterCard kicker="Obligations" title="Contract obligations" records={asRecords(contract.obligations)} />
              <RegisterCard kicker="Evidence" title="Evidence requirements" records={asRecords(contract.evidenceRequirements)} />
              <RegisterCard kicker="Commencement" title="Commencement notices" records={asRecords(contract.commencements)} />
            </div>
          </section>
          ) : null}
          {activeGroup !== 'cmp' && activeGroup !== 'registers' ? (
          <section className="procurement-panel evaluation-panel post-award-panel post-award-register-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">My action forms</span><h2>{sections.find((section) => section.id === activeGroup)?.description ?? 'Record activity.'}</h2></div>
              <StatusBadge value={sections.find((section) => section.id === activeGroup)?.label ?? 'Forms'} />
            </div>
            {activeRecordTotal === 0 ? (
              <GuidedEmptyState
                title={activeEmptyState.title}
                detail={activeEmptyState.detail}
                actionLabel={activeEmptyState.actionLabel}
                onAction={() => {
                  const firstButton = document.querySelector<HTMLElement>('.post-award-register-panel [data-award-contract-form] .btn-primary');
                  firstButton?.focus();
                }}
              />
            ) : null}
            <div className="award-control-grid">
              {activeGroup === 'delivery' ? (
              <>
              <ActionFormPanel
                title="Mobilization update"
                badge={`${contract.mobilizationItems.length} items`}
                fields={[
                  { name: 'itemId', label: 'Mobilization item', kind: 'select', required: true, options: itemOptions(contract.mobilizationItems, 'Select mobilization item') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'required', label: 'Required', kind: 'checkbox' },
                  { name: 'waived', label: 'Waived', kind: 'checkbox' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Mobilization payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.mobilizationItems[0]?.id ?? '', status: 'APPROVED', required: true, payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return awardsContractsApi.updateMobilizationItem(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Milestone update"
                badge={`${contract.milestones.length} milestones`}
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', required: true, options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'Select milestone') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: milestoneStatusOptions },
                  { name: 'completedAt', label: 'Completed at', kind: 'datetime' },
                  { name: 'payload', label: 'Milestone payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ milestoneId: contract.milestones[0]?.id ?? '', status: 'SUBMITTED', currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => {
                  const { milestoneId, ...body } = payload;
                  return awardsContractsApi.updateMilestone(contract.id, String(milestoneId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Milestone evidence"
                badge="Evidence"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', required: true, options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'Select milestone') },
                  { name: 'documentId', label: 'Evidence document', kind: 'document', required: true, document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose or upload evidence.' },
                  { name: 'note', label: 'Note', kind: 'textarea' }
                ]}
                initialValues={{ milestoneId: contract.milestones[0]?.id ?? '' }}
                onSubmit={(payload) => {
                  const { milestoneId, ...body } = payload;
                  return awardsContractsApi.addMilestoneEvidence(contract.id, String(milestoneId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Deliverable"
                badge="Delivery"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'submittedAt', label: 'Submitted at', kind: 'datetime' },
                  { name: 'acceptanceNote', label: 'Acceptance note', kind: 'textarea' },
                  { name: 'payload', label: 'Deliverable payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Supplier deliverable', category: 'deliverable', status: 'SUBMITTED', dueDate: today, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createDeliverable(contract.id, payload)}
                onComplete={refreshContract}
              />
              {showDeliveryForm('Goods delivery schedule') ? (
              <ActionFormPanel
                title="Goods delivery schedule"
                badge="Goods"
                fields={[
                  { name: 'obligationId', label: 'Obligation', kind: 'select', options: itemOptions(contract.obligations ?? [], 'No linked obligation') },
                  { name: 'lineReference', label: 'Line reference', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea', required: true },
                  { name: 'plannedQuantity', label: 'Planned quantity', kind: 'number', min: 0, step: '0.01' },
                  { name: 'unit', label: 'Unit', kind: 'text' },
                  { name: 'deliveryLocation', label: 'Delivery location', kind: 'text' },
                  { name: 'plannedDeliveryDate', label: 'Planned delivery date', kind: 'date' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Schedule payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ description: 'Scheduled goods delivery', unit: 'each', plannedDeliveryDate: today, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createDeliverySchedule(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Dispatch notice') ? (
              <ActionFormPanel
                title="Dispatch notice"
                badge="Goods"
                fields={[
                  { name: 'scheduleId', label: 'Schedule', kind: 'select', options: recordPickerOptions(contract.deliverySchedules ?? [], 'No linked schedule') },
                  { name: 'dispatchReference', label: 'Dispatch reference', kind: 'text' },
                  { name: 'carrier', label: 'Carrier', kind: 'text' },
                  { name: 'trackingReference', label: 'Tracking reference', kind: 'text' },
                  { name: 'dispatchedQuantity', label: 'Dispatched quantity', kind: 'number', min: 0, step: '0.01' },
                  { name: 'expectedArrivalDate', label: 'Expected arrival date', kind: 'date' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'Dispatch payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ status: 'DISPATCHED', expectedArrivalDate: today, payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createDispatchNotice(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Goods receipt') ? (
              <ActionFormPanel
                title="Goods receipt"
                badge="GRN"
                fields={[
                  { name: 'dispatchNoticeId', label: 'Dispatch notice', kind: 'select', options: recordPickerOptions(contract.dispatchNotices ?? [], 'No linked dispatch notice') },
                  { name: 'receiptReference', label: 'Receipt reference', kind: 'text' },
                  { name: 'receivedAt', label: 'Received at', kind: 'datetime' },
                  { name: 'location', label: 'Receipt location', kind: 'text' },
                  { name: 'conditionAtReceipt', label: 'Condition at receipt', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'note', label: 'Receipt note', kind: 'textarea' },
                  { name: 'lines', label: 'Receipt lines', kind: 'json', rows: 5, helpText: 'JSON array with description and quantities.' },
                  { name: 'payload', label: 'Receipt payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ receivedAt: new Date().toISOString(), status: 'APPROVED', lines: '[{"description":"Received item","receivedQuantity":1,"acceptedQuantity":1,"unit":"each"}]', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createGoodsReceipt(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Site handover') ? (
              <ActionFormPanel
                title="Site handover"
                badge="Works"
                fields={[
                  { name: 'handoverReference', label: 'Handover reference', kind: 'text' },
                  { name: 'handoverDate', label: 'Handover date', kind: 'date' },
                  { name: 'location', label: 'Location', kind: 'text' },
                  { name: 'handedOverBy', label: 'Handed over by', kind: 'text' },
                  { name: 'receivedBy', label: 'Received by', kind: 'text' },
                  { name: 'constraints', label: 'Constraints', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'Handover payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ handoverDate: today, status: 'HANDED_OVER', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createSiteHandover(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Works progress report') ? (
              <ActionFormPanel
                title="Works progress report"
                badge="Works"
                fields={[
                  { name: 'reportReference', label: 'Report reference', kind: 'text' },
                  { name: 'periodStart', label: 'Period start', kind: 'date' },
                  { name: 'periodEnd', label: 'Period end', kind: 'date' },
                  { name: 'progressPercent', label: 'Progress percent', kind: 'number', min: 0, max: 100, step: '0.01' },
                  { name: 'narrative', label: 'Narrative', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'Progress payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ periodStart: today, periodEnd: today, progressPercent: '50', status: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createWorksProgressReport(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('BOQ measurement') ? (
              <ActionFormPanel
                title="BOQ measurement"
                badge="Works"
                fields={[
                  { name: 'reportId', label: 'Progress report', kind: 'select', options: recordPickerOptions(contract.worksProgressReports ?? [], 'No linked report') },
                  { name: 'boqItemReference', label: 'BOQ item reference', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'previousQuantity', label: 'Previous quantity', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currentQuantity', label: 'Current quantity', kind: 'number', min: 0, step: '0.01' },
                  { name: 'cumulativeQuantity', label: 'Cumulative quantity', kind: 'number', min: 0, step: '0.01' },
                  { name: 'unitRate', label: 'Unit rate', kind: 'number', min: 0, step: '0.01' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'Measurement payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ boqItemReference: 'BOQ-001', currentQuantity: '1', cumulativeQuantity: '1', status: 'APPROVED', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createBoqMeasurement(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Interim payment certificate') ? (
              <ActionFormPanel
                title="Interim payment certificate"
                badge="IPC"
                fields={[
                  { name: 'certificateNumber', label: 'Certificate number', kind: 'text' },
                  { name: 'periodStart', label: 'Period start', kind: 'date' },
                  { name: 'periodEnd', label: 'Period end', kind: 'date' },
                  { name: 'grossAmount', label: 'Gross amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'deductionsAmount', label: 'Deductions', kind: 'number', min: 0, step: '0.01' },
                  { name: 'netAmount', label: 'Net amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'approvedAt', label: 'Approved at', kind: 'datetime' },
                  { name: 'payload', label: 'IPC payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ periodStart: today, periodEnd: today, grossAmount: contract.amount === null ? '' : String(contract.amount), netAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, status: 'APPROVED', approvedAt: new Date().toISOString(), payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createInterimPaymentCertificate(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Service level') ? (
              <ActionFormPanel
                title="Service level"
                badge="Services"
                fields={[
                  { name: 'metricKey', label: 'Metric key', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'targetValue', label: 'Target value', kind: 'text' },
                  { name: 'measurementUnit', label: 'Unit', kind: 'text' },
                  { name: 'creditRule', label: 'Credit rule', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'SLA payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ metricKey: 'availability', title: 'Service availability', targetValue: '95%', status: 'ACTIVE', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createServiceLevel(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Service period') ? (
              <ActionFormPanel
                title="Service period"
                badge="Services"
                fields={[
                  { name: 'periodKey', label: 'Period key', kind: 'text', required: true },
                  { name: 'startDate', label: 'Start date', kind: 'date', required: true },
                  { name: 'endDate', label: 'End date', kind: 'date', required: true },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'payload', label: 'Period payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ periodKey: `PER-${today}`, startDate: today, endDate: today, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createServicePeriod(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Service report') ? (
              <ActionFormPanel
                title="Service report"
                badge="Services"
                fields={[
                  { name: 'periodId', label: 'Service period', kind: 'select', options: recordPickerOptions(contract.servicePeriods ?? [], 'No linked period') },
                  { name: 'reportReference', label: 'Report reference', kind: 'text' },
                  { name: 'submittedAt', label: 'Submitted at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'summary', label: 'Summary', kind: 'textarea' },
                  { name: 'payload', label: 'Report payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ submittedAt: new Date().toISOString(), status: 'APPROVED', summary: 'Service period delivered and verified.', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createServiceReport(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Consultancy deliverable') ? (
              <ActionFormPanel
                title="Consultancy deliverable"
                badge="Consultancy"
                fields={[
                  { name: 'deliverableCode', label: 'Deliverable code', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'paymentEligible', label: 'Payment eligible', kind: 'checkbox' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Deliverable payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ deliverableCode: 'CONS-001', title: 'Consultancy deliverable', dueDate: today, paymentEligible: true, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createConsultancyDeliverable(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showDeliveryForm('Consultancy deliverable version') ? (
              <ActionFormPanel
                title="Consultancy deliverable version"
                badge="Consultancy"
                fields={[
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: recordPickerOptions(contract.consultancyDeliverables ?? [], 'No linked consultancy deliverable') },
                  { name: 'versionNo', label: 'Version number', kind: 'number', min: 1 },
                  { name: 'documentId', label: 'Document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument } },
                  { name: 'submittedAt', label: 'Submitted at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'text' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Version payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ versionNo: '1', submittedAt: new Date().toISOString(), status: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createDeliverableVersion(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              </>
              ) : null}
              {activeGroup === 'inspections' ? (
              <>
              <ActionFormPanel
                title="Inspection"
                badge="Inspection"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'inspectionType', label: 'Inspection type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Result status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'inspectedAt', label: 'Inspected at', kind: 'datetime' },
                  { name: 'inspectorUserId', label: 'Inspector', kind: 'select', options: userOwnerOptions, helpText: 'Optional.' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Inspection payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ inspectionType: 'acceptance', title: 'Inspection and acceptance review', status: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createInspection(contract.id, payload)}
                onComplete={refreshContract}
              />
              {showInspectionForm('Goods inspection') ? (
              <ActionFormPanel
                title="Goods inspection"
                badge="Goods"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: itemOptions(contract.deliverables ?? [], 'No linked deliverable') },
                  { name: 'inspectionNo', label: 'Inspection number', kind: 'text', advanced: true, helpText: 'Auto-generated if blank.' },
                  { name: 'goodsDescription', label: 'Goods description', kind: 'textarea', required: true },
                  { name: 'quantityOrdered', label: 'Quantity ordered', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityReceived', label: 'Quantity received', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityAccepted', label: 'Quantity accepted', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityRejected', label: 'Quantity rejected', kind: 'number', min: 0, step: '0.01' },
                  { name: 'unit', label: 'Unit', kind: 'text' },
                  { name: 'location', label: 'Inspection location', kind: 'text' },
                  { name: 'result', label: 'Result', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'inspectedAt', label: 'Inspected at', kind: 'datetime' },
                  { name: 'defectType', label: 'Defect type', kind: 'text' },
                  { name: 'defectQuantity', label: 'Defect quantity', kind: 'number', min: 0, step: '1' },
                  { name: 'defectSeverity', label: 'Defect severity', kind: 'select', options: [option('', 'No defect severity'), option('minor'), option('major'), option('critical')] },
                  { name: 'defectNote', label: 'Defect note', kind: 'textarea' },
                  { name: 'note', label: 'Inspection note', kind: 'textarea' },
                  { name: 'payload', label: 'Goods inspection payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ goodsDescription: contract.title, unit: 'each', result: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => {
                  const { defectType, defectQuantity, defectSeverity, defectNote, ...body } = payload;
                  const defect = [defectType, defectQuantity, defectSeverity, defectNote].some((value) => value !== undefined && String(value).trim() !== '')
                    ? [{
                        type: String(defectType ?? '').trim(),
                        quantity: defectQuantity === undefined ? undefined : Number(defectQuantity),
                        severity: String(defectSeverity ?? '').trim(),
                        note: String(defectNote ?? '').trim()
                      }]
                    : [];
                  return awardsContractsApi.createGoodsInspection(contract.id, { ...body, defects: defect });
                }}
                onComplete={refreshContract}
              />
              ) : null}
              <ActionFormPanel
                title="Acceptance certificate"
                badge="Acceptance"
                fields={[
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: itemOptions(contract.deliverables ?? [], 'No linked deliverable') },
                  { name: 'inspectionId', label: 'Inspection', kind: 'select', options: itemOptions(contract.inspections, 'No linked inspection') },
                  { name: 'certificateNo', label: 'Certificate number', kind: 'text', advanced: true, helpText: 'Auto-generated if blank.' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'acceptedValue', label: 'Accepted value', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'acceptedAt', label: 'Accepted at', kind: 'datetime' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Acceptance payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ status: 'SUBMITTED', currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createAcceptance(contract.id, payload)}
                onComplete={refreshContract}
              />
              {showInspectionForm('Works defect') ? (
              <ActionFormPanel
                title="Works defect"
                badge="Defect"
                fields={[
                  { name: 'reportId', label: 'Progress report', kind: 'select', options: recordPickerOptions(contract.worksProgressReports ?? [], 'No linked report') },
                  { name: 'defectReference', label: 'Defect reference', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea', required: true },
                  { name: 'severity', label: 'Severity', kind: 'select', options: [option('MINOR'), option('MAJOR'), option('CRITICAL')] },
                  { name: 'reportedAt', label: 'Reported at', kind: 'datetime' },
                  { name: 'dueDate', label: 'Correction due date', kind: 'date' },
                  { name: 'closedAt', label: 'Closed at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Defect payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ description: 'Workmanship or completion defect', severity: 'MAJOR', reportedAt: new Date().toISOString(), dueDate: today, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createContractDefect(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              {showInspectionForm('Consultancy review') ? (
              <ActionFormPanel
                title="Consultancy review"
                badge="Review"
                fields={[
                  { name: 'versionId', label: 'Deliverable version', kind: 'select', required: true, options: recordPickerOptions(contract.deliverableVersions ?? [], 'Select submitted version') },
                  { name: 'reviewRound', label: 'Review round', kind: 'number', min: 1 },
                  { name: 'reviewerRole', label: 'Reviewer role', kind: 'select', options: [option('TECHNICAL'), option('CONTRACT_MANAGER'), option('USER_DEPARTMENT'), option('LEGAL')] },
                  { name: 'decision', label: 'Decision', kind: 'select', options: [option('APPROVED'), option('REVISE'), option('REJECTED'), option('ACCEPTED')] },
                  { name: 'comments', label: 'Comments', kind: 'textarea' },
                  { name: 'reviewedAt', label: 'Reviewed at', kind: 'datetime' },
                  { name: 'payload', label: 'Review payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ versionId: recordPickerOptions(contract.deliverableVersions ?? [], 'Select submitted version')[1]?.value ?? '', reviewRound: '1', reviewerRole: 'TECHNICAL', decision: 'APPROVED', reviewedAt: new Date().toISOString(), payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createDeliverableReview(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              </>
              ) : null}
              {activeGroup === 'payments' ? (
              <>
              <ActionFormPanel
                title="Payment schedule"
                badge="Schedule"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Schedule payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Milestone payment', amount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, dueDate: today, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPaymentSchedule(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Invoice submission"
                badge="Invoice"
                fields={[
                  { name: 'reference', label: 'Invoice reference', kind: 'text' },
                  { name: 'purchaseOrderId', label: 'Purchase order', kind: 'select', options: purchaseOrderOptions },
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Optional.' },
                  { name: 'executionReferenceId', label: 'Accepted execution record', kind: 'select', required: true, options: executionReferenceOptions },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01', required: true },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: invoiceStatusOptions },
                  { name: 'payload', label: 'Invoice payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ amount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, status: contract.status === 'TERMINATION_REVIEW' ? 'BLOCKED' : 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => {
                  const selectedReference = executionReferenceOptions.find((item) => item.value === payload.executionReferenceId);
                  return awardsContractsApi.createInvoice(contract.id, { ...payload, executionReferenceType: selectedReference?.status ?? '' });
                }}
                onComplete={refreshContract}
              />
              {showFinanceForm('Three-way match') ? (
              <ActionFormPanel
                title="Three-way match"
                badge="3-way"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', required: true, options: invoiceOptions },
                  { name: 'purchaseOrderId', label: 'Purchase order', kind: 'select', options: purchaseOrderOptions },
                  { name: 'acceptanceId', label: 'Acceptance', kind: 'select', options: itemOptions(contract.acceptances ?? [], 'No linked acceptance') },
                  { name: 'status', label: 'Invoice status after match', kind: 'select', options: invoiceStatusOptions },
                  { name: 'poMatched', label: 'PO matched', kind: 'checkbox' },
                  { name: 'receiptMatched', label: 'Receipt matched', kind: 'checkbox' },
                  { name: 'invoiceMatched', label: 'Invoice matched', kind: 'checkbox' },
                  { name: 'varianceAmount', label: 'Variance amount', kind: 'number', step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'note', label: 'Match note', kind: 'textarea' },
                  { name: 'payload', label: 'Match payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', status: 'MATCHED', poMatched: true, receiptMatched: true, invoiceMatched: true, varianceAmount: '0', currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertThreeWayMatch(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              <ActionFormPanel
                title="Payment review"
                badge="Payment"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', options: invoiceOptions },
                  { name: 'scheduleId', label: 'Schedule', kind: 'select', options: itemOptions(contract.paymentSchedules ?? [], 'No linked schedule') },
                  { name: 'status', label: 'Status', kind: 'select', options: invoiceStatusOptions },
                  { name: 'grossAmount', label: 'Gross amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'retentionAmount', label: 'Retention amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'advanceRecovery', label: 'Advance recovery', kind: 'number', min: 0, step: '0.01' },
                  { name: 'liquidatedDamages', label: 'Liquidated damages', kind: 'number', min: 0, step: '0.01' },
                  { name: 'taxWithholding', label: 'Tax withholding', kind: 'number', min: 0, step: '0.01' },
                  { name: 'netAmount', label: 'Net amount', kind: 'number', step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'paidAt', label: 'Paid at', kind: 'datetime' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Payment payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', status: contract.status === 'TERMINATION_REVIEW' ? 'BLOCKED' : 'REVIEW', grossAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPayment(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Invoice status"
                badge="Invoice"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', required: true, options: invoiceOptions },
                  { name: 'status', label: 'Status', kind: 'select', required: true, options: invoiceStatusOptions },
                  { name: 'note', label: 'Note', kind: 'textarea' }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', status: 'REVIEW' }}
                onSubmit={(payload) => {
                  const { invoiceId, ...body } = payload;
                  return awardsContractsApi.updateInvoiceStatus(contract.id, String(invoiceId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Payment approval"
                badge="Approval"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', options: invoiceOptions },
                  { name: 'paymentId', label: 'Payment', kind: 'select', options: paymentOptions },
                  { name: 'stepKey', label: 'Step key', kind: 'text', required: true, technical: true },
                  { name: 'role', label: 'Approver role', kind: 'select', required: true, options: [option('FINANCE', 'Finance'), option('CONTRACT_MANAGER', 'Contract Manager'), option('LEGAL', 'Legal'), option('TECHNICAL', 'Technical')] },
                  { name: 'status', label: 'Approval status', kind: 'select', options: invoiceStatusOptions },
                  { name: 'amountApproved', label: 'Amount approved', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'note', label: 'Approval note', kind: 'textarea' },
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Used only for this approval.' },
                  { name: 'payload', label: 'Payment approval payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', paymentId: paymentOptions[1]?.value ?? '', stepKey: 'finance-certification', role: 'FINANCE', status: 'MATCHED', amountApproved: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPaymentApproval(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Payment confirmation"
                badge="Paid"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', options: invoiceOptions },
                  { name: 'paymentId', label: 'Payment', kind: 'select', options: paymentOptions },
                  { name: 'confirmationReference', label: 'Confirmation reference', kind: 'text' },
                  { name: 'paidAmount', label: 'Paid amount', kind: 'number', min: 0, step: '0.01', required: true },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'paidAt', label: 'Paid at', kind: 'datetime' },
                  { name: 'evidenceDocumentId', label: 'Payment evidence document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose payment evidence.' },
                  { name: 'note', label: 'Payment note', kind: 'textarea' },
                  { name: 'payload', label: 'Payment confirmation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', paymentId: paymentOptions[1]?.value ?? '', paidAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPaymentConfirmation(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Penalty or deduction"
                badge="Deduction"
                fields={[
                  { name: 'invoiceId', label: 'Invoice', kind: 'select', options: invoiceOptions },
                  { name: 'penaltyType', label: 'Penalty type', kind: 'text', required: true },
                  { name: 'contractClause', label: 'Contract clause', kind: 'text' },
                  { name: 'basis', label: 'Basis', kind: 'textarea' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'evidence', label: 'Evidence lines', kind: 'textarea', rows: 4, transform: 'lineArray' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Penalty payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', penaltyType: 'Liquidated damages', amount: '0', currency: contract.currency, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createContractPenalty(contract.id, payload)}
                onComplete={refreshContract}
              />
              {showFinanceForm('Service credit') ? (
              <ActionFormPanel
                title="Service credit"
                badge="SLA"
                fields={[
                  { name: 'periodId', label: 'Service period', kind: 'select', options: recordPickerOptions(contract.servicePeriods ?? [], 'No linked period') },
                  { name: 'levelId', label: 'Service level', kind: 'select', options: recordPickerOptions(contract.serviceLevels ?? [], 'No linked SLA') },
                  { name: 'creditType', label: 'Credit type', kind: 'text', required: true },
                  { name: 'basis', label: 'Basis', kind: 'textarea' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Service credit payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ creditType: 'Service level credit', amount: '0', currency: contract.currency, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createServiceCredit(contract.id, payload)}
                onComplete={refreshContract}
              />
              ) : null}
              </>
              ) : null}
              {activeGroup === 'risk' ? (
              <>
              <ActionFormPanel
                title="Risk"
                badge="Risk"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'likelihood', label: 'Likelihood', kind: 'number', min: 1, max: 5 },
                  { name: 'impact', label: 'Impact', kind: 'number', min: 1, max: 5 },
                  { name: 'level', label: 'Risk level', kind: 'select', options: riskLevelOptions },
                  { name: 'responsibleUserId', label: 'Responsible owner', kind: 'select', options: userOwnerOptions, helpText: 'Optional.' },
                  { name: 'mitigationAction', label: 'Mitigation action', kind: 'textarea' },
                  { name: 'payload', label: 'Risk payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Delivery risk', category: 'delivery', status: 'OPEN', likelihood: '3', impact: '4', level: 'HIGH', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createRisk(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Risk update"
                badge={`${contract.risks.length} risks`}
                fields={[
                  { name: 'itemId', label: 'Risk', kind: 'select', required: true, options: itemOptions(contract.risks as ContractLifecycleItemDto[], 'Select risk') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Resolution / decision note', kind: 'textarea' },
                  { name: 'payload', label: 'Risk update payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.risks[0]?.id ?? '', status: 'IN_PROGRESS', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return awardsContractsApi.updateRisk(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Risk forecast"
                badge="Forecast"
                fields={[
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Optional.' },
                  { name: 'tenderId', label: 'Tender', kind: 'select', options: tenderOptions, helpText: 'Optional.' },
                  { name: 'forecastType', label: 'Forecast type', kind: 'text', required: true },
                  { name: 'horizonDays', label: 'Horizon days', kind: 'number', min: 1, max: 365 },
                  { name: 'probability', label: 'Probability', kind: 'number', min: 0, max: 100, required: true },
                  { name: 'impactLevel', label: 'Impact level', kind: 'select', options: riskLevelOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'One per line.' },
                  { name: 'recommendation', label: 'Recommendation', kind: 'textarea' },
                  { name: 'payload', label: 'Forecast payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ forecastType: 'delivery-default-risk', horizonDays: '30', probability: '45', impactLevel: 'MEDIUM', status: 'OPEN', drivers: 'Inspection finding\nDelivery trend', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createRiskForecast(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Non-conformance"
                badge="NCR"
                fields={[
                  { name: 'category', label: 'Category', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'contractClause', label: 'Contract clause', kind: 'text' },
                  { name: 'severity', label: 'Severity', kind: 'select', options: ['MINOR', 'MAJOR', 'CRITICAL'].map((value) => option(value)) },
                  { name: 'responsibleSupplierOfficer', label: 'Responsible supplier officer', kind: 'text' },
                  { name: 'correctiveAction', label: 'Corrective action', kind: 'textarea' },
                  { name: 'correctiveActionDeadline', label: 'Corrective action deadline', kind: 'date' },
                  { name: 'verificationResult', label: 'Verification result', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Non-conformance payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ category: 'quality', title: 'Non-conforming delivery', severity: 'MAJOR', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createNonConformance(contract.id, payload)}
                onComplete={refreshContract}
              />
              </>
              ) : null}
              {activeGroup === 'changes' ? (
              <>
              <ActionFormPanel
                title="Variation"
                badge="Variation"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Reason / description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Decision note', kind: 'textarea' },
                  { name: 'changeType', label: 'Change type', kind: 'text', required: true },
                  { name: 'affectedClause', label: 'Affected clause', kind: 'text' },
                  { name: 'costImpact', label: 'Cost impact', kind: 'number', step: '0.01' },
                  { name: 'timeImpactDays', label: 'Time impact days', kind: 'number' },
                  { name: 'technicalImpact', label: 'Technical impact', kind: 'textarea' },
                  { name: 'payload', label: 'Variation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Scope or time variation', category: 'variation', changeType: 'scope-time-cost', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createVariation(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Variation update"
                badge={`${contract.variations.length} variations`}
                fields={[
                  { name: 'itemId', label: 'Variation', kind: 'select', required: true, options: itemOptions(contract.variations as ContractLifecycleItemDto[], 'Select variation') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'note', label: 'Decision note', kind: 'textarea' },
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Required for approval.' },
                  { name: 'payload', label: 'Variation update payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.variations[0]?.id ?? '', status: 'APPROVED', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return awardsContractsApi.updateVariation(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Change request"
                badge="Amendment"
                fields={[
                  { name: 'changeType', label: 'Change type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'reason', label: 'Reason', kind: 'textarea' },
                  { name: 'technicalReview', label: 'Technical review', kind: 'textarea' },
                  { name: 'financialReview', label: 'Financial review', kind: 'textarea' },
                  { name: 'budgetCheck', label: 'Budget check', kind: 'textarea' },
                  { name: 'legalReview', label: 'Legal review', kind: 'textarea' },
                  { name: 'supplierResponse', label: 'Supplier response', kind: 'textarea' },
                  { name: 'amendmentVersionId', label: 'Amendment version', kind: 'uuid' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Change request payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ changeType: 'scope-amendment', title: 'Contract change request', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createContractChangeRequest(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Issue"
                badge="Issue"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Resolution note', kind: 'textarea' },
                  { name: 'payload', label: 'Issue payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Contract issue', category: 'delivery', status: 'OPEN', dueDate: today, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createIssue(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Issue update"
                badge={`${contract.issues.length} issues`}
                fields={[
                  { name: 'itemId', label: 'Issue', kind: 'select', required: true, options: itemOptions(contract.issues, 'Select issue') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Resolution note', kind: 'textarea' },
                  { name: 'payload', label: 'Issue update payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.issues[0]?.id ?? '', status: 'IN_PROGRESS', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return awardsContractsApi.updateIssue(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Dispute"
                badge="Dispute"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Decision note', kind: 'textarea' },
                  { name: 'payload', label: 'Dispute payload', kind: 'json', rows: 4, note: 'System metadata for dispute route details.' }
                ]}
                initialValues={{ title: 'Contract dispute', category: 'dispute', status: 'OPEN', payload: JSON.stringify({ contractClause: '', route: '' }, null, 2) }}
                onSubmit={(payload) => awardsContractsApi.createDispute(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Dispute update"
                badge={`${contract.disputes.length} disputes`}
                fields={[
                  { name: 'itemId', label: 'Dispute', kind: 'select', required: true, options: itemOptions(contract.disputes, 'Select dispute') },
                  { name: 'title', label: 'Title', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'note', label: 'Decision note', kind: 'textarea' },
                  { name: 'payload', label: 'Dispute update payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ itemId: contract.disputes[0]?.id ?? '', status: 'IN_PROGRESS', payload: '{}' }}
                onSubmit={(payload) => {
                  const { itemId, ...body } = payload;
                  return awardsContractsApi.updateDispute(contract.id, String(itemId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Claim"
                badge="Claim"
                fields={[
                  { name: 'claimReference', label: 'Claim reference', kind: 'text' },
                  { name: 'claimType', label: 'Claim type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'amountClaimed', label: 'Amount claimed', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'timeImpactDays', label: 'Time impact days', kind: 'number' },
                  { name: 'submittedAt', label: 'Submitted at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Claim payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ claimType: 'time-cost', title: 'Contract claim', currency: contract.currency, submittedAt: new Date().toISOString(), status: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createClaim(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Claim response"
                badge="Response"
                fields={[
                  { name: 'claimId', label: 'Claim', kind: 'select', required: true, options: recordPickerOptions(contract.claims ?? [], 'Select claim') },
                  { name: 'decision', label: 'Decision', kind: 'select', options: [option('APPROVED'), option('PARTIALLY_APPROVED'), option('REJECTED'), option('NEEDS_INFORMATION')] },
                  { name: 'approvedAmount', label: 'Approved amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'approvedTimeDays', label: 'Approved time days', kind: 'number' },
                  { name: 'responseText', label: 'Response text', kind: 'textarea' },
                  { name: 'respondedAt', label: 'Responded at', kind: 'datetime' },
                  { name: 'payload', label: 'Response payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ claimId: recordPickerOptions(contract.claims ?? [], 'Select claim')[1]?.value ?? '', decision: 'APPROVED', respondedAt: new Date().toISOString(), payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createClaimResponse(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Extension request"
                badge="EOT"
                fields={[
                  { name: 'requestReference', label: 'Request reference', kind: 'text' },
                  { name: 'reason', label: 'Reason', kind: 'textarea', required: true },
                  { name: 'requestedDays', label: 'Requested days', kind: 'number', min: 1 },
                  { name: 'newCompletionDate', label: 'New completion date', kind: 'date' },
                  { name: 'submittedAt', label: 'Submitted at', kind: 'datetime' },
                  { name: 'decision', label: 'Decision', kind: 'select', options: [option('PENDING'), option('APPROVED'), option('PARTIALLY_APPROVED'), option('REJECTED')] },
                  { name: 'decidedAt', label: 'Decided at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Extension payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ reason: 'Supplier requested extension of time', requestedDays: '7', newCompletionDate: today, submittedAt: new Date().toISOString(), decision: 'PENDING', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createExtensionRequest(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Contract amendment"
                badge="Baseline"
                fields={[
                  { name: 'amendmentReference', label: 'Amendment reference', kind: 'text' },
                  { name: 'amendmentType', label: 'Amendment type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'valueChange', label: 'Value change', kind: 'number', step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'timeChangeDays', label: 'Time change days', kind: 'number' },
                  { name: 'approvedAt', label: 'Approved at', kind: 'datetime' },
                  { name: 'signedAt', label: 'Signed at', kind: 'datetime' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Amendment payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ amendmentType: 'scope-time-cost', title: 'Contract amendment', currency: contract.currency, status: 'APPROVED', approvedAt: new Date().toISOString(), payload: '{}' }}
                onSubmit={(payload) => postAwardApi.createAmendment(contract.id, payload)}
                onComplete={refreshContract}
              />
              </>
              ) : null}
              {activeGroup === 'termination' ? (
              <>
              <ActionFormPanel
                title="Termination"
                badge="Termination"
                fields={[
                  { name: 'terminationType', label: 'Termination type', kind: 'select', required: true, options: terminationTypeOptions },
                  { name: 'reason', label: 'Reason', kind: 'textarea', required: true },
                  { name: 'contractClause', label: 'Contract clause', kind: 'text' },
                  { name: 'faultParty', label: 'Fault party', kind: 'text' },
                  { name: 'noticeDate', label: 'Notice date', kind: 'date' },
                  { name: 'cureDeadline', label: 'Cure deadline', kind: 'date' },
                  { name: 'terminationEffectiveDate', label: 'Effective date', kind: 'date' },
                  { name: 'supplierResponse', label: 'Supplier response', kind: 'textarea' },
                  { name: 'finalDecision', label: 'Final decision', kind: 'textarea' },
                  { name: 'payload', label: 'Termination payload', kind: 'json', rows: 5 }
                ]}
                initialValues={{
                  terminationType: 'SUPPLIER_DEFAULT',
                  reason: 'Termination review initiated from post-award workspace',
                  contractClause: 'termination',
                  faultParty: 'Supplier',
                  cureDeadline: today,
                  payload: JSON.stringify({ approvalsRequired: ['legal', 'finance', 'technical'] }, null, 2)
                }}
                onSubmit={(payload) => awardsContractsApi.createTermination(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Termination update"
                badge={`${contract.terminations.length} terminations`}
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'terminationType', label: 'Termination type', kind: 'select', options: terminationTypeOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: terminationStatusOptions },
                  { name: 'reason', label: 'Reason', kind: 'textarea' },
                  { name: 'contractClause', label: 'Contract clause', kind: 'text' },
                  { name: 'faultParty', label: 'Fault party', kind: 'text' },
                  { name: 'noticeDate', label: 'Notice date', kind: 'date' },
                  { name: 'cureDeadline', label: 'Cure deadline', kind: 'date' },
                  { name: 'terminationEffectiveDate', label: 'Effective date', kind: 'date' },
                  { name: 'supplierResponse', label: 'Supplier response', kind: 'textarea' },
                  { name: 'finalDecision', label: 'Final decision', kind: 'textarea' },
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', helpText: 'Required for final decisions.' },
                  { name: 'payload', label: 'Termination update payload', kind: 'json', rows: 5 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', terminationType: 'SUPPLIER_DEFAULT', status: 'UNDER_REVIEW', payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.updateTermination(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Termination notice"
                badge="Notice"
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'noticeType', label: 'Notice type', kind: 'text', required: true },
                  { name: 'contractClause', label: 'Contract clause', kind: 'text' },
                  { name: 'requiredAction', label: 'Required action', kind: 'textarea' },
                  { name: 'deadline', label: 'Deadline', kind: 'date' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Notice payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', noticeType: 'cure-notice', deadline: today, payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.addTerminationNotice(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Termination evidence"
                badge="Evidence"
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'documentId', label: 'Termination evidence document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose termination evidence.' },
                  { name: 'evidenceType', label: 'Evidence type', kind: 'text', required: true },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Evidence payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', evidenceType: 'performance-record', payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.addTerminationEvidence(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Termination valuation"
                badge="Valuation"
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'acceptedValue', label: 'Accepted value', kind: 'number', min: 0, step: '0.01' },
                  { name: 'rejectedValue', label: 'Rejected value', kind: 'number', min: 0, step: '0.01' },
                  { name: 'advanceRecovery', label: 'Advance recovery', kind: 'number', min: 0, step: '0.01' },
                  { name: 'retentionHeld', label: 'Retention held', kind: 'number', min: 0, step: '0.01' },
                  { name: 'liquidatedDamages', label: 'Liquidated damages', kind: 'number', min: 0, step: '0.01' },
                  { name: 'costToComplete', label: 'Cost to complete', kind: 'number', min: 0, step: '0.01' },
                  { name: 'performanceSecurityClaim', label: 'Performance security claim', kind: 'number', min: 0, step: '0.01' },
                  { name: 'finalAmountPayable', label: 'Final amount payable', kind: 'number', step: '0.01' },
                  { name: 'finalAmountRecoverable', label: 'Final amount recoverable', kind: 'number', step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'payload', label: 'Valuation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.upsertTerminationValuation(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Termination settlement"
                badge="Settlement"
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'settlementNote', label: 'Settlement note', kind: 'textarea' },
                  { name: 'settledAt', label: 'Settled at', kind: 'datetime' },
                  { name: 'payload', label: 'Settlement payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.upsertTerminationSettlement(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Replacement procurement"
                badge="Replacement"
                fields={[
                  { name: 'terminationId', label: 'Termination', kind: 'select', required: true, options: itemOptions(contract.terminations as ContractLifecycleItemDto[], 'Select termination') },
                  { name: 'method', label: 'Replacement method', kind: 'select', required: true, options: [option('replacement-procurement', 'Replacement procurement'), option('direct-award', 'Direct award'), option('emergency-procurement', 'Emergency procurement')] },
                  { name: 'urgencyLevel', label: 'Urgency level', kind: 'select', options: riskLevelOptions },
                  { name: 'remainingScope', label: 'Remaining scope', kind: 'textarea' },
                  { name: 'estimatedCost', label: 'Estimated cost', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'payload', label: 'Replacement payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ terminationId: contract.terminations[0]?.id ?? '', method: 'replacement-procurement', urgencyLevel: 'MEDIUM', currency: contract.currency, status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => {
                  const { terminationId, ...body } = payload;
                  return awardsContractsApi.upsertReplacementProcurement(contract.id, String(terminationId), body);
                }}
                onComplete={refreshContract}
              />
              </>
              ) : null}
              {activeGroup === 'warranty' ? (
              <>
              <ActionFormPanel
                title="Warranty / defects"
                badge="Warranty"
                fields={[
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'category', label: 'Category', kind: 'text' },
                  { name: 'description', label: 'Description', kind: 'textarea' },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'note', label: 'Resolution note', kind: 'textarea' },
                  { name: 'defectReference', label: 'Defect reference', kind: 'text' },
                  { name: 'startDate', label: 'Start date', kind: 'date' },
                  { name: 'endDate', label: 'End date', kind: 'date' },
                  { name: 'responsibleRole', label: 'Responsible role', kind: 'select', options: workflowRoleOptions },
                  { name: 'payload', label: 'Warranty payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ title: 'Defects liability / warranty item', category: 'warranty', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertWarranty(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Security or guarantee"
                badge="Guarantee"
                fields={[
                  { name: 'securityType', label: 'Security type', kind: 'text', required: true },
                  { name: 'issuingInstitution', label: 'Issuing institution', kind: 'text' },
                  { name: 'referenceNumber', label: 'Reference number', kind: 'text' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01' },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'issueDate', label: 'Issue date', kind: 'date' },
                  { name: 'expiryDate', label: 'Expiry date', kind: 'date' },
                  { name: 'verificationStatus', label: 'Verification status', kind: 'select', options: ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED', 'RELEASED'].map((value) => option(value)) },
                  { name: 'claimStatus', label: 'Claim status', kind: 'select', options: ['NONE', 'NOTICE_SENT', 'CLAIMED', 'RELEASED'].map((value) => option(value)) },
                  { name: 'documentId', label: 'Security document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose security document.' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Security payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ securityType: 'Performance security', amount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, verificationStatus: 'PENDING', claimStatus: 'NONE', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createContractSecurity(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Required document"
                badge="Document"
                fields={[
                  { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'ownerRole', label: 'Document owner', kind: 'select', required: true, options: documentOwnerOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'documentId', label: 'Required document file', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose required file.' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'reviewedAt', label: 'Reviewed at', kind: 'datetime' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Required document payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ documentType: 'performance-security', title: 'Performance security', ownerRole: 'Supplier', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(contract.id, payload)}
                onComplete={refreshContract}
              />
              </>
              ) : null}
              {activeGroup === 'closeout' ? (
              <>
              <ActionFormPanel
                title="Close-out"
                badge="Close-out"
                fields={[
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'completionCertificate', label: 'Completion certificate issued', kind: 'checkbox' },
                  { name: 'finalAccountApproved', label: 'Final account approved', kind: 'checkbox' },
                  { name: 'warrantyStartDate', label: 'Warranty start date', kind: 'date' },
                  { name: 'warrantyEndDate', label: 'Warranty end date', kind: 'date' },
                  { name: 'lessonsLearned', label: 'Lessons learned', kind: 'textarea' },
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', helpText: 'Required for close-out approval.' },
                  { name: 'payload', label: 'Close-out payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ status: 'OPEN', completionCertificate: false, finalAccountApproved: false, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertCloseout(contract.id, payload)}
                onComplete={refreshContractAndAdvance('performance')}
              />
              </>
              ) : null}
              {activeGroup === 'performance' ? (
              <>
              <ActionFormPanel
                title="Supplier performance"
                badge="Performance"
                fields={[
                  { name: 'overallScore', label: 'Overall score', kind: 'number', min: 0, max: 100 },
                  { name: 'timeScore', label: 'Time score', kind: 'number', min: 0, max: 100 },
                  { name: 'qualityScore', label: 'Quality score', kind: 'number', min: 0, max: 100 },
                  { name: 'costScore', label: 'Cost score', kind: 'number', min: 0, max: 100 },
                  { name: 'complianceScore', label: 'Compliance score', kind: 'number', min: 0, max: 100 },
                  { name: 'terminationFault', label: 'Termination fault', kind: 'text' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Performance payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ overallScore: '80', timeScore: '80', qualityScore: '80', costScore: '80', complianceScore: '80', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertSupplierPerformance(contract.id, payload)}
                onComplete={refreshContractAndAdvance('registers')}
              />
              <ActionFormPanel
                title="Performance score"
                badge="Score"
                fields={[
                  { name: 'scoreType', label: 'Score type', kind: 'text', required: true },
                  { name: 'score', label: 'Score', kind: 'number', min: 0, max: 100, required: true },
                  { name: 'weight', label: 'Weight', kind: 'number', min: 0, max: 100 },
                  { name: 'periodStart', label: 'Period start', kind: 'date' },
                  { name: 'periodEnd', label: 'Period end', kind: 'date' },
                  { name: 'note', label: 'Score note', kind: 'textarea' },
                  { name: 'payload', label: 'Performance score payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ scoreType: 'delivery-quality', score: '80', weight: '25', periodStart: today, periodEnd: today, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPerformanceScore(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Supplier risk profile"
                badge="Supplier risk"
                fields={[
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Optional.' },
                  { name: 'riskLevel', label: 'Risk level', kind: 'select', options: riskLevelOptions },
                  { name: 'riskScore', label: 'Risk score', kind: 'number', min: 0, max: 100 },
                  { name: 'trustTier', label: 'Trust tier', kind: 'select', options: trustTierOptions },
                  { name: 'activeAlerts', label: 'Active alerts', kind: 'number', min: 0 },
                  { name: 'openViolations', label: 'Open violations', kind: 'number', min: 0 },
                  { name: 'summary', label: 'Reason for change', kind: 'textarea', required: true },
                  { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'One per line.' },
                  { name: 'payload', label: 'Advanced payload', kind: 'json', rows: 4, advanced: true }
                ]}
                initialValues={{
                  riskLevel: String(contract.supplierRiskProfile?.riskLevel ?? 'MEDIUM'),
                  riskScore: String(contract.supplierRiskProfile?.riskScore ?? '50'),
                  trustTier: String(contract.supplierRiskProfile?.trustTier ?? 'UNVERIFIED'),
                  activeAlerts: String(contract.supplierRiskProfile?.activeAlerts ?? '0'),
                  openViolations: String(contract.supplierRiskProfile?.openViolations ?? '0'),
                  summary: String(contract.supplierRiskProfile?.summary ?? 'Supplier risk reviewed during contract tracking.'),
                  drivers: driverLines(contract.supplierRiskProfile?.drivers),
                  payload: JSON.stringify(contract.supplierRiskProfile?.payload ?? {}, null, 2)
                }}
                onSubmit={(payload) => awardsContractsApi.upsertSupplierRiskProfile(contract.id, payload)}
                onComplete={refreshContract}
              />
              </>
              ) : null}
            </div>
            <PostAwardRegisterOverview configs={activeRegisterConfigs} search={location.search} onOpen={openPostAwardPath} />
            {activeGroup === 'delivery' ? (
              <div className="post-award-register-grid">
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Delivery" title="Mobilization" records={asRecords(contract.mobilizationItems)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Delivery" title="Milestones" records={asRecords(contract.milestones as ContractLifecycleItemDto[])} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Delivery" title="Deliverables" records={asRecords(contract.deliverables as ContractLifecycleItemDto[] | undefined)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Goods" title="Delivery schedules" records={asRecords(contract.deliverySchedules)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Goods" title="Dispatch notices" records={asRecords(contract.dispatchNotices)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Goods" title="Goods receipts" records={asRecords(contract.goodsReceipts)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Works" title="Site handovers" records={asRecords(contract.siteHandovers)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Works" title="Progress reports" records={asRecords(contract.worksProgressReports)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Works" title="BOQ measurements" records={asRecords(contract.boqMeasurements)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Works" title="Interim payment certificates" records={asRecords(contract.interimPaymentCertificates)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Services" title="Service levels" records={asRecords(contract.serviceLevels)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Services" title="Service periods" records={asRecords(contract.servicePeriods)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Services" title="Service reports" records={asRecords(contract.serviceReports)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Consultancy" title="Consultancy deliverables" records={asRecords(contract.consultancyDeliverables)} />
                <WorkflowRegisterCard allowed={workflowConfig.deliveryRegisters} kicker="Consultancy" title="Deliverable versions" records={asRecords(contract.deliverableVersions)} />
              </div>
            ) : null}
            {activeGroup === 'inspections' ? (
              <div className="post-award-register-grid">
                <WorkflowRegisterCard allowed={workflowConfig.inspectionRegisters} kicker="Inspections" title="Inspections" records={asRecords(contract.inspections)} />
                <WorkflowRegisterCard allowed={workflowConfig.inspectionRegisters} kicker="Inspections" title="Goods inspections" records={asRecords(contract.goodsInspections)} />
                <WorkflowRegisterCard allowed={workflowConfig.inspectionRegisters} kicker="Inspections" title="Acceptance" records={asRecords(contract.acceptances as ContractLifecycleItemDto[] | undefined)} />
                <WorkflowRegisterCard allowed={workflowConfig.inspectionRegisters} kicker="Works" title="Defects" records={asRecords(contract.defects)} />
                <WorkflowRegisterCard allowed={workflowConfig.inspectionRegisters} kicker="Consultancy" title="Deliverable reviews" records={asRecords(contract.deliverableReviews)} />
              </div>
            ) : null}
            {activeGroup === 'payments' ? (
              <div className="post-award-register-grid">
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Payment schedule" records={asRecords(contract.paymentSchedules as ContractLifecycleItemDto[] | undefined)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Purchase orders" records={asRecords(contract.purchaseOrders)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Invoices" records={asRecords(contract.invoices)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Payments" records={asRecords(contract.payments)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Three-way matches" records={asRecords(contract.threeWayMatches)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Penalties and deductions" records={asRecords(contract.penalties)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
                <WorkflowRegisterCard allowed={workflowConfig.financeRegisters} kicker="Payments" title="Service credits" records={asRecords(contract.serviceCredits)} />
              </div>
            ) : null}
            {activeGroup === 'risk' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
                {!isSupplierViewer ? <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} /> : null}
                <RegisterCard kicker="Risk" title="Non-conformance" records={asRecords(contract.nonConformances)} />
              </div>
            ) : null}
            {activeGroup === 'changes' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
                <RegisterCard kicker="Changes" title="Change requests and amendments" records={asRecords(contract.changeRequests)} />
                <RegisterCard kicker="Changes" title="Extension requests" records={asRecords(contract.extensionRequests)} />
                <RegisterCard kicker="Changes" title="Amendments" records={asRecords(contract.amendments)} />
                <RegisterCard kicker="Claims" title="Claims" records={asRecords(contract.claims)} />
                <RegisterCard kicker="Claims" title="Claim responses" records={asRecords(contract.claimResponses)} />
                <RegisterCard kicker="Changes" title="Issues" records={asRecords(contract.issues)} />
                <RegisterCard kicker="Changes" title="Disputes" records={asRecords(contract.disputes)} />
              </div>
            ) : null}
            {activeGroup === 'termination' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Termination" title="Termination" records={asRecords(contract.terminations as ContractLifecycleItemDto[])} />
              </div>
            ) : null}
            {activeGroup === 'warranty' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Securities" title="Securities and guarantees" records={asRecords(contract.securities)} />
                <RegisterCard kicker="Warranty" title="Warranty and defects" records={asRecords(contract.warranties as ContractLifecycleItemDto[] | undefined)} />
                <RegisterCard kicker="Warranty" title="Required documents" records={asRecords(contract.requiredDocuments)} />
                <RegisterCard kicker="Samples" title="Reference samples" records={asRecords(contract.referenceSamples)} />
              </div>
            ) : null}
            {activeGroup === 'closeout' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Close-out" title="Close-out" records={contract.closeout ? [contract.closeout as Record<string, unknown>] : []} countLabel="records" />
                {!isSupplierViewer ? <RegisterCard kicker="Audit" title="Audit events" records={asRecords(contract.audit)} countLabel="events" /> : null}
              </div>
            ) : null}
            {activeGroup === 'performance' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Performance" title="Supplier performance" records={asRecords(contract.supplierPerformanceRecords)} />
                <RegisterCard kicker="Performance" title="Performance scores" records={asRecords(contract.performanceScores)} />
                {!isSupplierViewer ? <RegisterCard kicker="Risk" title="Supplier risk profile" records={contract.supplierRiskProfile ? [contract.supplierRiskProfile as Record<string, unknown>] : []} countLabel="profiles" /> : null}
              </div>
            ) : null}
          </section>
          ) : null}
          {activeGroup === 'registers' ? (
            <>
            <PostAwardRegisterOverview configs={activeRegisterConfigs} search={location.search} onOpen={openPostAwardPath} />
            <div className="post-award-register-grid post-award-history-legacy-grid">
              <RegisterCard kicker="Activation" title="Activation checklist" records={asRecords(contract.activationItems)} />
              <RegisterCard kicker="Activation" title="Contract baselines" records={asRecords(contract.baselines)} />
              <RegisterCard kicker="Obligations" title="Contract obligations" records={asRecords(contract.obligations)} />
              <RegisterCard kicker="Evidence" title="Evidence requirements" records={asRecords(contract.evidenceRequirements)} />
              <RegisterCard kicker="Commencement" title="Commencement notices" records={asRecords(contract.commencements)} />
              <RegisterCard kicker="Delivery" title="Mobilization" records={asRecords(contract.mobilizationItems)} />
              <RegisterCard kicker="Delivery" title="Milestones" records={asRecords(contract.milestones as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Delivery" title="Deliverables" records={asRecords(contract.deliverables as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Goods" title="Delivery schedules" records={asRecords(contract.deliverySchedules)} />
              <RegisterCard kicker="Goods" title="Dispatch notices" records={asRecords(contract.dispatchNotices)} />
              <RegisterCard kicker="Goods" title="Goods receipts" records={asRecords(contract.goodsReceipts)} />
              <RegisterCard kicker="Works" title="Site handovers" records={asRecords(contract.siteHandovers)} />
              <RegisterCard kicker="Works" title="Progress reports" records={asRecords(contract.worksProgressReports)} />
              <RegisterCard kicker="Works" title="BOQ measurements" records={asRecords(contract.boqMeasurements)} />
              <RegisterCard kicker="Works" title="Interim payment certificates" records={asRecords(contract.interimPaymentCertificates)} />
              <RegisterCard kicker="Services" title="Service levels" records={asRecords(contract.serviceLevels)} />
              <RegisterCard kicker="Services" title="Service periods" records={asRecords(contract.servicePeriods)} />
              <RegisterCard kicker="Services" title="Service reports" records={asRecords(contract.serviceReports)} />
              <RegisterCard kicker="Services" title="Service credits" records={asRecords(contract.serviceCredits)} />
              <RegisterCard kicker="Consultancy" title="Consultancy deliverables" records={asRecords(contract.consultancyDeliverables)} />
              <RegisterCard kicker="Consultancy" title="Deliverable versions" records={asRecords(contract.deliverableVersions)} />
              <RegisterCard kicker="Consultancy" title="Deliverable reviews" records={asRecords(contract.deliverableReviews)} />
              <RegisterCard kicker="Inspections" title="Inspections" records={asRecords(contract.inspections)} />
              <RegisterCard kicker="Inspections" title="Goods inspections" records={asRecords(contract.goodsInspections)} />
              <RegisterCard kicker="Inspections" title="Acceptance" records={asRecords(contract.acceptances as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Works" title="Defects" records={asRecords(contract.defects)} />
              <RegisterCard kicker="Payments" title="Payment schedule" records={asRecords(contract.paymentSchedules as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Payments" title="Purchase orders" records={asRecords(contract.purchaseOrders)} />
              <RegisterCard kicker="Payments" title="Invoices" records={asRecords(contract.invoices)} />
              <RegisterCard kicker="Payments" title="Payments" records={asRecords(contract.payments)} />
              <RegisterCard kicker="Payments" title="Three-way matches" records={asRecords(contract.threeWayMatches)} />
              <RegisterCard kicker="Payments" title="Penalties and deductions" records={asRecords(contract.penalties)} />
              <RegisterCard kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
              <RegisterCard kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
              <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
              {!isSupplierViewer ? <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} /> : null}
              <RegisterCard kicker="Risk" title="Non-conformance" records={asRecords(contract.nonConformances)} />
              <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Changes" title="Change requests and amendments" records={asRecords(contract.changeRequests)} />
              <RegisterCard kicker="Changes" title="Extension requests" records={asRecords(contract.extensionRequests)} />
              <RegisterCard kicker="Changes" title="Amendments" records={asRecords(contract.amendments)} />
              <RegisterCard kicker="Claims" title="Claims" records={asRecords(contract.claims)} />
              <RegisterCard kicker="Claims" title="Claim responses" records={asRecords(contract.claimResponses)} />
              <RegisterCard kicker="Changes" title="Issues" records={asRecords(contract.issues)} />
              <RegisterCard kicker="Changes" title="Disputes" records={asRecords(contract.disputes)} />
              <RegisterCard kicker="Termination" title="Termination" records={asRecords(contract.terminations as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Securities" title="Securities and guarantees" records={asRecords(contract.securities)} />
              <RegisterCard kicker="Warranty" title="Warranty and defects" records={asRecords(contract.warranties as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Samples" title="Reference samples" records={asRecords(contract.referenceSamples)} />
              <RegisterCard kicker="Worklist" title="Urgent actions" records={asRecords(contract.urgentActions as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Close-out" title="Close-out" records={contract.closeout ? [contract.closeout as Record<string, unknown>] : []} countLabel="records" />
              <RegisterCard kicker="Performance" title="Supplier performance" records={asRecords(contract.supplierPerformanceRecords)} />
              <RegisterCard kicker="Performance" title="Performance scores" records={asRecords(contract.performanceScores)} />
              {!isSupplierViewer ? <RegisterCard kicker="Risk" title="Supplier risk profile" records={contract.supplierRiskProfile ? [contract.supplierRiskProfile as Record<string, unknown>] : []} countLabel="profiles" /> : null}
              {!isSupplierViewer ? <RegisterCard kicker="Audit" title="Audit events" records={asRecords(contract.audit)} countLabel="events" /> : null}
            </div>
            </>
          ) : null}
          </div>
          )
          ) : null}
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
