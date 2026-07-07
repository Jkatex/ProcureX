import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto, FlowStep } from '../../types';
import {
  ActionFormPanel,
  itemOptions,
  lifecycleStatusOptions,
  option,
  signatureOptions
} from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { AwardContractFlowBar, LockedFlowStepPanel, flowStepFromSearch, searchWithFlowStep } from './AwardContractFlow';
import {
  ActionWorkspace,
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  RecordRegister,
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

type ContractFormationGroupId = 'draft' | 'clauses' | 'negotiation' | 'approval' | 'signatures' | 'readiness' | 'registers';
const contractFlowStepIds = ['draft', 'clauses', 'negotiation', 'approval', 'signatures', 'readiness', 'registers'] as const;
type ContractFlowStepId = (typeof contractFlowStepIds)[number];

function draftValue(value: unknown, fallback = 'Pending') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? '' : 's'}` : fallback;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
      .slice(0, 4)
      .map(([key, entry]) => `${key}: ${Array.isArray(entry) ? `${entry.length} items` : String(entry)}`);
    return entries.length ? entries.join(' | ') : fallback;
  }
  return String(value);
}

function ClauseReviewGrid({ clauses }: { clauses: ContractDetailDto['clauses'] }) {
  if (!clauses?.length) {
    return <div className="scope-empty">Clauses generated from the award will appear here for buyer, supplier, and legal review.</div>;
  }
  return (
    <div className="contract-clause-review-grid">
      {clauses.map((clause) => {
        const payload = clause.payload ?? {};
        return (
          <article key={clause.id}>
            <div className="contract-clause-card-head">
              <h3>{clause.title}</h3>
              <StatusBadge value={clause.status} />
            </div>
            <p>{clause.note || 'No clause body captured yet.'}</p>
            <dl className="award-detail-list">
              <div><dt>Buyer</dt><dd>{String(payload.buyerComment || 'No buyer comment')}</dd></div>
              <div><dt>Supplier</dt><dd>{String(payload.supplierComment || 'No supplier comment')}</dd></div>
              <div><dt>Legal</dt><dd>{String(payload.legalComment || 'No legal comment')}</dd></div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

export function ContractNegotiationProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const activeGroup = useMemo(() => flowStepFromSearch(location.search, contractFlowStepIds, 'draft'), [location.search]);

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
      setLoadError(apiErrorMessage(error, 'Contract detail could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  const draft = contract?.payload?.draft as Record<string, unknown> | undefined;
  const pendingSignatures = contract?.signatures?.filter((signature) => signature.status !== 'SIGNED') ?? [];
  const activeFlowLock = useMemo(() => {
    const noContract = { message: 'Select a contract before continuing the contract formation flow.', actionLabel: 'Back to Contract Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=contracts-in-progress' };
    const signaturesPending = { message: 'Activation readiness is locked until required contract signatures are completed.', actionLabel: 'Go to Signatures', navigatePage: 'contract-negotiation', routeSearch: `contract=${contractId}&step=signatures` };
    if (!contract) return noContract;
    if (activeGroup === 'readiness' && pendingSignatures.length > 0) return signaturesPending;
    return null;
  }, [activeGroup, contract, contractId, pendingSignatures.length]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  function selectFlowStep(step: ContractFlowStepId) {
    navigate({ pathname: '/awards-contracts/negotiation', search: searchWithFlowStep(location.search, step) });
  }

  const sections: Array<WorkflowSection<ContractFormationGroupId>> = [
    { id: 'draft', label: 'Draft', description: 'Version and generated content.', count: contract ? 1 : 0 },
    { id: 'clauses', label: 'Clauses', description: 'Structured clause review.', count: contract?.clauses?.length ?? 0 },
    { id: 'negotiation', label: 'Negotiation', description: 'Negotiation points.', count: contract?.negotiations?.length ?? 0 },
    { id: 'approval', label: 'Owner Approval', description: 'Single-user approval.', count: contract?.workflowApprovals?.length ?? 0 },
    { id: 'signatures', label: 'Signatures', description: 'Request and sign.', count: contract?.signatures?.length ?? 0 },
    { id: 'readiness', label: 'Readiness', description: 'Activation checks.', count: contract ? 3 : 0 },
    { id: 'registers', label: 'Registers', description: 'All formation records.', count: (contract?.clauses?.length ?? 0) + (contract?.negotiations?.length ?? 0) + (contract?.signatures?.length ?? 0) }
  ];
  const flowSteps = useMemo<Array<FlowStep<ContractFlowStepId>>>(() => {
    const noContract = { message: 'Select a contract before continuing the contract formation flow.', actionLabel: 'Back to Contract Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=contracts-in-progress' };
    const signaturesPending = { message: 'Activation readiness is locked until required contract signatures are completed.', actionLabel: 'Go to Signatures', navigatePage: 'contract-negotiation', routeSearch: `contract=${contractId}&step=signatures` };
    const registerCount = sections.find((section) => section.id === 'registers')?.count ?? 0;
    return [
      { id: 'draft', label: 'Draft', description: 'Generated contract content', summary: 'Review the generated contract draft, parties, commercial terms, dates, and document context.', status: contract ? 'complete' : 'locked', statusLabel: contract ? 'Complete' : 'Locked', count: contract ? 1 : 0, countLabel: 'drafts', lockReason: noContract },
      { id: 'clauses', label: 'Clauses', description: 'Buyer, supplier, and legal review', summary: 'Review clause ownership, comments, status, and the next negotiation action.', status: contract ? 'available' : 'locked', statusLabel: (contract?.clauses?.length ?? 0) > 0 ? 'Needs review' : 'Ready', count: contract?.clauses?.length ?? 0, countLabel: 'clauses', lockReason: noContract },
      { id: 'negotiation', label: 'Negotiation', description: 'Open negotiation points', summary: 'Track open negotiation points and record buyer, supplier, or legal responses.', status: contract ? 'available' : 'locked', statusLabel: (contract?.negotiations?.length ?? 0) > 0 ? 'Needs action' : 'Ready', count: contract?.negotiations?.length ?? 0, countLabel: 'points', lockReason: noContract },
      { id: 'approval', label: 'Approval', description: 'Owner approval', summary: 'Capture owner, legal, finance, or technical approval before signatures.', status: contract?.workflowApprovals?.length ? 'complete' : contract ? 'available' : 'locked', statusLabel: contract?.workflowApprovals?.length ? 'Complete' : 'Needs action', count: contract?.workflowApprovals?.length ?? 0, countLabel: 'approvals', lockReason: noContract },
      { id: 'signatures', label: 'Signatures', description: 'Request and complete signing', summary: 'Request signatures and complete buyer or supplier signing without leaving the flow.', status: !contract ? 'locked' : pendingSignatures.length === 0 && contract.signatures.length > 0 ? 'complete' : 'available', statusLabel: pendingSignatures.length === 0 && (contract?.signatures.length ?? 0) > 0 ? 'Complete' : contract ? 'Needs action' : 'Locked', count: contract?.signatures?.length ?? 0, countLabel: 'signatures', lockReason: noContract },
      { id: 'readiness', label: 'Activation readiness', description: 'Final checks before execution', summary: 'Confirm signatures and activation requirements before post-award execution begins.', status: !contract ? 'locked' : pendingSignatures.length > 0 ? 'locked' : 'available', statusLabel: !contract ? 'Locked' : pendingSignatures.length > 0 ? 'Locked' : 'Ready', count: contract ? 3 : 0, countLabel: 'readiness checks', lockReason: !contract ? noContract : signaturesPending },
      { id: 'registers', label: 'Records', description: 'Formation history', summary: 'Review all contract formation records and audit context in one place.', status: contract ? 'available' : 'locked', statusLabel: contract ? 'Ready' : 'Locked', count: registerCount, countLabel: 'records', lockReason: noContract }
    ];
  }, [contract, contractId, pendingSignatures.length, sections]);

  return (
    <ProcurexAwardFrame pageKey="contract-negotiation">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page" data-award-contract-workspace>
        <AwardSidebar
          title="Contracts in Progress"
          subtitle={contract?.reference ?? contract?.title ?? (contractId ? 'Loading contract workspace' : 'Select a contract')}
          activeQueue="contracts-in-progress"
          extraItems={<li><a href="#" data-navigate="awarding-contracts" data-route-search="queue=contracts-in-progress">Back to Contract Queue</a></li>}
        />

        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract preparation"
            title={contract?.title ?? 'No contract record selected'}
            copy="Contract drafting, structured clause review, owner approval, signature, CMP readiness, and activation checks are managed here."
            stats={[
              { value: contract?.amount ?? 0, label: 'Contract value' },
              { value: contract?.status ?? 'None', label: 'Current status' },
              { value: contract?.signatures?.length ?? 0, label: 'Signature actions' }
            ]}
          />

          {contract ? (
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
          ) : null}

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading contract workspace"
              message="ProcureX is fetching the selected contract, draft, negotiation records, approvals, and signatures."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Contract workspace could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadContract()}
            />
          ) : null}

          {!isLoading && !loadError && !contract ? (
            <section className="procurement-panel evaluation-panel post-award-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Contract workflow</span><h2>No contract is in progress.</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">When an award is accepted and a draft contract is generated, contract review and negotiation details will appear here.</div>
              <div className="inline-actions">
                <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=contracts-in-progress">Back to Contract Queue</button>
              </div>
              <LockedFlowStepPanel
                title="Contract formation is locked"
                reason={{ message: 'Select a contract from the contract queue to resume formation without restarting.' }}
              />
            </section>
          ) : !isLoading && !loadError && contract ? (
            <AwardContractAccessProvider access={contract.access}>
            <section className="procurement-panel evaluation-panel post-award-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Contract formation workspace</span>
                  <h2>Contract formation wizard</h2>
                </div>
                <StatusBadge value={sections.find((section) => section.id === activeGroup)?.label ?? 'Draft'} />
              </div>
              <AwardContractFlowBar steps={flowSteps} active={activeGroup} onSelect={selectFlowStep} label="Contract formation flow" />

              {activeFlowLock ? (
                <LockedFlowStepPanel title={`${flowSteps.find((step) => step.id === activeGroup)?.label ?? 'Workflow'} is locked`} reason={activeFlowLock} />
              ) : null}

              {!activeFlowLock && activeGroup === 'draft' ? (
                <ActionWorkspace
                  kicker="Draft contract"
                  title="Generated from the winning award and tender record"
                  badge={contract.status}
                  context={
                    <>
                      <section className="contract-overview-grid">
                        <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
                        <article><span>Supplier</span><strong>{contract.supplierName ?? 'Supplier pending'}</strong></article>
                        <article><span>Reference</span><strong>{contract.reference}</strong></article>
                        <article><span>Currency</span><strong>{contract.currency}</strong></article>
                      </section>
                      <SimpleTable headers={['Draft area', 'Captured content', 'Status']}>
                        <tr>
                          <td><strong>Parties</strong></td>
                          <td>{contract.buyerName} / {contract.supplierName ?? draftValue(draft?.parties)}</td>
                          <td><StatusBadge value={contract.supplierName ? 'Generated' : 'Pending'} /></td>
                        </tr>
                        <tr>
                          <td><strong>Tender</strong></td>
                          <td>{contract.tenderReference ?? draftValue(draft?.tender)}</td>
                          <td><StatusBadge value={contract.tenderReference || draft?.tender ? 'Generated' : 'Pending'} /></td>
                        </tr>
                        <tr>
                          <td><strong>Commercial terms</strong></td>
                          <td>{contract.amount === null ? draftValue(draft?.financials) : formatMoney(contract.amount, contract.currency)}</td>
                          <td><StatusBadge value={contract.amount !== null || draft?.financials ? 'Generated' : 'Pending'} /></td>
                        </tr>
                        <tr>
                          <td><strong>Clauses</strong></td>
                          <td>{contract.clauses?.length ? `${contract.clauses.length} structured clauses ready for review` : draftValue(draft?.clauses)}</td>
                          <td><StatusBadge value={contract.clauses?.length ? 'Generated' : 'Pending'} /></td>
                        </tr>
                        <tr>
                          <td><strong>Documents</strong></td>
                          <td>{contract.versions?.length ? `${contract.versions.length} contract version records` : 'No external contract version linked'}</td>
                          <td><StatusBadge value={contract.versions?.length ? 'Recorded' : 'Optional'} /></td>
                        </tr>
                      </SimpleTable>
                    </>
                  }
                >
                  <ActionFormPanel
                    title="Contract version"
                    badge="Version"
                    submitLabel="Create Version"
                    fields={[
                      { name: 'documentId', label: 'External document reference (optional)', kind: 'uuid', placeholder: 'Optional external document reference', helpText: 'Use only when referencing a document stored outside this workflow.' },
                      { name: 'payload', label: 'Version payload', kind: 'json', required: true, rows: 7 }
                    ]}
                    initialValues={{
                      payload: JSON.stringify({
                        source: 'contract-negotiation-workspace',
                        title: contract.title,
                        amount: contract.amount,
                        currency: contract.currency,
                        clauses: contract.clauses ?? []
                      }, null, 2)
                    }}
                    onSubmit={(payload) => awardsContractsApi.saveDraft(contract.id, payload)}
                    onComplete={refreshContract}
                  />
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'clauses' ? (
                <ActionWorkspace
                  kicker="Clauses"
                  title="Structured clause review"
                  badge={`${contract.clauses?.length ?? 0} clauses`}
                  context={<ClauseReviewGrid clauses={contract.clauses} />}
                >
                  <ActionFormPanel
                    title="Contract clause"
                    badge="Clause"
                    submitLabel="Save Clause"
                    fields={[
                      { name: 'clauseKey', label: 'Clause key', kind: 'text', required: true },
                      { name: 'title', label: 'Title', kind: 'text', required: true },
                      { name: 'body', label: 'Body', kind: 'textarea', rows: 5 },
                      { name: 'category', label: 'Category', kind: 'text' },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'buyerComment', label: 'Buyer comment', kind: 'textarea' },
                      { name: 'supplierComment', label: 'Supplier comment', kind: 'textarea' },
                      { name: 'legalComment', label: 'Legal comment', kind: 'textarea' },
                      { name: 'payload', label: 'Clause payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{
                      clauseKey: 'negotiated-commercial-terms',
                      title: 'Negotiated commercial terms',
                      category: 'financial',
                      status: 'IN_PROGRESS',
                      payload: '{}'
                    }}
                    onSubmit={(payload) => awardsContractsApi.upsertClause(contract.id, payload)}
                    onComplete={refreshContract}
                  />
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'negotiation' ? (
                <ActionWorkspace
                  kicker="Negotiation"
                  title="Structured negotiation points"
                  badge={`${contract.negotiations?.length ?? 0} records`}
                  context={<RecordRegister title="Negotiation points" records={(contract.negotiations ?? []) as unknown as Array<Record<string, unknown>>} />}
                >
                  <ActionFormPanel
                    title="Negotiation point"
                    badge="Negotiation"
                    submitLabel="Create Negotiation"
                    fields={[
                      { name: 'clauseId', label: 'Clause', kind: 'select', options: itemOptions(contract.clauses ?? [], 'No linked clause') },
                      { name: 'raisedByRole', label: 'Raised by', kind: 'select', required: true, options: [option('Buyer'), option('Supplier'), option('Legal'), option('Contract Owner')] },
                      { name: 'subject', label: 'Subject', kind: 'text', required: true },
                      { name: 'position', label: 'Position', kind: 'textarea' },
                      { name: 'counterOffer', label: 'Counter offer', kind: 'textarea' },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'dueDate', label: 'Due date', kind: 'date' },
                      { name: 'payload', label: 'Negotiation payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{
                      raisedByRole: 'Buyer',
                      subject: 'Structured negotiation point',
                      status: 'OPEN',
                      payload: '{}'
                    }}
                    onSubmit={(payload) => awardsContractsApi.createNegotiation(contract.id, payload)}
                    onComplete={refreshContract}
                  />
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'approval' ? (
                <ActionWorkspace
                  kicker="Owner approval"
                  title="Single-user contract approval"
                  badge={`${contract.workflowApprovals?.length ?? 0} records`}
                  context={<RecordRegister title="Contract owner approvals" records={(contract.workflowApprovals ?? []) as unknown as Array<Record<string, unknown>>} />}
                >
                  <ActionFormPanel
                    title="Contract owner approval"
                    badge="Owner"
                    submitLabel="Save Owner Approval"
                    fields={[
                      { name: 'stepKey', label: 'Step key', kind: 'text', required: true, technical: true },
                      { name: 'role', label: 'Approver role', kind: 'select', required: true, options: [option('Contract Owner'), option('Legal'), option('Finance'), option('Technical')] },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'note', label: 'Note', kind: 'textarea' },
                      { name: 'payload', label: 'Approval payload', kind: 'json', rows: 4 }
                    ]}
                    initialValues={{
                      stepKey: 'contract-owner-approval',
                      role: 'Contract Owner',
                      status: 'APPROVED',
                      payload: JSON.stringify({ model: 'single-user', source: 'contract-negotiation-workspace' }, null, 2)
                    }}
                    onSubmit={(payload) => awardsContractsApi.upsertWorkflowApproval(contract.id, payload)}
                    onComplete={refreshContract}
                  />
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'signatures' ? (
                <ActionWorkspace
                  kicker="Signatures"
                  title="Digital signing status"
                  badge={`${contract.signatures?.length ?? 0} signature records`}
                  context={
                    <>
                      <section className="contract-overview-grid">
                        <article><span>Required parties</span><strong>Buyer and supplier</strong></article>
                        <article><span>Pending signatures</span><strong>{pendingSignatures.length}</strong></article>
                        <article><span>Signature method</span><strong>ProcureX keyphrase</strong></article>
                        <article><span>Blocked reason</span><strong>{pendingSignatures.length ? 'Awaiting signer action' : 'None'}</strong></article>
                      </section>
                      <SimpleTable headers={['Role', 'Signer', 'Status', 'Signed at']}>
                        {(contract.signatures ?? []).length === 0 ? (
                          <tr><td colSpan={4}><div className="scope-empty">No signature requests have been created yet.</div></td></tr>
                        ) : contract.signatures.map((signature) => (
                          <tr key={signature.id}>
                            <td>{signature.role}</td>
                            <td>{signature.signerName || 'Pending signer'}</td>
                            <td><StatusBadge value={signature.status} /></td>
                            <td>{signature.signedAt ? new Date(signature.signedAt).toLocaleString() : 'Not signed'}</td>
                          </tr>
                        ))}
                      </SimpleTable>
                    </>
                  }
                >
                  <ActionFormPanel
                    title="Signature request"
                    badge="Signature"
                    submitLabel="Request Signatures"
                    fields={[
                      { name: 'roles', label: 'Required signature roles', kind: 'multi', required: true, options: signatureOptions() }
                    ]}
                    initialValues={{ roles: ['BUYER', 'SUPPLIER'] }}
                    onSubmit={(payload) => awardsContractsApi.createSignatureRequests(contract.id, payload.roles as Array<'BUYER' | 'SUPPLIER'>)}
                    onComplete={refreshContract}
                  />
                  {(contract.signatures ?? []).map((signature) => (
                    <ActionFormPanel
                      title={`Sign ${signature.role}`}
                      badge={signature.status}
                      submitLabel="Sign Contract"
                      fields={[
                        { name: 'signerName', label: 'Signer name', kind: 'text', required: true },
                        { name: 'signerTitle', label: 'Signer title', kind: 'text' },
                        { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'text', required: true },
                        { name: 'payload', label: 'Signature payload', kind: 'json', rows: 4 }
                      ]}
                      initialValues={{
                        signerName: signature.signerName || '',
                        signerTitle: '',
                        payload: JSON.stringify({ signatureId: signature.id, role: signature.role }, null, 2)
                      }}
                      onSubmit={(payload) => awardsContractsApi.signContractSignature(contract.id, signature.id, {
                        signerName: String(payload.signerName),
                        signerTitle: String(payload.signerTitle ?? ''),
                        signatureKeyphrase: String(payload.signatureKeyphrase),
                        payload: payload.payload as Record<string, unknown>
                      })}
                      onComplete={refreshContract}
                      key={signature.id}
                    />
                  ))}
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'readiness' ? (
                <ActionWorkspace
                  kicker="Contract readiness"
                  title="Activation checks before implementation"
                  badge={contract.managementPlan ? 'CMP ready' : 'CMP pending'}
                  context={
                    <SimpleTable headers={['Check', 'Status', 'Action']}>
                      <tr><td><strong>Contract Management Plan</strong></td><td><StatusBadge value={contract.managementPlan ? 'Created' : 'Required'} /></td><td>Assign manager and confirm monitoring plan</td></tr>
                      <tr><td><strong>Milestones</strong></td><td><StatusBadge value={contract.milestones.length > 0 ? 'Created' : 'Required'} /></td><td>Create delivery/payment milestones</td></tr>
                      <tr><td><strong>Mobilization</strong></td><td><StatusBadge value={contract.mobilizationItems.length > 0 ? 'Checklist ready' : 'Required'} /></td><td>Complete or waive required items</td></tr>
                    </SimpleTable>
                  }
                >
                  <div className="scope-empty">Readiness is calculated from live contract records. Use Post-Award Tracking to complete CMP, milestones, and mobilization.</div>
                </ActionWorkspace>
              ) : null}

              {!activeFlowLock && activeGroup === 'registers' ? (
                <div className="award-register-grid">
                  <RegisterCard kicker="Clauses" title="Contract clauses" records={(contract.clauses ?? []) as unknown as Array<Record<string, unknown>>} />
                  <RegisterCard kicker="Negotiation" title="Negotiation points" records={(contract.negotiations ?? []) as unknown as Array<Record<string, unknown>>} />
                  <RegisterCard kicker="Approvals" title="Owner approval history" records={(contract.workflowApprovals ?? []) as unknown as Array<Record<string, unknown>>} />
                  <RegisterCard kicker="Signatures" title="Signature register" records={(contract.signatures ?? []) as unknown as Array<Record<string, unknown>>} />
                  <RegisterCard kicker="Parties" title="Contract parties" records={(contract.parties ?? []) as Array<Record<string, unknown>>} />
                </div>
              ) : null}
            </section>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
