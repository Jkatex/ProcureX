import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { ContractDetailDto } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option, signatureOptions } from './AwardContractActionForms';
import { AwardContractAccessProvider, canUseWorkflowOwner, useAwardContractAccess } from './AwardContractRoleAccess';
import { LockedFlowStepPanel } from './AwardContractFlow';
import { AwardPlainRecordList, ExpandableAwardDetails, notifyAward } from './AwardContractSimpleShared';
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

type ClauseItem = NonNullable<ContractDetailDto['clauses']>[number];
type NegotiationItem = NonNullable<ContractDetailDto['negotiations']>[number];

function textValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function clauseKey(clause: ClauseItem) {
  return textValue(clause.payload?.clauseKey || clause.id || clause.title).trim();
}

function clauseCategory(clause: ClauseItem) {
  return textValue(clause.payload?.category || 'general').trim() || 'general';
}

function dateValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function AmendmentRecordList({ records = [], clauses = [] }: { records?: NegotiationItem[]; clauses?: ClauseItem[] }) {
  if (!records.length) return <div className="scope-empty">No amendment requests are saved yet.</div>;
  const clauseTitleById = new Map(clauses.map((clause) => [clause.id, clause.title]));
  return (
    <div className="award-simple-record-list contract-amendment-list">
      {records.map((record, index) => {
        const payload = record.payload ?? {};
        const linkedClauseId = textValue(payload.clauseId);
        return (
          <article className="award-simple-record contract-amendment-record" key={record.id || `amendment-${index}`}>
            <div>
              <strong>{record.title || `Amendment request ${index + 1}`}</strong>
              <span>{record.note || textValue(payload.position) || 'No request text saved.'}</span>
              <dl className="award-detail-list">
                <div><dt>Clause</dt><dd>{clauseTitleById.get(linkedClauseId) || linkedClauseId || 'General contract request'}</dd></div>
                <div><dt>Raised by</dt><dd>{record.type || textValue(payload.raisedByRole) || 'Shared'}</dd></div>
                <div><dt>Counter offer</dt><dd>{textValue(payload.counterOffer) || 'Not set'}</dd></div>
                <div><dt>Due date</dt><dd>{record.dueDate ? dateValue(record.dueDate) : 'Not set'}</dd></div>
                <div><dt>Updated</dt><dd>{record.updatedAt ? dateValue(record.updatedAt) : dateValue(record.createdAt)}</dd></div>
              </dl>
            </div>
            <StatusBadge value={record.status} />
          </article>
        );
      })}
    </div>
  );
}

function ClauseReviewGrid({
  contractId,
  clauses,
  onRefresh
}: {
  contractId: string;
  clauses: ContractDetailDto['clauses'];
  onRefresh: (result: unknown) => void;
}) {
  if (!clauses?.length) {
    return <div className="scope-empty">Clauses generated from the award will appear here for buyer, supplier, and legal review.</div>;
  }
  return (
    <div className="contract-clause-review-grid">
      {clauses.map((clause) => (
        <ClauseReviewCard contractId={contractId} clause={clause} onRefresh={onRefresh} key={clause.id} />
      ))}
    </div>
  );
}

