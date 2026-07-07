import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto, ContractLifecycleItemDto, FlowStep } from '../../types';
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
  terminationStatusOptions,
  terminationTypeOptions
} from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { AwardContractFlowBar, LockedFlowStepPanel, flowStepFromSearch, searchWithFlowStep } from './AwardContractFlow';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  RemoteStatePanel,
  RegisterCard,
  SimpleTable,
  StatusBadge,
  TopSummary,
  type WorkflowSection
} from './AwardsContractsProcurexShared';

function getContractId(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

type PostAwardGroupId = 'cmp' | 'delivery' | 'inspections' | 'payments' | 'risk' | 'changes' | 'termination' | 'warranty' | 'closeout' | 'performance' | 'registers';
const postAwardFlowStepIds = ['cmp', 'delivery', 'inspections', 'payments', 'risk', 'changes', 'termination', 'warranty', 'closeout', 'performance', 'registers'] as const;

function asRecords(items: Array<Record<string, unknown>> | ContractLifecycleItemDto[] | undefined) {
  return (items ?? []) as Array<Record<string, unknown>>;
}

function overdueCount(items: Array<{ dueDate?: string | null; status?: string | null }>) {
  const today = new Date();
  return items.filter((item) => {
    if (!item.dueDate || /complete|completed|approved|accepted|closed|paid/i.test(item.status ?? '')) return false;
    const due = new Date(item.dueDate);
    return Number.isFinite(due.getTime()) && due < today;
  }).length;
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

export function PostAwardTrackingProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activeGroup = useMemo(() => flowStepFromSearch(location.search, postAwardFlowStepIds, 'cmp'), [location.search]);

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setLoadError('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      setContract(await awardsContractsApi.contract(contractId));
    } catch (error) {
      setContract(null);
      setLoadError(apiErrorMessage(error, 'Post-award contract detail could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  function selectFlowStep(step: PostAwardGroupId) {
    navigate({ pathname: '/awards-contracts/post-award', search: searchWithFlowStep(location.search, step) });
  }

  const today = new Date().toISOString().slice(0, 10);
  const invoices = contract?.invoices ?? [];
  const payments = contract?.payments ?? [];
  const purchaseOrders = contract?.purchaseOrders ?? [];
  const invoiceOptions = recordPickerOptions(invoices, 'Select invoice');
  const paymentOptions = recordPickerOptions(payments, 'Select payment');
  const purchaseOrderOptions = recordPickerOptions(purchaseOrders, 'No linked purchase order');
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
  const openRiskCount = contract?.risks.filter((risk) => !/closed|complete|completed|accepted|approved/i.test(risk.status)).length ?? 0;
  const overdueWorkCount = overdueCount([
    ...(contract?.milestones ?? []),
    ...(contract?.deliverables ?? []),
    ...(contract?.inspections ?? []),
    ...(contract?.risks ?? []),
    ...(contract?.issues ?? [])
  ]);
  const blockedPaymentCount = invoices.filter((invoice) => /blocked|rejected|review/i.test(String(invoice.status ?? ''))).length;
  const changeCount = (contract?.variations.length ?? 0) + (contract?.issues.length ?? 0) + (contract?.disputes.length ?? 0);
  const closeoutState = contract?.closeout ? 'Started' : contract?.status === 'COMPLETED' ? 'Ready' : 'Not ready';
  const sections: Array<WorkflowSection<PostAwardGroupId>> = [
    { id: 'cmp', label: 'CMP', description: 'Plan and status.', count: contract?.managementPlan ? 1 : 0 },
    { id: 'delivery', label: 'Delivery', description: 'Mobilization and milestones.', count: (contract?.mobilizationItems.length ?? 0) + (contract?.milestones.length ?? 0) + (contract?.deliverables?.length ?? 0) },
    { id: 'inspections', label: 'Inspections', description: 'Inspection and acceptance.', count: (contract?.inspections.length ?? 0) + (contract?.goodsInspections?.length ?? 0) + (contract?.acceptances?.length ?? 0) },
    { id: 'payments', label: 'Payments', description: 'Invoices and approvals.', count: invoices.length + payments.length + (contract?.paymentApprovals?.length ?? 0) },
    { id: 'risk', label: 'Risk', description: 'Risks and forecasts.', count: (contract?.risks.length ?? 0) + (contract?.riskForecasts?.length ?? 0) },
    { id: 'changes', label: 'Changes', description: 'Variations, issues, disputes.', count: (contract?.variations.length ?? 0) + (contract?.issues.length ?? 0) + (contract?.disputes.length ?? 0) },
    { id: 'termination', label: 'Termination', description: 'Termination workflow.', count: contract?.terminations.length ?? 0 },
    { id: 'warranty', label: 'Warranty', description: 'Defects and documents.', count: (contract?.warranties?.length ?? 0) + (contract?.requiredDocuments?.length ?? 0) },
    { id: 'closeout', label: 'Close-out', description: 'Completion record.', count: contract?.closeout ? 1 : 0 },
    { id: 'performance', label: 'Performance', description: 'Scores and supplier risk.', count: (contract?.supplierPerformanceRecords.length ?? 0) + (contract?.performanceScores?.length ?? 0) },
    { id: 'registers', label: 'Registers', description: 'All saved records.', count: contract ? 1 : 0 }
  ];
  const formationLocked = Boolean(contract && ['DRAFT', 'NEGOTIATION', 'SIGNATURE_PENDING'].includes(contract.status));
  const activeFlowLock = useMemo(() => {
    const noContract = { message: 'Select an active or closed contract before continuing post-award tracking.', actionLabel: 'Back to Active Contracts', navigatePage: 'awarding-contracts', routeSearch: 'queue=active-contracts' };
    const notReady = { message: 'Execution modules are locked until contract formation and required signatures are complete.', actionLabel: 'Open Contract Formation', navigatePage: 'contract-negotiation', routeSearch: `contract=${contractId}&step=signatures` };
    if (!contract) return noContract;
    if (formationLocked && !['cmp', 'registers'].includes(activeGroup)) return notReady;
    return null;
  }, [activeGroup, contract, contractId, formationLocked]);
  const flowSteps = useMemo<Array<FlowStep<PostAwardGroupId>>>(() => {
    const noContract = { message: 'Select an active or closed contract before continuing post-award tracking.', actionLabel: 'Back to Active Contracts', navigatePage: 'awarding-contracts', routeSearch: 'queue=active-contracts' };
    const notReady = { message: 'Execution modules are locked until contract formation and required signatures are complete.', actionLabel: 'Open Contract Formation', navigatePage: 'contract-negotiation', routeSearch: `contract=${contractId}&step=signatures` };
    return sections.map((section) => {
      const lockedByFormation = formationLocked && !['cmp', 'registers'].includes(section.id);
      const statusLabel = !contract ? 'Locked' : lockedByFormation ? 'Locked' : section.count && section.count > 0 ? 'Complete' : 'Ready';
      return {
        id: section.id,
        label: section.id === 'risk' ? 'Risk' : section.id === 'changes' ? 'Changes' : section.id === 'termination' ? 'Termination' : section.id === 'warranty' ? 'Warranty' : section.label,
        description: section.description,
        summary: `Work on ${section.label.toLowerCase()} for the selected contract without leaving the post-award flow.`,
        count: section.count,
        countLabel: section.id === 'cmp' ? 'plans' : section.id === 'registers' ? 'record groups' : 'records',
        statusLabel,
        status: !contract ? 'locked' : lockedByFormation ? 'locked' : section.count && section.count > 0 ? 'complete' : 'available',
        lockReason: !contract ? noContract : lockedByFormation ? notReady : undefined
      };
    });
  }, [contract, contractId, formationLocked, sections]);

  return (
    <ProcurexAwardFrame pageKey="post-award-tracking">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page" data-award-contract-workspace>
        <AwardSidebar
          title="Post-Award Tracking"
          subtitle={contract?.reference ?? contract?.title ?? (contractId ? 'Loading contract workspace' : 'Select a contract')}
          activeQueue="active-contracts"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=active-contracts">Back to Active Contracts</a></li>}
        />

        <main className="main-content procurement-content post-award-workspace">
          <AwardHero
            kicker="Contract execution and monitoring"
            title={contract?.title ?? 'No active or closed contract selected'}
            copy="Track CMP, mobilization, milestones, inspections, payments, risks, variations, issues, disputes, termination, warranty, close-out, and supplier performance."
            stats={[
              { value: contract?.milestones.length ?? 0, label: 'Milestones' },
              { value: contract?.risks.length ?? 0, label: 'Open risk records' },
              { value: contract?.supplierPerformanceRecords.length ?? 0, label: 'Performance records' }
            ]}
          />

          {contract ? (
            <>
              <TopSummary
                items={[
                  { label: 'Selected Contract', value: contract.reference },
                  { label: 'Buyer', value: contract.buyerName },
                  { label: 'Supplier', value: contract.supplierName ?? 'Supplier pending' },
                  { label: 'Contract Value', value: contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency) },
                  { label: 'Tender', value: contract.tenderReference ?? 'Not linked' },
                  { label: 'Status', value: <StatusBadge value={contract.status} /> }
                ]}
              />
              <section className="post-award-health-grid" aria-label="Post-award health summary">
                <article><span>Milestone progress</span><strong>{contract.milestones.length} tracked</strong></article>
                <article><span>Overdue work</span><strong>{overdueWorkCount}</strong></article>
                <article><span>Payment blockers</span><strong>{blockedPaymentCount}</strong></article>
                <article><span>Open risks</span><strong>{openRiskCount}</strong></article>
                <article><span>Changes/issues</span><strong>{changeCount}</strong></article>
                <article><span>Close-out readiness</span><strong>{closeoutState}</strong></article>
              </section>
            </>
          ) : null}

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
            <section className="procurement-panel evaluation-panel post-award-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Execution workspace</span><h2>No post-award records are available yet.</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">When a contract is signed and activated, post-award tracking records will appear here.</div>
              <div className="inline-actions">
                <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=active-contracts">Back to Active Contracts</button>
              </div>
              <LockedFlowStepPanel
                title="Post-award tracking is locked"
                reason={{ message: 'Choose an active or closed contract to resume post-award tracking.' }}
              />
            </section>
          ) : !isLoading && !loadError && contract ? (
            <AwardContractAccessProvider access={contract.access}>
          <section className="procurement-panel evaluation-panel post-award-panel post-award-cmp-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Post-award workspace</span>
                <h2>Post-award execution wizard</h2>
              </div>
              <StatusBadge value={sections.find((section) => section.id === activeGroup)?.label ?? 'CMP'} />
            </div>
            <AwardContractFlowBar steps={flowSteps} active={activeGroup} onSelect={selectFlowStep} label="Post-award tracking flow" />
          </section>
          {activeFlowLock ? (
            <LockedFlowStepPanel title={`${flowSteps.find((step) => step.id === activeGroup)?.label ?? 'Workflow'} is locked`} reason={activeFlowLock} />
          ) : null}
          {!activeFlowLock ? (
          <div className="post-award-grouped" data-post-award-active-group={activeGroup}>
          {activeGroup === 'cmp' ? (
          <section className="procurement-panel evaluation-panel post-award-panel post-award-forms-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Contract Management Plan</span><h2>Objectives and monitoring</h2></div>
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
                title="Contract Management Plan"
                badge="CMP"
                submitLabel="Save CMP"
                fields={[
                  { name: 'contractManagerId', label: 'Contract manager', kind: 'select', options: contractManagerOptions, helpText: 'Use the current manager when present, or assign later from user administration.' },
                  { name: 'objectives', label: 'Objectives', kind: 'textarea', rows: 4 },
                  { name: 'monitoringPlan', label: 'Monitoring plan', kind: 'textarea', rows: 4 },
                  { name: 'reportingPlan', label: 'Reporting plan', kind: 'textarea', rows: 4 },
                  { name: 'communicationPlan', label: 'Communication plan', kind: 'textarea', rows: 4 },
                  { name: 'payload', label: 'CMP payload', kind: 'json', rows: 4 }
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
                onComplete={refreshContract}
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
                  { name: 'documentId', label: 'External evidence document reference', kind: 'uuid', required: true, helpText: 'Required until the document picker/upload flow is available; paste an existing external document UUID.' },
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
                initialValues={{ inspectionType: 'acceptance', title: 'Inspection and acceptance review', status: 'APPROVED', payload: '{}' }}
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
                initialValues={{ goodsDescription: contract.title, unit: 'each', result: 'APPROVED', payload: '{}' }}
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
                initialValues={{ status: 'APPROVED', currency: contract.currency, payload: '{}' }}
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
                  { name: 'evidenceDocumentId', label: 'External evidence document reference (optional)', kind: 'uuid', helpText: 'Use only when referencing an uploaded payment document outside this workflow.' },
                  { name: 'note', label: 'Payment note', kind: 'textarea' },
                  { name: 'payload', label: 'Payment confirmation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', paymentId: paymentOptions[1]?.value ?? '', paidAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPaymentConfirmation(contract.id, payload)}
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
                  { name: 'documentId', label: 'External evidence document reference (optional)', kind: 'uuid', helpText: 'Use only when referencing an uploaded termination document outside this workflow.' },
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
                title="Required document"
                badge="Document"
                fields={[
                  { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                  { name: 'title', label: 'Title', kind: 'text', required: true },
                  { name: 'ownerRole', label: 'Document owner', kind: 'select', required: true, options: documentOwnerOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'documentId', label: 'External document reference (optional)', kind: 'uuid', helpText: 'Use only when referencing a document stored outside this workflow.' },
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
                  { name: 'payload', label: 'Close-out payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ status: 'APPROVED', completionCertificate: false, finalAccountApproved: false, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertCloseout(contract.id, payload)}
                onComplete={refreshContract}
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
                onComplete={refreshContract}
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
                  { name: 'trustTier', label: 'Trust tier', kind: 'text' },
                  { name: 'activeAlerts', label: 'Active alerts', kind: 'number', min: 0 },
                  { name: 'openViolations', label: 'Open violations', kind: 'number', min: 0 },
                  { name: 'summary', label: 'Risk summary', kind: 'textarea' },
                  { name: 'drivers', label: 'Risk drivers', kind: 'textarea', rows: 4, transform: 'driverArray', helpText: 'Enter one driver per line.' },
                  { name: 'payload', label: 'Supplier risk payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  riskLevel: String(contract.supplierRiskProfile?.riskLevel ?? 'MEDIUM'),
                  riskScore: String(contract.supplierRiskProfile?.riskScore ?? '50'),
                  trustTier: String(contract.supplierRiskProfile?.trustTier ?? 'UNVERIFIED'),
                  activeAlerts: String(contract.supplierRiskProfile?.activeAlerts ?? '0'),
                  openViolations: String(contract.supplierRiskProfile?.openViolations ?? '0'),
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
                <RegisterCard kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
                <RegisterCard kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
              </div>
            ) : null}
            {activeGroup === 'risk' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
                <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} />
              </div>
            ) : null}
            {activeGroup === 'changes' ? (
              <div className="post-award-register-grid">
                <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
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
                <RegisterCard kicker="Warranty" title="Warranty and defects" records={asRecords(contract.warranties as ContractLifecycleItemDto[] | undefined)} />
                <RegisterCard kicker="Warranty" title="Required documents" records={asRecords(contract.requiredDocuments)} />
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
              <RegisterCard kicker="Payments" title="Payment approvals" records={asRecords(contract.paymentApprovals)} />
              <RegisterCard kicker="Payments" title="Payment confirmations" records={asRecords(contract.paymentConfirmations)} />
              <RegisterCard kicker="Risk" title="Risks" records={asRecords(contract.risks as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Risk" title="Risk forecasts" records={asRecords(contract.riskForecasts)} />
              <RegisterCard kicker="Changes" title="Variations" records={asRecords(contract.variations as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Changes" title="Issues" records={asRecords(contract.issues)} />
              <RegisterCard kicker="Changes" title="Disputes" records={asRecords(contract.disputes)} />
              <RegisterCard kicker="Termination" title="Termination" records={asRecords(contract.terminations as ContractLifecycleItemDto[])} />
              <RegisterCard kicker="Warranty" title="Warranty and defects" records={asRecords(contract.warranties as ContractLifecycleItemDto[] | undefined)} />
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
