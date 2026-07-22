/* Renders the awards Contracts Contract Negotiation ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardContractDocumentDto, ContractDetailDto, ContractLifecycleItemDto } from '../../types';
import { ActionFormPanel } from './AwardContractActionForms';
import { notifyAward } from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

type ClauseItem = NonNullable<ContractDetailDto['clauses']>[number];
type NegotiationItem = NonNullable<ContractDetailDto['negotiations']>[number];

const closedStatuses = new Set(['APPROVED', 'REJECTED', 'WAIVED', 'CLOSED']);

function contractIdFromSearch(search: string) {
  return new URLSearchParams(search).get('contract') || '';
}

function textValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function payloadValue(record: ContractLifecycleItemDto | undefined, key: string) {
  const value = record?.payload?.[key];
  return value === null || value === undefined ? '' : String(value);
}

function clauseCategory(clause: ClauseItem) {
  return textValue(clause.payload?.category || clause.type || 'general') || 'general';
}

function clauseBody(clause: ClauseItem) {
  return clause.note || textValue(clause.payload?.body);
}

function finalDraftAcceptanceRole(record: ContractLifecycleItemDto) {
  if (!['APPROVED', 'CLOSED'].includes(record.status)) return '';
  if (payloadValue(record, 'acceptanceType') !== 'NEGOTIATED_DRAFT') return '';
  return payloadValue(record, 'role').toUpperCase();
}

function openNegotiationRecords(records: ContractLifecycleItemDto[] = []) {
  return records.filter((record) => !closedStatuses.has(record.status));
}

function requestType(record: NegotiationItem) {
  return textValue(record.payload?.requestType || '').toUpperCase() === 'CLARIFICATION' ? 'CLARIFICATION' : 'AMENDMENT';
}

function latestLinkedDocument(contract: ContractDetailDto | null, documents: AwardContractDocumentDto[]) {
  const latest = [...(contract?.versions ?? [])].filter((version) => version.documentId).sort((left, right) => right.versionNo - left.versionNo)[0];
  return latest?.documentId ? documents.find((document) => document.id === latest.documentId) ?? null : null;
}

function ContractReviewDocument({ contract }: { contract: ContractDetailDto }) {
  return (
    <article className="contract-drafting-document">
      <header>
        <span>Supplier Review Draft</span>
        <h2>{contract.title}</h2>
        <p>{contract.reference}</p>
      </header>
      <section>
        <h3>Parties and Tender</h3>
        <p><strong>Buyer:</strong> {contract.buyerName}</p>
        <p><strong>Supplier:</strong> {contract.supplierName ?? 'Supplier pending'}</p>
        <p><strong>Tender:</strong> {contract.tenderReference ?? contract.tenderId ?? 'Not linked'}</p>
        <p><strong>Value:</strong> {contract.amount === null ? 'Not priced' : formatMoney(contract.amount, contract.currency)}</p>
      </section>
      <section>
        <h3>Contract Clauses</h3>
        {(contract.clauses ?? []).length ? contract.clauses?.map((clause) => (
          <div className="contract-drafting-clause" key={clause.id}>
            <span>{clauseCategory(clause)}</span>
            <h4>{clause.title}</h4>
            <p>{clauseBody(clause) || 'No wording saved for this clause.'}</p>
          </div>
        )) : <p>No clauses are available for review.</p>}
      </section>
    </article>
  );
}

function SupplierRequestForm({ contract, onRefresh }: { contract: ContractDetailDto; onRefresh: (result: unknown) => void }) {
  const [values, setValues] = useState({
    requestType: 'CLARIFICATION',
    clauseId: '',
    subject: '',
    position: '',
    counterOffer: '',
    dueDate: ''
  });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.subject.trim() || !values.position.trim()) {
      notifyAward('warning', 'Request details required', 'Enter the request and reason.');
      return;
    }
    setSaving(true);
    try {
      const result = await awardsContractsApi.createNegotiation(contract.id, {
        clauseId: values.clauseId || undefined,
        raisedByRole: 'Supplier',
        requestType: values.requestType,
        subject: values.subject.trim(),
        position: values.position.trim(),
        counterOffer: values.counterOffer.trim(),
        dueDate: values.dueDate || undefined,
        status: 'OPEN',
        payload: {
          requestType: values.requestType,
          clauseId: values.clauseId || null,
          source: 'supplier-contract-review'
        }
      });
      notifyAward('success', 'Request sent', 'The buyer can now review this contract request.');
      setValues({ requestType: 'CLARIFICATION', clauseId: '', subject: '', position: '', counterOffer: '', dueDate: '' });
      onRefresh(result);
    } catch (error) {
      notifyAward('error', 'Request not sent', apiErrorMessage(error, 'The contract request could not be sent.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="award-action-form contract-negotiation-request-form" onSubmit={(event) => void submit(event)}>
      <div className="award-form-grid">
        <label className="award-form-field">
          <span>Request type</span>
          <select className="form-input" value={values.requestType} onChange={(event) => setValues((current) => ({ ...current, requestType: event.target.value }))}>
            <option value="CLARIFICATION">Clarification request</option>
            <option value="AMENDMENT">Amendment request</option>
          </select>
        </label>
        <label className="award-form-field">
          <span>Clause or section</span>
          <select className="form-input" value={values.clauseId} onChange={(event) => setValues((current) => ({ ...current, clauseId: event.target.value }))}>
            <option value="">General contract section</option>
            {(contract.clauses ?? []).map((clause) => <option value={clause.id} key={clause.id}>{clause.title}</option>)}
          </select>
        </label>
        <label className="award-form-field award-form-field-wide">
          <span>Where clarification or amendment is needed</span>
          <input className="form-input" value={values.subject} onChange={(event) => setValues((current) => ({ ...current, subject: event.target.value }))} />
        </label>
        <label className="award-form-field award-form-field-wide">
          <span>Reason and details</span>
          <textarea className="form-input" rows={5} value={values.position} onChange={(event) => setValues((current) => ({ ...current, position: event.target.value }))} />
        </label>
        {values.requestType === 'AMENDMENT' ? (
          <label className="award-form-field award-form-field-wide">
            <span>Suggested replacement wording</span>
            <textarea className="form-input" rows={4} value={values.counterOffer} onChange={(event) => setValues((current) => ({ ...current, counterOffer: event.target.value }))} />
          </label>
        ) : null}
        <label className="award-form-field">
          <span>Requested response date</span>
          <input className="form-input" type="date" value={values.dueDate} onChange={(event) => setValues((current) => ({ ...current, dueDate: event.target.value }))} />
        </label>
      </div>
      <div className="inline-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Sending...' : 'Send request'}</button>
      </div>
    </form>
  );
}

function RequestDecisionCard({ contract, request, clauses, canDecide, onRefresh }: { contract: ContractDetailDto; request: NegotiationItem; clauses: ClauseItem[]; canDecide: boolean; onRefresh: (result: unknown) => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const clause = clauses.find((item) => item.id === textValue(request.payload?.clauseId));
  const isOpen = !closedStatuses.has(request.status);

  async function decide(status: 'APPROVED' | 'REJECTED' | 'CLOSED') {
    if (!reason.trim()) {
      notifyAward('warning', 'Decision reason required', 'Enter the reason or explanation for this decision.');
      return;
    }
    setSaving(true);
    try {
      const result = await awardsContractsApi.updateNegotiation(contract.id, request.id, {
        status,
        reason: reason.trim(),
        payload: {
          decisionSource: 'buyer-negotiation-review',
          requestType: requestType(request)
        }
      });
      notifyAward('success', 'Request updated', status === 'APPROVED' && requestType(request) === 'AMENDMENT' ? 'The amendment was accepted and the contract needs redrafting.' : 'The request decision was saved.');
      setReason('');
      onRefresh(result);
    } catch (error) {
      notifyAward('error', 'Decision not saved', apiErrorMessage(error, 'The request decision could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="award-simple-record contract-amendment-record">
      <div>
        <div className="inline-actions">
          <StatusBadge value={requestType(request)} />
          <StatusBadge value={request.status} />
        </div>
        <h3>{request.title}</h3>
        <p>{request.note || 'No details saved.'}</p>
        <dl className="award-detail-list">
          <div><dt>Clause / section</dt><dd>{clause?.title ?? (textValue(request.payload?.clauseId) || 'General contract section')}</dd></div>
          <div><dt>Raised by</dt><dd>{request.type || 'Supplier'}</dd></div>
          <div><dt>Suggested wording</dt><dd>{textValue(request.payload?.counterOffer) || 'Not provided'}</dd></div>
          <div><dt>Decision reason</dt><dd>{textValue(request.payload?.decisionReason) || 'No decision yet'}</dd></div>
        </dl>
      </div>
      {isOpen && canDecide ? (
        <div className="contract-negotiation-decision">
          <label className="award-form-field">
            <span>Buyer reason / explanation</span>
            <textarea className="form-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="inline-actions">
            <button className="btn btn-primary btn-sm" type="button" disabled={saving} onClick={() => void decide('APPROVED')}>Accept request</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => void decide('REJECTED')}>Reject request</button>
            <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => void decide('CLOSED')}>Close clarification</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ContractNegotiationProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const contractId = useMemo(() => contractIdFromSearch(location.search), [location.search]);
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [documents, setDocuments] = useState<AwardContractDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadContract = useCallback(async () => {
    if (!contractId) {
      setContract(null);
      setDocuments([]);
      setLoadError('');
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const nextContract = await awardsContractsApi.contract(contractId);
      setContract(nextContract);
      setDocuments(await awardsContractsApi.contractDocuments(contractId));
    } catch (error) {
      setContract(null);
      setDocuments([]);
      setLoadError(apiErrorMessage(error, 'Contract negotiation could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void loadContract();
  }, [loadContract]);

  function refreshContract(result: unknown) {
    setContract(result as ContractDetailDto);
    void awardsContractsApi.contractDocuments(contractId).then(setDocuments).catch(() => undefined);
  }

  const viewerRole = contract?.access?.viewerRole ?? 'NONE';
  const buyer = viewerRole === 'BUYER' || viewerRole === 'ADMIN';
  const supplier = viewerRole === 'SUPPLIER';
  const openRequests = openNegotiationRecords(contract?.negotiations ?? []);
  const finalDraftAcceptanceRoles = new Set((contract?.acceptances ?? []).map(finalDraftAcceptanceRole).filter(Boolean));
  const buyerAcceptedFinalDraft = finalDraftAcceptanceRoles.has('BUYER');
  const supplierAcceptedFinalDraft = finalDraftAcceptanceRoles.has('SUPPLIER');
  const finalDraftReady = Boolean(contract && openRequests.length === 0 && buyerAcceptedFinalDraft && supplierAcceptedFinalDraft);
  const outcomeCommunicationsConfirmed = (contract?.workflowApprovals ?? []).some((record) =>
    record.title === 'outcome-communications' && ['APPROVED', 'CLOSED'].includes(record.status)
  );
  const linkedDocument = latestLinkedDocument(contract, documents);
  const redraftRequired = Boolean(contract?.payload?.redraftRequired);

  return (
    <ProcurexAwardFrame pageKey="contract-negotiation">
      <div className="main-layout procurement-layout evaluation-app-layout contract-page award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace contract-workspace">
          <AwardHero
            kicker="Contract Negotiation"
            title={contract?.title ?? 'No contract selected'}
            copy="Review the draft and resolve requests."
            stats={[
              { value: String(contract?.versions?.length ?? 0), label: 'Draft versions' },
              { value: String(openRequests.length), label: 'Open requests' },
              { value: contract?.status ?? 'Negotiation', label: 'Status' }
            ]}
          />

          {!contractId ? (
            <RemoteStatePanel
              kicker="No contract"
              title="Open a contract in negotiation"
              message="Choose a contract in negotiation."
              status="Ready"
              actionLabel="Back to negotiations"
              onAction={() => navigate('/awards-contracts?queue=contracts-in-progress')}
            />
          ) : null}

          {isLoading ? <RemoteStatePanel kicker="Loading" title="Loading negotiation" message="Loading contract details." status="Loading" /> : null}
          {loadError ? <RemoteStatePanel kicker="Service status" title="Contract negotiation could not be loaded" message={loadError} status="Error" actionLabel="Retry loading" onAction={() => void loadContract()} /> : null}

          {!isLoading && !loadError && contract ? (
            <>
              {redraftRequired ? (
                <RemoteStatePanel
                  kicker="Redraft required"
                  title="Buyer accepted an amendment"
                  message="Update the draft and send it again."
                  status="Action required"
                  actionLabel="Open Contract Drafting"
                  onAction={() => navigate(`/awards-contracts/drafting?contract=${contract.id}`)}
                />
              ) : null}

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Draft Review</span><h2>Contract draft for supplier review</h2></div>
                  <StatusBadge value={linkedDocument ? 'Document linked' : 'Template preview'} />
                </div>
                {linkedDocument ? (
                  <div className="inline-actions">
                    <a className="btn btn-primary btn-sm" href={linkedDocument.contentUrl} target="_blank" rel="noreferrer">Open draft document</a>
                    <a className="btn btn-secondary btn-sm" href={linkedDocument.contentUrl} download>Download draft</a>
                  </div>
                ) : null}
                <ContractReviewDocument contract={contract} />
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Clarifications and Amendments</span><h2>Requests and decisions</h2></div>
                  <StatusBadge value={`${openRequests.length} open`} />
                </div>
                {(contract.negotiations ?? []).length ? (
                  <div className="award-simple-record-list contract-amendment-list">
                    {contract.negotiations?.map((request) => (
                      <RequestDecisionCard contract={contract} request={request} clauses={contract.clauses ?? []} canDecide={buyer} onRefresh={refreshContract} key={request.id} />
                    ))}
                  </div>
                ) : <div className="scope-empty">No clarification or amendment requests have been submitted yet.</div>}

                {supplier && !redraftRequired ? (
                  <>
                    <h3>Send a request</h3>
                    <SupplierRequestForm contract={contract} onRefresh={refreshContract} />
                  </>
                ) : null}
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Final Draft Acceptance</span><h2>Confirm the negotiated draft</h2></div>
                  <StatusBadge value={openRequests.length ? 'Requests open' : 'Ready'} />
                </div>
                <SimpleTable headers={['Party', 'Status']}>
                  <tr><td><strong>Buyer</strong></td><td><StatusBadge value={buyerAcceptedFinalDraft ? 'Accepted' : 'Pending'} /></td></tr>
                  <tr><td><strong>Supplier</strong></td><td><StatusBadge value={supplierAcceptedFinalDraft ? 'Accepted' : 'Pending'} /></td></tr>
                </SimpleTable>
                {openRequests.length ? <div className="scope-empty">Resolve open requests first.</div> : null}
                <div className="award-simple-form-stack">
                  {!buyerAcceptedFinalDraft && buyer && openRequests.length === 0 && !redraftRequired ? (
                    <ActionFormPanel
                      title="Accept final draft"
                      badge="Buyer"
                      submitLabel="Accept as buyer"
                      fields={[{ name: 'note', label: 'Acceptance note', kind: 'textarea', required: true, rows: 3 }]}
                      initialValues={{ note: 'Buyer accepts the negotiated final draft.' }}
                      onSubmit={(payload) => awardsContractsApi.createAcceptance(contract.id, {
                        status: 'APPROVED',
                        currency: contract.currency,
                        note: String(payload.note ?? ''),
                        payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'BUYER', contractVersionCount: contract.versions?.length ?? 0 }
                      })}
                      onComplete={refreshContract}
                    />
                  ) : null}
                  {!supplierAcceptedFinalDraft && supplier && openRequests.length === 0 && !redraftRequired ? (
                    <ActionFormPanel
                      title="Accept final draft"
                      badge="Supplier"
                      submitLabel="Accept as supplier"
                      fields={[{ name: 'note', label: 'Acceptance note', kind: 'textarea', required: true, rows: 3 }]}
                      initialValues={{ note: 'Supplier accepts the negotiated final draft.' }}
                      onSubmit={(payload) => awardsContractsApi.createAcceptance(contract.id, {
                        status: 'APPROVED',
                        currency: contract.currency,
                        note: String(payload.note ?? ''),
                        payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'SUPPLIER', contractVersionCount: contract.versions?.length ?? 0 }
                      })}
                      onComplete={refreshContract}
                    />
                  ) : null}
                </div>
              </section>

              <section className="procurement-panel evaluation-panel post-award-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Next Step</span><h2>Outcome communications and signing</h2></div>
                  <StatusBadge value={finalDraftReady ? 'Ready' : 'Locked'} />
                </div>
                {!finalDraftReady ? (
                  <div className="scope-empty">Both sides must accept the final draft first.</div>
                ) : outcomeCommunicationsConfirmed ? (
                  <div className="inline-actions">
                    <button className="btn btn-primary" type="button" onClick={() => navigate(`/awards-contracts/signing?contract=${contract.id}`)}>Open Contract Signing</button>
                  </div>
                ) : buyer ? (
                  <ActionFormPanel
                    title="Confirm outcome communications"
                    badge="Buyer"
                    submitLabel="Confirm notices sent"
                    fields={[{ name: 'note', label: 'Confirmation note', kind: 'textarea', required: true, rows: 3 }]}
                    initialValues={{ note: 'Winner confirmation and non-winning supplier notices have been prepared or sent.' }}
                    onSubmit={(payload) => awardsContractsApi.upsertWorkflowApproval(contract.id, {
                      stepKey: 'outcome-communications',
                      role: 'Buyer',
                      status: 'APPROVED',
                      note: String(payload.note ?? ''),
                      payload: { source: 'contract-outcome-communications' }
                    })}
                    onComplete={refreshContract}
                  />
                ) : (
                  <div className="scope-empty">Waiting for buyer to confirm outcome communications.</div>
                )}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