function ClauseReviewCard({ contractId, clause, onRefresh }: { contractId: string; clause: ClauseItem; onRefresh: (result: unknown) => void }) {
  const access = useAwardContractAccess();
  const canEditClause = canUseWorkflowOwner(access, 'BUYER');
  const canRequestAmendment = canUseWorkflowOwner(access, 'ANY');
  const payload = clause.payload ?? {};
  const [mode, setMode] = useState<'view' | 'edit' | 'amend'>('view');
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState(() => ({
    title: clause.title,
    body: clause.note || '',
    status: clause.status || 'OPEN',
    buyerComment: textValue(payload.buyerComment),
    supplierComment: textValue(payload.supplierComment),
    legalComment: textValue(payload.legalComment),
    reason: ''
  }));
  const [amendValues, setAmendValues] = useState(() => ({
    subject: `Amend ${clause.title}`,
    position: '',
    counterOffer: '',
    dueDate: ''
  }));

  useEffect(() => {
    setEditValues({
      title: clause.title,
      body: clause.note || '',
      status: clause.status || 'OPEN',
      buyerComment: textValue(clause.payload?.buyerComment),
      supplierComment: textValue(clause.payload?.supplierComment),
      legalComment: textValue(clause.payload?.legalComment),
      reason: ''
    });
    setAmendValues({
      subject: `Amend ${clause.title}`,
      position: '',
      counterOffer: '',
      dueDate: ''
    });
    setMode('view');
  }, [clause.id, clause.note, clause.payload, clause.status, clause.title]);

  function setEdit(name: keyof typeof editValues, value: string) {
    setEditValues((current) => ({ ...current, [name]: value }));
  }

  function setAmend(name: keyof typeof amendValues, value: string) {
    setAmendValues((current) => ({ ...current, [name]: value }));
  }

  async function saveClause(event: { preventDefault: () => void }, nextStatus?: string) {
    event.preventDefault();
    const title = editValues.title.trim();
    if (!title) {
      notifyAward('warning', 'Clause title required', 'Enter a clause title before saving.');
      return;
    }
    setSaving(true);
    try {
      const result = await awardsContractsApi.upsertClause(contractId, {
        clauseKey: clauseKey(clause),
        title,
        body: editValues.body.trim(),
        category: clauseCategory(clause),
        status: nextStatus ?? editValues.status,
        buyerComment: editValues.buyerComment.trim(),
        supplierComment: editValues.supplierComment.trim(),
        legalComment: editValues.legalComment.trim(),
        payload: {
          ...payload,
          clauseKey: clauseKey(clause),
          category: clauseCategory(clause),
          changeReason: editValues.reason.trim()
        }
      });
      notifyAward('success', 'Clause saved', `${title} was updated.`);
      onRefresh(result);
      setMode('view');
    } catch (error) {
      notifyAward('error', 'Clause not saved', apiErrorMessage(error, 'The clause could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function requestAmendment(event: FormEvent) {
    event.preventDefault();
    const subject = amendValues.subject.trim();
    const position = amendValues.position.trim();
    if (!subject || !position) {
      notifyAward('warning', 'Amendment details required', 'Enter a subject and request text before sending the amendment request.');
      return;
    }
    setSaving(true);
    try {
      const result = await awardsContractsApi.createNegotiation(contractId, {
        clauseId: clause.id,
        raisedByRole: access.viewerRole === 'SUPPLIER' ? 'Supplier' : access.viewerRole === 'BUYER' ? 'Buyer' : 'Shared',
        subject,
        position,
        counterOffer: amendValues.counterOffer.trim(),
        status: 'OPEN',
        dueDate: amendValues.dueDate || undefined,
        payload: {
          clauseId: clause.id,
          clauseKey: clauseKey(clause),
          requestedFrom: 'contract-clause-card'
        }
      });
      notifyAward('success', 'Amendment requested', 'The amendment request was saved to the contract.');
      onRefresh(result);
      setMode('view');
    } catch (error) {
      notifyAward('error', 'Amendment not sent', apiErrorMessage(error, 'The amendment request could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="contract-clause-action-card">
      <div className="contract-clause-card-head">
        <div>
          <h3>{clause.title}</h3>
          <em>{clauseCategory(clause)}</em>
        </div>
        <StatusBadge value={clause.status} />
      </div>
      <p>{clause.note || 'No clause body captured yet.'}</p>
      <dl className="award-detail-list">
        <div><dt>Buyer</dt><dd>{textValue(payload.buyerComment) || 'No buyer comment'}</dd></div>
        <div><dt>Supplier</dt><dd>{textValue(payload.supplierComment) || 'No supplier comment'}</dd></div>
        <div><dt>Legal</dt><dd>{textValue(payload.legalComment) || 'No legal comment'}</dd></div>
      </dl>
      <div className="inline-actions contract-clause-actions">
        {canEditClause ? <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>Edit clause</button> : null}
        {canRequestAmendment ? <button className="btn btn-secondary btn-sm" type="button" onClick={() => setMode(mode === 'amend' ? 'view' : 'amend')}>Request amendment</button> : null}
        {canEditClause ? <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={(event) => void saveClause(event, 'APPROVED')}>Approve</button> : null}
        {canEditClause ? <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={(event) => void saveClause(event, 'REJECTED')}>Reject</button> : null}
        {canEditClause ? <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={(event) => void saveClause(event, 'WAIVED')}>Waive</button> : null}
      </div>

      {mode === 'edit' ? (
        <form className="award-action-form contract-clause-inline-form" onSubmit={(event) => void saveClause(event)}>
          <div className="award-readonly-summary">
            <article><span>Current clause</span><strong>{clause.title}</strong></article>
            <article><span>Current status</span><strong>{clause.status}</strong></article>
          </div>
          <div className="award-form-grid">
            <label className="award-form-field">
              <span>Clause title *</span>
              <input className="form-input" value={editValues.title} onChange={(event) => setEdit('title', event.target.value)} />
            </label>
            <label className="award-form-field">
              <span>Status</span>
              <select className="form-input" value={editValues.status} onChange={(event) => setEdit('status', event.target.value)}>
                {lifecycleStatusOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="award-form-field award-form-field-wide">
              <span>Clause text</span>
              <textarea className="form-input" rows={5} value={editValues.body} onChange={(event) => setEdit('body', event.target.value)} />
            </label>
            <label className="award-form-field">
              <span>Buyer comment</span>
              <textarea className="form-input" rows={3} value={editValues.buyerComment} onChange={(event) => setEdit('buyerComment', event.target.value)} />
            </label>
            <label className="award-form-field">
              <span>Supplier comment</span>
              <textarea className="form-input" rows={3} value={editValues.supplierComment} onChange={(event) => setEdit('supplierComment', event.target.value)} />
            </label>
            <label className="award-form-field">
              <span>Legal comment</span>
              <textarea className="form-input" rows={3} value={editValues.legalComment} onChange={(event) => setEdit('legalComment', event.target.value)} />
            </label>
            <label className="award-form-field award-form-field-wide">
              <span>Reason for change</span>
              <input className="form-input" value={editValues.reason} placeholder="Why this clause is being changed" onChange={(event) => setEdit('reason', event.target.value)} />
            </label>
          </div>
          <div className="inline-actions">
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save clause'}</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </form>
      ) : null}

      {mode === 'amend' ? (
        <form className="award-action-form contract-clause-inline-form" onSubmit={(event) => void requestAmendment(event)}>
          <div className="award-readonly-summary">
            <article><span>Clause to amend</span><strong>{clause.title}</strong></article>
            <article><span>Current text</span><strong>{clause.note || 'No clause text saved'}</strong></article>
          </div>
          <div className="award-form-grid">
            <label className="award-form-field">
              <span>Request subject *</span>
              <input className="form-input" value={amendValues.subject} onChange={(event) => setAmend('subject', event.target.value)} />
            </label>
            <label className="award-form-field">
              <span>Due date</span>
              <input className="form-input" type="date" value={amendValues.dueDate} onChange={(event) => setAmend('dueDate', event.target.value)} />
            </label>
            <label className="award-form-field award-form-field-wide">
              <span>Request text *</span>
              <textarea className="form-input" rows={4} value={amendValues.position} placeholder="Explain the change you are requesting." onChange={(event) => setAmend('position', event.target.value)} />
            </label>
            <label className="award-form-field award-form-field-wide">
              <span>Suggested wording</span>
              <textarea className="form-input" rows={3} value={amendValues.counterOffer} placeholder="Optional replacement wording or counter offer." onChange={(event) => setAmend('counterOffer', event.target.value)} />
            </label>
          </div>
          <div className="inline-actions">
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send amendment request'}</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => setMode('view')}>Cancel</button>
          </div>
        </form>
      ) : null}
    </article>
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
  const isPreAwardContract = Boolean(contract && !contract.awardId && !contract.supplierOrgId);
  const viewerRole = contract?.access?.viewerRole ?? 'NONE';
  const canRequestSignatures = viewerRole === 'BUYER' || viewerRole === 'ADMIN';
  const signableSignatures = (contract?.signatures ?? []).filter((signature) => {
    if (signature.status === 'SIGNED') return false;
    if (viewerRole === 'ADMIN') return true;
    return signature.role === viewerRole;
  });
  const readonlySignatureCount = Math.max((contract?.signatures?.length ?? 0) - signableSignatures.length, 0);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
  }

  return (
    <ProcurexAwardFrame pageKey="contract-negotiation">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker={isPreAwardContract ? 'Pre-award contract preparation' : 'Contract preparation'}
            title={contract?.title ?? 'No contract record selected'}
            copy={isPreAwardContract
              ? 'Prepare contract clauses, document versions, and amendment notes after tender publication. Award, supplier, signatures, and execution stay locked until evaluation results are available.'
              : 'Prepare the contract from the accepted award, approve it, collect signatures, and confirm it is ready to start.'}
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
                    <h2>{isPreAwardContract ? 'Prepare contract before award' : 'Prepare contract'}</h2>
                    <p>{isPreAwardContract
                      ? 'Draft the contract document and clauses now. Awarding, supplier acceptance, signatures, and execution controls unlock after evaluation and award.'
                      : 'Start with the contract version. Use the sections below only when you need approvals, signatures, or supporting records.'}</p>
                  </div>
                  <StatusBadge value={contract.status} />
                </div>

                <div className="award-readonly-summary">
                  <article><span>Buyer</span><strong>{contract.buyerName}</strong></article>
                  <article><span>Supplier</span><strong>{contract.supplierName ?? (isPreAwardContract ? 'Locked until award' : 'Supplier pending')}</strong></article>
                  <article><span>Reference</span><strong>{contract.reference}</strong></article>
                  <article><span>Value</span><strong>{contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency)}</strong></article>
                  <article><span>Tender</span><strong>{contract.tenderReference ?? draftValue(draft?.tender)}</strong></article>
                  <article><span>Award status</span><strong>{isPreAwardContract ? 'Awaiting evaluation result' : contract.awardId ? 'Linked' : 'Pending'}</strong></article>
                </div>

                <SimpleTable headers={['Draft area', 'Captured content', 'Status']} className="contract-draft-summary-table">
                  <tr><td><strong>Parties</strong></td><td>{contract.buyerName} / {contract.supplierName ?? (isPreAwardContract ? 'Supplier selected after evaluation' : draftValue(draft?.parties))}</td><td><StatusBadge value={contract.supplierName ? 'Ready' : 'Locked'} /></td></tr>
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
                  <ClauseReviewGrid contractId={contract.id} clauses={contract.clauses} onRefresh={refreshContract} />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Amendment requests" summary={`${contract.negotiations?.length ?? 0} saved request${contract.negotiations?.length === 1 ? '' : 's'}`} open={openSection === 'negotiation'}>
                  <AmendmentRecordList records={contract.negotiations} clauses={contract.clauses} />
                  <ActionFormPanel
                    title="New amendment request"
                    badge="Amendment"
                    submitLabel="Save request"
                    fields={[
                      { name: 'clauseId', label: 'Related clause', kind: 'select', options: [option('', 'General contract request'), ...(contract.clauses ?? []).map((clause) => option(clause.id, clause.title))], helpText: 'Choose the clause if this request is about one specific term.' },
                      { name: 'raisedByRole', label: 'Raised by', kind: 'select', required: true, options: [option('Buyer'), option('Supplier'), option('Shared')] },
                      { name: 'subject', label: 'Request subject', kind: 'text', required: true },
                      { name: 'position', label: 'Request text', kind: 'textarea', required: true, rows: 4 },
                      { name: 'counterOffer', label: 'Suggested wording', kind: 'textarea', rows: 3 },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'dueDate', label: 'Due date', kind: 'date' },
                      { name: 'payload', label: 'Advanced payload', kind: 'json', advanced: true, rows: 4 }
                    ]}
                    initialValues={{
                      raisedByRole: contract.access?.viewerRole === 'SUPPLIER' ? 'Supplier' : contract.access?.viewerRole === 'BUYER' ? 'Buyer' : 'Shared',
                      status: 'OPEN',
                      payload: JSON.stringify({ source: 'contract-amendment-request' }, null, 2)
                    }}
                    onSubmit={(payload) => awardsContractsApi.createNegotiation(contract.id, payload)}
                    onComplete={refreshContract}
                    defaultSelected={(contract.negotiations?.length ?? 0) === 0 && openSection === 'negotiation'}
                  />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Required documents" summary={`${contract.requiredDocuments?.length ?? 0} document requirement${contract.requiredDocuments?.length === 1 ? '' : 's'}`} open={openSection === 'documents'}>
                  <AwardPlainRecordList records={(contract.requiredDocuments ?? []) as Array<Record<string, unknown>>} emptyMessage="No required contract documents are saved yet." />
                  <ActionFormPanel
                    title="Required document"
                    badge="Document"
                    submitLabel="Save document requirement"
                    fields={[
                      { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                      { name: 'title', label: 'Title', kind: 'text', required: true },
                      { name: 'ownerRole', label: 'Owner', kind: 'select', required: true, options: [option('Supplier Representative'), option('Buyer Representative'), option('Contract Manager'), option('Legal'), option('Finance')] },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'documentId', label: 'Linked document reference', kind: 'uuid', placeholder: 'Optional document reference' },
                      { name: 'dueDate', label: 'Due date', kind: 'date' },
                      { name: 'note', label: 'Note', kind: 'textarea' },
                      { name: 'payload', label: 'Document payload', kind: 'json', advanced: true, rows: 4 }
                    ]}
                    initialValues={{
                      documentType: '',
                      title: '',
                      ownerRole: 'Supplier Representative',
                      status: 'OPEN',
                      payload: JSON.stringify({ source: isPreAwardContract ? 'pre-award-contract-preparation' : 'contract-negotiation-workspace' }, null, 2)
                    }}
                    onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(contract.id, payload)}
                    onComplete={refreshContract}
                  />
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
                  {isPreAwardContract ? (
                    <LockedFlowStepPanel
                      title="Signatures are locked"
                      reason={{ message: 'Evaluation results, award confirmation, and supplier acceptance are required before signatures can be requested.' }}
                    />
                  ) : (
                    <>
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
                      {readonlySignatureCount ? (
                        <div className="scope-empty">{readonlySignatureCount} signature record{readonlySignatureCount === 1 ? ' is' : 's are'} shown as read-only progress for the other party.</div>
                      ) : null}
                      {canRequestSignatures ? (
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
                      ) : null}
                      {signableSignatures.length === 0 ? (
                        <div className="scope-empty">No pending signature is assigned to your side right now.</div>
                      ) : null}
                      {signableSignatures.map((signature) => (
                        <ActionFormPanel
                          title={`Sign ${signature.role}`}
                          badge={signature.status}
                          submitLabel="Sign contract"
                          fields={[
                            { name: 'signerName', label: 'Signer name', kind: 'text', required: true },
                            { name: 'signerTitle', label: 'Signer title', kind: 'text' },
                            { name: 'signatureKeyphrase', label: 'Signature keyphrase', kind: 'password', required: true, helpText: 'Enter the active signing keyphrase for this account. ProcureX sends it only to sign this contract action.' },
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
                    </>
                  )}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Ready to start" summary={pendingSignatures.length ? 'Waiting for signatures' : 'Activation checks'} open={openSection === 'readiness'}>
                  {isPreAwardContract ? (
                    <LockedFlowStepPanel
                      title="Execution readiness is locked"
                      reason={{ message: 'Execution readiness opens after evaluation results, supplier acceptance, approvals, and signatures are complete.' }}
                    />
                  ) : (
                    <SimpleTable headers={['Check', 'Status', 'Action']}>
                      <tr><td><strong>Contract Management Plan</strong></td><td><StatusBadge value={contract.managementPlan ? 'Created' : 'Required'} /></td><td>Assign manager and confirm monitoring plan</td></tr>
                      <tr><td><strong>Milestones</strong></td><td><StatusBadge value={contract.milestones.length > 0 ? 'Created' : 'Required'} /></td><td>Create delivery and payment milestones</td></tr>
                      <tr><td><strong>Mobilization</strong></td><td><StatusBadge value={contract.mobilizationItems.length > 0 ? 'Ready' : 'Required'} /></td><td>Complete or waive required items</td></tr>
                    </SimpleTable>
                  )}
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
