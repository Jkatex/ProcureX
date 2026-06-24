import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto, ContractLifecycleItemDto } from '../../types';
import {
  ActionFormPanel,
  contractStatusOptions,
  invoiceStatusOptions,
  itemOptions,
  lifecycleStatusOptions,
  milestoneStatusOptions,
  riskLevelOptions,
  terminationStatusOptions,
  terminationTypeOptions
} from './AwardContractActionForms';
import {
  AwardHero,
  AwardSidebar,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getContractId(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

function LifecycleTable({ title, items }: { title: string; items: ContractLifecycleItemDto[] }) {
  return (
    <section className="procurement-panel evaluation-panel post-award-panel">
      <div className="panel-heading">
        <div><span className="section-kicker">{title}</span><h2>{title}</h2></div>
        <StatusBadge value={`${items.length} records`} />
      </div>
      <SimpleTable headers={['Item', 'Type', 'Status', 'Due / Created', 'Note']}>
        {items.length === 0 ? (
          <tr><td colSpan={5}><div className="scope-empty">No {title.toLowerCase()} records yet.</div></td></tr>
        ) : items.map((item) => (
          <tr key={item.id}>
            <td><strong>{item.title}</strong></td>
            <td>{item.type}</td>
            <td><StatusBadge value={item.status} /></td>
            <td>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()}</td>
            <td>{item.note || 'No note'}</td>
          </tr>
        ))}
      </SimpleTable>
    </section>
  );
}

function recordText(record: Record<string, unknown>, key: string, fallback = '') {
  const value = record[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function recordOptions(records: Array<Record<string, unknown>>, emptyLabel: string) {
  return [
    { value: '', label: emptyLabel },
    ...records.map((record) => ({
      value: recordText(record, 'id'),
      label: `${recordText(record, 'title', recordText(record, 'reference', recordText(record, 'inspectionNo', recordText(record, 'scoreType', recordText(record, 'forecastType', 'Record')))))}${record.status ? ` (${recordText(record, 'status')})` : ''}`
    })).filter((record) => record.value)
  ];
}

function RecordTable({ title, items }: { title: string; items: Array<Record<string, unknown>> }) {
  return (
    <section className="procurement-panel evaluation-panel post-award-panel">
      <div className="panel-heading">
        <div><span className="section-kicker">{title}</span><h2>{title}</h2></div>
        <StatusBadge value={`${items.length} records`} />
      </div>
      <SimpleTable headers={['Record', 'Status', 'Amount / Score', 'Created']}>
        {items.length === 0 ? (
          <tr><td colSpan={4}><div className="scope-empty">No {title.toLowerCase()} records yet.</div></td></tr>
        ) : items.map((item) => (
          <tr key={recordText(item, 'id', JSON.stringify(item))}>
            <td><strong>{recordText(item, 'title', recordText(item, 'reference', recordText(item, 'inspectionNo', recordText(item, 'scoreType', recordText(item, 'forecastType', 'Record')))))}</strong><span>{recordText(item, 'id')}</span></td>
            <td><StatusBadge value={recordText(item, 'status', recordText(item, 'riskLevel', 'Recorded'))} /></td>
            <td>{recordText(item, 'amount', recordText(item, 'paidAmount', recordText(item, 'score', recordText(item, 'probability', '-'))))}</td>
            <td>{recordText(item, 'createdAt') ? new Date(recordText(item, 'createdAt')).toLocaleDateString() : '-'}</td>
          </tr>
        ))}
      </SimpleTable>
    </section>
  );
}

export function PostAwardTrackingProcurexPage() {
  const location = useLocation();
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);

  useEffect(() => {
    let active = true;
    if (!contractId) {
      setContract(null);
      return () => {
        active = false;
      };
    }
    awardsContractsApi.contract(contractId)
      .then((data) => {
        if (active) setContract(data);
      })
      .catch(() => {
        if (active) setContract(null);
      });
    return () => {
      active = false;
    };
  }, [contractId]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  const today = new Date().toISOString().slice(0, 10);
  const invoices = contract?.invoices ?? [];
  const payments = contract?.payments ?? [];
  const invoiceOptions = recordOptions(invoices, 'Select invoice');
  const paymentOptions = recordOptions(payments, 'Select payment');

  return (
    <ProcurexAwardFrame pageKey="post-award-tracking">
      <div className="main-layout procurement-layout evaluation-app-layout post-award-page" data-award-contract-workspace>
        <AwardSidebar
          title="Post-Award Tracking"
          subtitle="No contract selected"
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

          {!contract ? (
            <section className="procurement-panel evaluation-panel post-award-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Execution workspace</span><h2>No post-award records are available yet.</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">When a contract is signed and activated, post-award tracking records will appear here.</div>
              <div className="inline-actions">
                <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=active-contracts">Back to Active Contracts</button>
              </div>
            </section>
          ) : (
            <>
          <section className="procurement-panel evaluation-panel post-award-panel">
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
                  { name: 'contractManagerId', label: 'Contract manager ID', kind: 'uuid' },
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
          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Production action forms</span><h2>Record delivery, payment, risk, variation, dispute, termination, closure, and performance</h2></div>
              <StatusBadge value="All fields" />
            </div>
            <div className="award-control-grid">
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
                  { name: 'documentId', label: 'Document ID', kind: 'uuid', required: true },
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
                  { name: 'inspectorUserId', label: 'Inspector user ID', kind: 'uuid' },
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
                  { name: 'inspectionNo', label: 'Inspection number', kind: 'text', required: true },
                  { name: 'goodsDescription', label: 'Goods description', kind: 'textarea', required: true },
                  { name: 'quantityOrdered', label: 'Quantity ordered', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityReceived', label: 'Quantity received', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityAccepted', label: 'Quantity accepted', kind: 'number', min: 0, step: '0.01' },
                  { name: 'quantityRejected', label: 'Quantity rejected', kind: 'number', min: 0, step: '0.01' },
                  { name: 'unit', label: 'Unit', kind: 'text' },
                  { name: 'location', label: 'Inspection location', kind: 'text' },
                  { name: 'result', label: 'Result', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'inspectedAt', label: 'Inspected at', kind: 'datetime' },
                  { name: 'defects', label: 'Defects JSON array', kind: 'json', rows: 4 },
                  { name: 'note', label: 'Inspection note', kind: 'textarea' },
                  { name: 'payload', label: 'Goods inspection payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ inspectionNo: `GI-${Date.now()}`, goodsDescription: contract.title, unit: 'each', result: 'APPROVED', defects: '[]', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createGoodsInspection(contract.id, payload)}
                onComplete={refreshContract}
              />
              <ActionFormPanel
                title="Acceptance certificate"
                badge="Acceptance"
                fields={[
                  { name: 'deliverableId', label: 'Deliverable', kind: 'select', options: itemOptions(contract.deliverables ?? [], 'No linked deliverable') },
                  { name: 'inspectionId', label: 'Inspection', kind: 'select', options: itemOptions(contract.inspections, 'No linked inspection') },
                  { name: 'certificateNo', label: 'Certificate number', kind: 'text' },
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
                  { name: 'purchaseOrderId', label: 'Purchase order ID', kind: 'uuid' },
                  { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
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
                  { name: 'purchaseOrderId', label: 'Purchase order ID', kind: 'uuid' },
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
                  { name: 'invoiceId', label: 'Invoice ID', kind: 'uuid' },
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
                initialValues={{ status: contract.status === 'TERMINATION_REVIEW' ? 'BLOCKED' : 'REVIEW', grossAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
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
                  { name: 'stepKey', label: 'Step key', kind: 'text', required: true },
                  { name: 'role', label: 'Approver role', kind: 'text', required: true },
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
                  { name: 'evidenceDocumentId', label: 'Evidence document ID', kind: 'uuid' },
                  { name: 'note', label: 'Payment note', kind: 'textarea' },
                  { name: 'payload', label: 'Payment confirmation payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ invoiceId: invoiceOptions[1]?.value ?? '', paymentId: paymentOptions[1]?.value ?? '', paidAmount: contract.amount === null ? '' : String(contract.amount), currency: contract.currency, payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createPaymentConfirmation(contract.id, payload)}
                onComplete={refreshContract}
              />
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
                  { name: 'responsibleUserId', label: 'Responsible user ID', kind: 'uuid' },
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
                  { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
                  { name: 'tenderId', label: 'Tender ID', kind: 'uuid' },
                  { name: 'forecastType', label: 'Forecast type', kind: 'text', required: true },
                  { name: 'horizonDays', label: 'Horizon days', kind: 'number', min: 1, max: 365 },
                  { name: 'probability', label: 'Probability', kind: 'number', min: 0, max: 100, required: true },
                  { name: 'impactLevel', label: 'Impact level', kind: 'select', options: riskLevelOptions },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'drivers', label: 'Drivers JSON array', kind: 'json', rows: 4 },
                  { name: 'recommendation', label: 'Recommendation', kind: 'textarea' },
                  { name: 'payload', label: 'Forecast payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ forecastType: 'delivery-default-risk', horizonDays: '30', probability: '45', impactLevel: 'MEDIUM', status: 'OPEN', drivers: '[]', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.createRiskForecast(contract.id, payload)}
                onComplete={refreshContract}
              />
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
                  { name: 'payload', label: 'Dispute payload', kind: 'json', rows: 4, note: 'Use payload.contractClause and payload.route for dispute route details.' }
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
                  { name: 'documentId', label: 'Document ID', kind: 'uuid' },
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
                  { name: 'method', label: 'Method', kind: 'text', required: true },
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
                  { name: 'responsibleRole', label: 'Responsible role', kind: 'text' },
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
                  { name: 'ownerRole', label: 'Owner role', kind: 'text', required: true },
                  { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                  { name: 'documentId', label: 'Document ID', kind: 'uuid' },
                  { name: 'dueDate', label: 'Due date', kind: 'date' },
                  { name: 'reviewedAt', label: 'Reviewed at', kind: 'datetime' },
                  { name: 'note', label: 'Note', kind: 'textarea' },
                  { name: 'payload', label: 'Required document payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{ documentType: 'performance-security', title: 'Performance security', ownerRole: 'Supplier', status: 'OPEN', payload: '{}' }}
                onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(contract.id, payload)}
                onComplete={refreshContract}
              />
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
                  { name: 'supplierOrgId', label: 'Supplier organization ID', kind: 'uuid' },
                  { name: 'riskLevel', label: 'Risk level', kind: 'select', options: riskLevelOptions },
                  { name: 'riskScore', label: 'Risk score', kind: 'number', min: 0, max: 100 },
                  { name: 'trustTier', label: 'Trust tier', kind: 'text' },
                  { name: 'activeAlerts', label: 'Active alerts', kind: 'number', min: 0 },
                  { name: 'openViolations', label: 'Open violations', kind: 'number', min: 0 },
                  { name: 'summary', label: 'Risk summary', kind: 'textarea' },
                  { name: 'drivers', label: 'Drivers JSON array', kind: 'json', rows: 4 },
                  { name: 'payload', label: 'Supplier risk payload', kind: 'json', rows: 4 }
                ]}
                initialValues={{
                  riskLevel: String(contract.supplierRiskProfile?.riskLevel ?? 'MEDIUM'),
                  riskScore: String(contract.supplierRiskProfile?.riskScore ?? '50'),
                  trustTier: String(contract.supplierRiskProfile?.trustTier ?? 'UNVERIFIED'),
                  activeAlerts: String(contract.supplierRiskProfile?.activeAlerts ?? '0'),
                  openViolations: String(contract.supplierRiskProfile?.openViolations ?? '0'),
                  drivers: JSON.stringify(contract.supplierRiskProfile?.drivers ?? [], null, 2),
                  payload: JSON.stringify(contract.supplierRiskProfile?.payload ?? {}, null, 2)
                }}
                onSubmit={(payload) => awardsContractsApi.upsertSupplierRiskProfile(contract.id, payload)}
                onComplete={refreshContract}
              />
            </div>
          </section>
          <LifecycleTable title="Mobilization" items={contract.mobilizationItems} />
          <LifecycleTable title="Milestones" items={contract.milestones as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Deliverables" items={(contract.deliverables ?? []) as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Inspections" items={contract.inspections} />
          <RecordTable title="Goods inspections" items={contract.goodsInspections ?? []} />
          <LifecycleTable title="Acceptance" items={(contract.acceptances ?? []) as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Payment schedule" items={(contract.paymentSchedules ?? []) as ContractLifecycleItemDto[]} />
          <RecordTable title="Invoices" items={contract.invoices ?? []} />
          <RecordTable title="Payments" items={contract.payments ?? []} />
          <RecordTable title="Three-way matches" items={contract.threeWayMatches ?? []} />
          <RecordTable title="Payment approvals" items={contract.paymentApprovals ?? []} />
          <RecordTable title="Payment confirmations" items={contract.paymentConfirmations ?? []} />
          <LifecycleTable title="Risks" items={contract.risks as ContractLifecycleItemDto[]} />
          <RecordTable title="Risk forecasts" items={contract.riskForecasts ?? []} />
          <LifecycleTable title="Variations" items={contract.variations as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Issues" items={contract.issues} />
          <LifecycleTable title="Disputes" items={contract.disputes} />
          <LifecycleTable title="Termination" items={contract.terminations as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Warranty and defects" items={(contract.warranties ?? []) as ContractLifecycleItemDto[]} />
          <LifecycleTable title="Urgent actions" items={(contract.urgentActions ?? []) as ContractLifecycleItemDto[]} />
          <section className="procurement-panel evaluation-panel post-award-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">Close-out and performance</span><h2>Audit-ready completion record</h2></div>
              <StatusBadge value={contract.closeout ? 'Close-out started' : 'Close-out pending'} />
            </div>
            <SimpleTable headers={['Record', 'Status']}>
              <tr><td><strong>Close-out</strong></td><td>{contract.closeout ? JSON.stringify(contract.closeout) : 'Pending'}</td></tr>
              <tr><td><strong>Supplier performance</strong></td><td>{contract.supplierPerformanceRecords.length} record(s)</td></tr>
              <tr><td><strong>Performance scores</strong></td><td>{contract.performanceScores?.length ?? 0} score(s)</td></tr>
              <tr><td><strong>Supplier risk profile</strong></td><td>{contract.supplierRiskProfile ? JSON.stringify(contract.supplierRiskProfile) : 'Pending'}</td></tr>
              <tr><td><strong>Audit events</strong></td><td>{contract.audit.length} event(s)</td></tr>
            </SimpleTable>
          </section>
            </>
          )}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
