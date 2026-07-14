import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type {
  AwardContractDashboard,
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
import { LockedFlowStepPanel, flowStepFromSearch, searchWithFlowStep } from './AwardContractFlow';
import { ExpandableAwardDetails } from './AwardContractSimpleShared';
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

const postAwardWorkGroups: Array<{
  id: PostAwardWorkGroupId;
  label: string;
  description: string;
  sectionIds: PostAwardSectionId[];
}> = [
  { id: 'setup', label: 'Setup', description: 'Contract management plan (CMP), commencement, required documents, securities, and reference samples.', sectionIds: ['cmp', 'warranty'] },
  { id: 'delivery', label: 'Delivery', description: 'Mobilization, milestones, deliverables, inspections, and acceptances.', sectionIds: ['delivery', 'inspections'] },
  { id: 'finance', label: 'Finance', description: 'Purchase orders, invoices, payment approvals, payments, and penalties.', sectionIds: ['payments'] },
  { id: 'risk-changes', label: 'Risk & Changes', description: 'Risks, non-conformance, variations, issues, disputes, and termination.', sectionIds: ['risk', 'changes', 'termination'] },
  { id: 'closeout-performance', label: 'Close-out & Performance', description: 'Warranty/defects, close-out, supplier performance, and saved history.', sectionIds: ['closeout', 'performance', 'registers'] }
];

function asRecords(items: Array<Record<string, unknown>> | ContractLifecycleItemDto[] | undefined) {
  return (items ?? []) as Array<Record<string, unknown>>;
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
    { value: '', label: 'Upload or choose a document', description: 'Attach evidence before submitting this form' },
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

function contractChooserRows(dashboard: AwardContractDashboard | null) {
  return [
    ...(dashboard?.queues['active-contracts'] ?? []),
    ...(dashboard?.queues['closed-contracts'] ?? [])
  ].filter((row) => row.contractId);
}

function recommendedPostAwardActions(contract: ContractDetailDto, sections: Array<WorkflowSection<PostAwardSectionId>>) {
  const actions: Array<{ step: PostAwardSectionId; title: string; detail: string; priority: string }> = [];
  if (!contract.managementPlan) actions.push({ step: 'cmp', title: 'Create contract management plan', detail: 'Define monitoring, reporting, and communication before execution records grow.', priority: 'High' });
  if (contract.milestones.length === 0) actions.push({ step: 'cmp', title: 'Create first milestone', detail: 'Milestones drive delivery evidence, inspections, payment schedules, and close-out.', priority: 'High' });
  if (contract.milestones.length > 0 && (contract.deliverables?.length ?? 0) === 0) actions.push({ step: 'delivery', title: 'Record deliverable', detail: 'Capture the supplier delivery against the active milestone.', priority: 'Medium' });
  if ((contract.deliverables?.length ?? 0) > 0 && contract.inspections.length === 0 && (contract.goodsInspections?.length ?? 0) === 0) actions.push({ step: 'inspections', title: 'Inspect and accept delivery', detail: 'Record inspection results before payment review.', priority: 'Medium' });
  if ((contract.invoices?.length ?? 0) > 0 && (contract.paymentConfirmations?.length ?? 0) === 0) actions.push({ step: 'payments', title: 'Review payment evidence', detail: 'Match invoice, approval, and payment confirmation records.', priority: 'Medium' });
  if (contract.risks.length > 0) actions.push({ step: 'risk', title: 'Update open risk', detail: 'Keep mitigation and ownership current while the contract is active.', priority: 'Medium' });
  if (contract.status === 'COMPLETED' && !contract.closeout) actions.push({ step: 'closeout', title: 'Prepare close-out', detail: 'Complete final account, completion certificate, and lessons learned.', priority: 'High' });
  if ((contract.supplierPerformanceRecords.length ?? 0) === 0) actions.push({ step: 'performance', title: 'Score supplier performance', detail: 'Capture delivery, quality, cost, and compliance performance.', priority: 'Low' });

  if (actions.length === 0) {
    const busiest = [...sections].sort((left, right) => (right.count ?? 0) - (left.count ?? 0))[0];
    return [{ step: (busiest?.id ?? 'registers') as PostAwardSectionId, title: 'Review saved history', detail: 'All core post-award records are available for review.', priority: 'Info' }];
  }
  return actions.slice(0, 4);
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
  onOpen: (row: LifecycleAction) => void;
  onBack: () => void;
}) {
  return (
    <section className="procurement-panel evaluation-panel post-award-panel post-award-contract-chooser">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Choose contract</span>
          <h2>Open an active or closed contract to continue post-award tracking</h2>
          <p>Post-award records belong to a signed contract. Choose the contract first, then ProcureX will show delivery, finance, risk, close-out, and performance actions.</p>
        </div>
        <StatusBadge value={rows.length ? `${rows.length} contracts` : 'No contract selected'} />
      </div>
      {isLoading ? (
        <div className="scope-empty">Loading active and closed contracts...</div>
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
                <th>Due / stage</th>
                <th>Open</th>
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
                  <td>{row.dueDate ? dateLabel(row.dueDate) : row.currentStage}</td>
                  <td><button className="btn btn-primary btn-sm" type="button" onClick={() => onOpen(row)}>Open tracking</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty award-card-empty">
          <p>No active or closed contracts are ready for post-award tracking yet. Complete award response, contract negotiation, signatures, and activation first.</p>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onBack}>Back to Awards and Contracts</button>
        </div>
      )}
    </section>
  );
}

