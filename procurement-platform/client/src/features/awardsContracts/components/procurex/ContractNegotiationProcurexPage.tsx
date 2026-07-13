import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option, signatureOptions } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { LockedFlowStepPanel } from './AwardContractFlow';
import { AwardPlainRecordList, ExpandableAwardDetails } from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getContractId(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

function getOpenSection(search: string) {
  return new URLSearchParams(search).get('step') || '';
}

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
  const contractId = useMemo(() => getContractId(location.search), [location.search]);
  const openSection = useMemo(() => getOpenSection(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

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

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  return (
    <ProcurexAwardFrame pageKey="contract-negotiation">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract preparation"
            title={contract?.title ?? 'No contract record selected'}
            copy="Prepare the contract from the accepted award, approve it, collect signatures, and confirm it is ready to start."
            stats={[
              { value: contract?.amount ?? 0, label: 'Contract value' },
              { value: contract?.status ?? 'None', label: 'Current status' },
              { value: contract?.signatures?.length ?? 0, label: 'Signature actions' }
            ]}
          />

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading contract workspace"
              message="ProcureX is fetching the selected contract, draft, approvals, and signatures."
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
                <div><span className="section-kicker">Prepare contract</span><h2>No contract is in progress.</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">When an award is accepted and a draft contract is generated, contract work will appear here.</div>
              <div className="inline-actions">
                <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=contracts-in-progress">Back to contracts</button>
              </div>
              <LockedFlowStepPanel
                title="Contract work is locked"
                reason={{ message: 'Select a contract from the contracts list to resume preparation.' }}
              />
            </section>
          ) : null}

          {!isLoading && !loadError && contract ? (
            <AwardContractAccessProvider access={contract.access}>
              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Prepare contract</span>
                    <h2>Prepare contract</h2>
                    <p>Start with the contract version. Use the sections below only when you need approvals, signatures, or supporting records.</p>
                  </div>
                  <StatusBadge value={contract.status} />
                </div>

                <div className="award-readonly-summary">
                  <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
                  <article><span>Supplier</span><strong>{contract.supplierName ?? 'Supplier pending'}</strong></article>
                  <article><span>Reference</span><strong>{contract.reference}</strong></article>
                  <article><span>Value</span><strong>{contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency)}</strong></article>
                  <article><span>Tender</span><strong>{contract.tenderReference ?? draftValue(draft?.tender)}</strong></article>
                  <article><span>Pending signatures</span><strong>{pendingSignatures.length}</strong></article>
                </div>

                <SimpleTable headers={['Draft area', 'Captured content', 'Status']} className="contract-draft-summary-table">
                  <tr><td><strong>Parties</strong></td><td>{contract.buyerName} / {contract.supplierName ?? draftValue(draft?.parties)}</td><td><StatusBadge value={contract.supplierName ? 'Ready' : 'Pending'} /></td></tr>
                  <tr><td><strong>Tender</strong></td><td>{contract.tenderReference ?? draftValue(draft?.tender)}</td><td><StatusBadge value={contract.tenderReference || draft?.tender ? 'Ready' : 'Pending'} /></td></tr>
                  <tr><td><strong>Commercial terms</strong></td><td>{contract.amount === null ? draftValue(draft?.financials) : formatMoney(contract.amount, contract.currency)}</td><td><StatusBadge value={contract.amount !== null || draft?.financials ? 'Ready' : 'Pending'} /></td></tr>
                  <tr><td><strong>Terms</strong></td><td>{contract.clauses?.length ? `${contract.clauses.length} terms ready for review` : draftValue(draft?.clauses)}</td><td><StatusBadge value={contract.clauses?.length ? 'Ready' : 'Pending'} /></td></tr>
                  <tr><td><strong>Documents</strong></td><td>{contract.versions?.length ? `${contract.versions.length} contract version records` : 'No external version linked'}</td><td><StatusBadge value={contract.versions?.length ? 'Recorded' : 'Optional'} /></td></tr>
                </SimpleTable>

                <div className="award-simple-form-stack">
                  <ActionFormPanel
                    title="Contract version"
                    badge="Version"
                    submitLabel="Save version"
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
                    defaultSelected
                  />
                </div>
              </section>

              <section className="award-simple-details-stack" aria-label="Contract supporting details">
                <ExpandableAwardDetails title="Review terms" summary={`${contract.clauses?.length ?? 0} terms from the award`} open={openSection === 'clauses'}>
                  <ClauseReviewGrid clauses={contract.clauses} />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Award history" summary={`${contract.negotiations?.length ?? 0} saved records`} open={openSection === 'negotiation'}>
                  <AwardPlainRecordList records={(contract.negotiations ?? []) as Array<Record<string, unknown>>} emptyMessage="No award negotiation history is saved yet." />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Approve contract" summary={`${contract.workflowApprovals?.length ?? 0} approval records`} open={openSection === 'approval'}>
                  <AwardPlainRecordList records={(contract.workflowApprovals ?? []) as Array<Record<string, unknown>>} emptyMessage="No owner approvals are saved yet." />
                  <ActionFormPanel
                    title="Contract owner approval"
                    badge="Owner"
                    submitLabel="Save approval"
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
                    defaultSelected
                  />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Sign contract" summary={`${pendingSignatures.length} pending signature${pendingSignatures.length === 1 ? '' : 's'}`} open={openSection === 'signatures'}>
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
                  <ActionFormPanel
                    title="Signature request"
                    badge="Signature"
                    submitLabel="Request signatures"
                    fields={[
                      { name: 'roles', label: 'Required signature roles', kind: 'multi', required: true, options: signatureOptions() }
                    ]}
                    initialValues={{ roles: ['BUYER', 'SUPPLIER'] }}
                    onSubmit={(payload) => awardsContractsApi.createSignatureRequests(contract.id, payload.roles as Array<'BUYER' | 'SUPPLIER'>)}
                    onComplete={refreshContract}
                    defaultSelected
                  />
                  {(contract.signatures ?? []).map((signature) => (
                    <ActionFormPanel
                      title={`Sign ${signature.role}`}
                      badge={signature.status}
                      submitLabel="Sign contract"
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
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Ready to start" summary={pendingSignatures.length ? 'Waiting for signatures' : 'Activation checks'} open={openSection === 'readiness'}>
                  <SimpleTable headers={['Check', 'Status', 'Action']}>
                    <tr><td><strong>Contract Management Plan</strong></td><td><StatusBadge value={contract.managementPlan ? 'Created' : 'Required'} /></td><td>Assign manager and confirm monitoring plan</td></tr>
                    <tr><td><strong>Milestones</strong></td><td><StatusBadge value={contract.milestones.length > 0 ? 'Created' : 'Required'} /></td><td>Create delivery and payment milestones</td></tr>
                    <tr><td><strong>Mobilization</strong></td><td><StatusBadge value={contract.mobilizationItems.length > 0 ? 'Ready' : 'Required'} /></td><td>Complete or waive required items</td></tr>
                  </SimpleTable>
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Saved records" summary="Terms, approvals, signatures, and parties" open={openSection === 'registers'}>
                  <div className="award-simple-record-grid">
                    <div><h3>Agreed terms</h3><AwardPlainRecordList records={(contract.clauses ?? []) as Array<Record<string, unknown>>} /></div>
                    <div><h3>Approvals</h3><AwardPlainRecordList records={(contract.workflowApprovals ?? []) as Array<Record<string, unknown>>} /></div>
                    <div><h3>Signatures</h3><AwardPlainRecordList records={(contract.signatures ?? []) as Array<Record<string, unknown>>} /></div>
                    <div><h3>Parties</h3><AwardPlainRecordList records={(contract.parties ?? []) as Array<Record<string, unknown>>} /></div>
                  </div>
                </ExpandableAwardDetails>
              </section>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