export function PostAwardTrackingProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [contractDocuments, setContractDocuments] = useState<AwardContractDocumentDto[]>([]);
  const [dashboard, setDashboard] = useState<AwardContractDashboard | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activeGroup = useMemo(() => flowStepFromSearch(location.search, postAwardFlowStepIds, 'cmp'), [location.search]);

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
      setDashboard(await awardsContractsApi.dashboard());
    } catch (error) {
      setDashboard(null);
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
    navigate({ pathname: '/post-award', search: searchWithFlowStep(location.search, step) });
  }

  function openContractTracking(row: LifecycleAction) {
    if (!row.contractId) return;
    navigate(`/post-award?contract=${encodeURIComponent(row.contractId)}&step=cmp`);
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
  const invoices = contract?.invoices ?? [];
  const payments = contract?.payments ?? [];
  const purchaseOrders = contract?.purchaseOrders ?? [];
  const invoiceOptions = recordPickerOptions(invoices, 'Select invoice');
  const paymentOptions = recordPickerOptions(payments, 'Select payment');
  const purchaseOrderOptions = recordPickerOptions(purchaseOrders, 'No linked purchase order');
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
    { id: 'cmp', label: 'Contract management plan (CMP)', description: 'Plan, commencement, and contract status.', count: (contract?.managementPlan ? 1 : 0) + (contract?.commencements?.length ?? 0) },
    { id: 'delivery', label: 'Delivery', description: 'Mobilization, milestones, and deliverables.', count: (contract?.mobilizationItems.length ?? 0) + (contract?.milestones.length ?? 0) + (contract?.deliverables?.length ?? 0) },
    { id: 'inspections', label: 'Inspections and acceptance', description: 'Inspection, goods checks, and acceptance certificates.', count: (contract?.inspections.length ?? 0) + (contract?.goodsInspections?.length ?? 0) + (contract?.acceptances?.length ?? 0) },
    { id: 'payments', label: 'Finance records', description: 'Invoices, matching, penalties, payment approvals, and confirmations.', count: invoices.length + payments.length + (contract?.paymentApprovals?.length ?? 0) + (contract?.penalties?.length ?? 0) },
    { id: 'risk', label: 'Risks and non-conformance', description: 'Risks, forecasts, and non-conformance records.', count: (contract?.risks.length ?? 0) + (contract?.riskForecasts?.length ?? 0) + (contract?.nonConformances?.length ?? 0) },
    { id: 'changes', label: 'Changes, issues, and disputes', description: 'Variations, change requests, issues, and disputes.', count: (contract?.variations.length ?? 0) + (contract?.changeRequests?.length ?? 0) + (contract?.issues.length ?? 0) + (contract?.disputes.length ?? 0) },
    { id: 'termination', label: 'Termination', description: 'Termination review, notices, evidence, valuation, settlement, and replacement procurement.', count: contract?.terminations.length ?? 0 },
    { id: 'warranty', label: 'Documents, securities, and warranty', description: 'Required documents, guarantees, defects, warranty items, and reference samples.', count: (contract?.securities?.length ?? 0) + (contract?.warranties?.length ?? 0) + (contract?.requiredDocuments?.length ?? 0) + (contract?.referenceSamples?.length ?? 0) },
    { id: 'closeout', label: 'Close-out', description: 'Completion and final account records.', count: contract?.closeout ? 1 : 0 },
    { id: 'performance', label: 'Supplier performance', description: 'Performance scores and supplier risk profile.', count: (contract?.supplierPerformanceRecords.length ?? 0) + (contract?.performanceScores?.length ?? 0) },
    { id: 'registers', label: 'Saved history', description: 'All saved contract records and audit history.', count: contract ? 1 : 0 }
  ];
  const formationLocked = Boolean(contract && ['DRAFT', 'NEGOTIATION', 'SIGNATURE_PENDING'].includes(contract.status));
  const activeFlowLock = useMemo(() => {
    const noContract = { message: 'Select an active or closed contract before continuing post-award tracking.', actionLabel: 'Back to Active Contracts', navigatePage: 'awarding-contracts', routeSearch: 'queue=active-contracts' };
    const notReady = { message: 'Finish negotiation, final draft acceptance, outcome notices, and signing before recording delivery, finance, risk, changes, or close-out work.', actionLabel: 'Open contract negotiation', navigatePage: 'contract-negotiation', routeSearch: `contract=${contractId}&step=signatures` };
    if (!contract) return noContract;
    if (formationLocked && !['cmp', 'registers'].includes(activeGroup)) return notReady;
    return null;
  }, [activeGroup, contract, contractId, formationLocked]);
  const activeSection = sections.find((section) => section.id === activeGroup);
  const activeWorkGroup = workGroupForSection(activeGroup);
  const chooserRows = contractChooserRows(dashboard);
  const recommendedActions = contract ? recommendedPostAwardActions(contract, sections) : [];

  return (
    <ProcurexAwardFrame pageKey="post-award-tracking">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content post-award-workspace">
          <AwardHero
            kicker="Contract execution and monitoring"
            title={contract?.title ?? 'No active or closed contract selected'}
            copy="Track setup, delivery, finance, risk, changes, close-out, and supplier performance in grouped work areas. Official records such as the contract management plan (CMP) stay inside the relevant group."
            stats={[
              { value: contract?.milestones.length ?? 0, label: 'Milestones' },
              { value: contract?.risks.length ?? 0, label: 'Open risk records' },
              { value: contract?.supplierPerformanceRecords.length ?? 0, label: 'Performance records' }
            ]}
          />

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading post-award workspace"
              message="ProcureX is fetching the selected contract, execution records, payment controls, risk registers, and close-out status."
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
              onBack={() => navigate('/awards-contracts?queue=active-contracts')}
            />
          ) : !isLoading && !loadError && contract ? (
            <AwardContractAccessProvider access={contract.access ? { ...contract.access, hideLockedActions: true } : undefined}>
          <section className="procurement-panel evaluation-panel post-award-panel post-award-cmp-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Track delivery</span>
                <h2>Choose the work area you need</h2>
                <p>Start with setup, then move into delivery, finance, risk and changes, or close-out. Detailed official records remain inside each group.</p>
              </div>
              <StatusBadge value={activeWorkGroup.label} />
            </div>
            <section className="contract-overview-grid">
              <article><span>Status</span><strong>{contract.status}</strong></article>
              <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
              <article><span>Supplier</span><strong>{contract.supplierName ?? 'Supplier pending'}</strong></article>
              <article><span>Reference</span><strong>{contract.reference}</strong></article>
            </section>
            <section className="post-award-next-actions" aria-label="Recommended next actions">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Recommended next actions</span>
                  <h2>Start with the records most likely to unblock this contract</h2>
                </div>
              </div>
              <div className="post-award-action-list">
                {recommendedActions.map((action) => (
                  <button className="post-award-action-card" type="button" onClick={() => selectFlowStep(action.step)} key={`${action.step}-${action.title}`}>
                    <span>{action.priority}</span>
                    <strong>{action.title}</strong>
                    <em>{action.detail}</em>
                  </button>
                ))}
              </div>
            </section>
            <div className="award-simple-details-stack post-award-work-chooser" aria-label="Post-award work areas">
              {postAwardWorkGroups.map((group) => {
                const groupSections = group.sectionIds.map((id) => sections.find((section) => section.id === id)).filter(Boolean) as Array<WorkflowSection<PostAwardSectionId>>;
                const groupCount = groupSections.reduce((sum, section) => sum + (section.count ?? 0), 0);
                const lockedByFormation = formationLocked && !group.sectionIds.some((id) => id === 'cmp' || id === 'registers');
                return (
                  <ExpandableAwardDetails
                    title={group.label}
                    summary={lockedByFormation ? 'Locked until contract is signed' : `${groupCount} record${groupCount === 1 ? '' : 's'}`}
                    open={activeWorkGroup.id === group.id}
                    key={group.id}
                  >
                    <div className="award-simple-detail-action">
                      <p>{group.description}</p>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => selectFlowStep(group.sectionIds[0])}>
                        Open {group.label.toLowerCase()}
                      </button>
                    </div>
                  </ExpandableAwardDetails>
                );
              })}
            </div>
            <div className="post-award-subnav" role="tablist" aria-label={`${activeWorkGroup.label} records`}>
              {activeWorkGroup.sectionIds.map((sectionId) => {
                const section = sections.find((item) => item.id === sectionId);
                if (!section) return null;
                return (
                  <button
                    className={`btn btn-secondary btn-sm${activeGroup === sectionId ? ' active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={activeGroup === sectionId}
                    onClick={() => selectFlowStep(sectionId)}
                    key={sectionId}
                  >
                    {sectionDisplayTitle(section)}
                  </button>
                );
              })}
            </div>
          </section>
          {activeFlowLock ? (
            <LockedFlowStepPanel title={`${activeSection ? sectionDisplayTitle(activeSection) : 'Work area'} is locked`} reason={activeFlowLock} />
          ) : null}
          {!activeFlowLock ? (
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
                  { name: 'contractManagerId', label: 'Contract manager', kind: 'select', options: contractManagerOptions, helpText: 'Use the current manager when present, or assign later from user administration.' },
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
            <div className="post-award-register-grid">
              <RegisterCard kicker="Commencement" title="Commencement notices" records={asRecords(contract.commencements)} />
            </div>
          </section>
          ) : null}
          {activeGroup !== 'cmp' && activeGroup !== 'registers' ? (
          <section className="procurement-panel evaluation-panel post-award-panel post-award-register-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Production action forms</span><h2>{sections.find((section) => section.id === activeGroup)?.description ?? 'Record contract activity.'}</h2></div>
              <StatusBadge value={sections.find((section) => section.id === activeGroup)?.label ?? 'Forms'} />
            </div>
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
                  { name: 'documentId', label: 'Evidence document', kind: 'document', required: true, document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Choose an existing contract document or upload evidence now.' },
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
                  { name: 'inspectorUserId', label: 'Inspector', kind: 'select', options: userOwnerOptions, helpText: 'Leave blank to use the logged-in inspection owner.' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Inspection payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ inspectionType: 'acceptance', title: 'Inspection and acceptance review', status: 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createInspection(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Goods inspection"
                badge="Goods"
                fields={[
                  { name: 'milestoneId', label: 'Milestone', kind: 'select', options: itemOptions(contract.milestones as ContractLifecycleItemDto[], 'No linked milestone') },
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: itemOptions(contract.deliverables ?? [], 'No linked deliverable') },
                  { name: 'inspectionNo', label: 'Inspection number', kind: 'text', advanced: true, helpText: 'Leave blank to let ProcureX generate the official goods inspection number.' },
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
              <ActionFormPanel
                title="Acceptance certificate"
                badge="Acceptance"
                fields={[
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: itemOptions(contract.deliverables ?? [], 'No linked deliverable') },
                  { name: 'inspectionId', label: 'Inspection', kind: 'select', options: itemOptions(contract.inspections, 'No linked inspection') },
                  { name: 'certificateNo', label: 'Certificate number', kind: 'text', advanced: true, helpText: 'Leave blank to let ProcureX generate the acceptance certificate number.' },
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
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Leave blank to use the supplier linked to this contract.' },
                  { name: 'amount', label: 'Amount', kind: 'number', min: 0, step: '0.01', required: true },
                  { name: 'currency', label: 'Currency', kind: 'currency' },
                  { name: 'status', label: 'Status', kind: 'select', options: invoiceStatusOptions },
                  { name: 'payload', label: 'Invoice payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ amount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, status: contract.status === 'TERMINATION_REVIEW' ? 'BLOCKED' : 'SUBMITTED', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createInvoice(contract.id, payload)}
                onComplete={refreshContract}
              />
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
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Unlocks your private signing key for this payment approval only.' },
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
                  { name: 'evidenceDocumentId', label: 'Payment evidence document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Upload or choose proof of payment, receipt, or bank confirmation.' },
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
                  { name: 'responsibleUserId', label: 'Responsible owner', kind: 'select', options: userOwnerOptions, helpText: 'Leave blank to assign responsibility from the current workflow owner.' },
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
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Leave blank to use the supplier linked to this contract.' },
                  { name: 'tenderId', label: 'Tender', kind: 'select', options: tenderOptions, helpText: 'Leave blank to use the tender linked to this contract.' },
                  { name: 'forecastType', label: 'Forecast type', kind: 'text', required: true },
                  { name: 'horizonDays', label: 'Horizon days', kind: 'number', min: 1, max: 365 },
                  { name: 'probability', label: 'Probability', kind: 'number', min: 0, max: 100, required: true },
                  { name: 'impactLevel', label: 'Impact level', kind: 'select', options: riskLevelOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'Enter one driver per line.' },
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
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Required when approving a contract variation.' },
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
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', helpText: 'Required for APPROVED or TERMINATED termination decisions.' },
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
                  { name: 'documentId', label: 'Termination evidence document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Upload or choose notices, correspondence, performance records, or other termination evidence.' },
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
                  { name: 'documentId', label: 'Security document', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Upload or choose the guarantee, security, or release document.' },
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
                  { name: 'documentId', label: 'Required document file', kind: 'document', document: { options: evidenceDocumentOptions, onUpload: uploadEvidenceDocument }, helpText: 'Upload or choose the file satisfying this requirement.' },
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
                  { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', helpText: 'Required for final close-out approvals and completion certificates.' },
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
                  { name: 'supplierOrgId', label: 'Supplier organization', kind: 'select', options: supplierOrgOptions, helpText: 'Leave blank to use the supplier linked to this contract.' },
                  { name: 'riskLevel', label: 'Risk level', kind: 'select', options: riskLevelOptions },
                  { name: 'riskScore', label: 'Risk score', kind: 'number', min: 0, max: 100 },
                  { name: 'trustTier', label: 'Trust tier', kind: 'select', options: trustTierOptions },
                  { name: 'activeAlerts', label: 'Active alerts', kind: 'number', min: 0 },
                  { name: 'openViolations', label: 'Open violations', kind: 'number', min: 0 },
                  { name: 'summary', label: 'Reason for change', kind: 'textarea', required: true },
                  { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'Enter one driver per line.' },
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
            {activeGroup === 'delivery' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Delivery" title="Mobilization" records={asRecords(contract.mobilizationItems)} />
                <RegisterCard kicker="Delivery" title="Milestones" records={asRecords(contract.milestones as ContractLifecycleItemDto[])} />
                <RegisterCard kicker="Delivery" title="Deliverables" records={asRecords(contract.deliverables as ContractLifecycleItemDto[] | undefined)} />
              </div>
            ) : null}
            {activeGroup === 'inspections' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Inspections" title="Inspections" records={asRecords(contract.inspections)} />
                <RegisterCard kicker="Inspections" title="Goods inspections" records={asRecords(contract.goodsInspections)} />
                <RegisterCard kicker="Inspections" title="Acceptance" records={asRecords(contract.acceptances as ContractLifecycleItemDto[] | undefined)} />
              </div>
            ) : null}
            {activeGroup === 'payments' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Payments" title="Payment schedule" records={asRecords(contract.paymentSchedules as ContractLifecycleItemDto[] | undefined)} />
                <RegisterCard kicker="Payments" title="Purchase orders" records={asRecords(contract.purchaseOrders)} />
                <RegisterCard kicker="Payments" title="Invoices" records={asRecords(contract.invoices)} />
                <RegisterCard kicker="Payments" title="Payments" records={asRecords(contract.payments)} />
                <RegisterCard kicker="Payments" title="Three-way matches" records={asRecords(contract.threeWayMatches)} />
                <RegisterCard kicker="Payments" title="Penalties and deductions" records={asRecords(contract.penalties)} />
                <RegisterCard kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
                <RegisterCard kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
              </div>
            ) : null}
            {activeGroup === 'risk' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
                <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} />
                <RegisterCard kicker="Risk" title="Non-conformance" records={asRecords(contract.nonConformances)} />
              </div>
            ) : null}
            {activeGroup === 'changes' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
                <RegisterCard kicker="Changes" title="Change requests and amendments" records={asRecords(contract.changeRequests)} />
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
                <RegisterCard kicker="Audit" title="Audit events" records={asRecords(contract.audit)} countLabel="events" />
              </div>
            ) : null}
            {activeGroup === 'performance' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Performance" title="Supplier performance" records={asRecords(contract.supplierPerformanceRecords)} />
                <RegisterCard kicker="Performance" title="Performance scores" records={asRecords(contract.performanceScores)} />
                <RegisterCard kicker="Risk" title="Supplier risk profile" records={contract.supplierRiskProfile ? [contract.supplierRiskProfile as Record<string, unknown>] : []} countLabel="profiles" />
              </div>
            ) : null}
          </section>
          ) : null}
          {activeGroup === 'registers' ? (
            <div className="post-award-register-grid">
              <RegisterCard kicker="Commencement" title="Commencement notices" records={asRecords(contract.commencements)} />
              <RegisterCard kicker="Delivery" title="Mobilization" records={asRecords(contract.mobilizationItems)} />
              <RegisterCard kicker="Delivery" title="Milestones" records={asRecords(contract.milestones as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Delivery" title="Deliverables" records={asRecords(contract.deliverables as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Inspections" title="Inspections" records={asRecords(contract.inspections)} />
              <RegisterCard kicker="Inspections" title="Goods inspections" records={asRecords(contract.goodsInspections)} />
              <RegisterCard kicker="Inspections" title="Acceptance" records={asRecords(contract.acceptances as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Payments" title="Payment schedule" records={asRecords(contract.paymentSchedules as ContractLifecycleItemDto[] | undefined)} />
              <RegisterCard kicker="Payments" title="Purchase orders" records={asRecords(contract.purchaseOrders)} />
              <RegisterCard kicker="Payments" title="Invoices" records={asRecords(contract.invoices)} />
              <RegisterCard kicker="Payments" title="Payments" records={asRecords(contract.payments)} />
              <RegisterCard kicker="Payments" title="Three-way matches" records={asRecords(contract.threeWayMatches)} />
              <RegisterCard kicker="Payments" title="Penalties and deductions" records={asRecords(contract.penalties)} />
              <RegisterCard kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
              <RegisterCard kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
              <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} />
              <RegisterCard kicker="Risk" title="Non-conformance" records={asRecords(contract.nonConformances)} />
              <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Changes" title="Change requests and amendments" records={asRecords(contract.changeRequests)} />
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
              <RegisterCard kicker="Risk" title="Supplier risk profile" records={contract.supplierRiskProfile ? [contract.supplierRiskProfile as Record<string, unknown>] : []} countLabel="profiles" />
              <RegisterCard kicker="Audit" title="Audit events" records={asRecords(contract.audit)} countLabel="events" />
            </div>
          ) : null}
          </div>
          ) : null}
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
