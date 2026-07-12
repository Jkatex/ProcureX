import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { LockedFlowStepPanel } from './AwardContractFlow';
import { AwardPlainRecordList, ExpandableAwardDetails, notifyAward } from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
  lifecycleActionMatches,
  LifecycleActionCard,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getAwardId(search: string) {
  return new URLSearchParams(search).get('award') || '';
}

function getOpenSection(search: string) {
  return new URLSearchParams(search).get('step') || '';
}

function recommendationIdForAward(award: LifecycleAction | null) {
  if (!award) return '';
  return award.awardId ?? award.id.replace(/^award-/, '');
}

const preContractDocuments = [
  'Performance security',
  'Advance payment guarantee',
  'Insurance',
  'Power of attorney or signatory authorization',
  'Work plan or delivery schedule',
  'Bank details'
];

export function AwardResponseProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedAwardId = useMemo(() => getAwardId(location.search), [location.search]);
  const openSection = useMemo(() => getOpenSection(location.search), [location.search]);
  const [awards, setAwards] = useState<LifecycleAction[]>([]);
  const [awardSearch, setAwardSearch] = useState('');
  const [awardDetail, setAwardDetail] = useState<AwardRecommendationDetailDto | null>(null);
  const [detailError, setDetailError] = useState('');
  const [responseMessages, setResponseMessages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAwards = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await awardsContractsApi.dashboard();
      setAwards(data.queues['awards-received']);
    } catch (error) {
      setAwards([]);
      setLoadError(apiErrorMessage(error, 'Supplier award notices could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAwards();
  }, [loadAwards]);

  const activeAward = awards.find((award) => award.awardId === selectedAwardId || award.id === selectedAwardId) ?? awards[0] ?? null;
  const activeAwardId = recommendationIdForAward(activeAward);
  const filteredAwards = useMemo(() => awards.filter((award) => lifecycleActionMatches(award, awardSearch)), [awardSearch, awards]);

  const loadAwardDetail = useCallback(async (awardId = activeAwardId) => {
    if (!awardId) {
      setAwardDetail(null);
      setDetailError('');
      return;
    }
    setDetailError('');
    try {
      setAwardDetail(await awardsContractsApi.recommendation(awardId));
    } catch (error) {
      setAwardDetail(null);
      setDetailError(apiErrorMessage(error, 'Award response detail could not be refreshed.'));
    }
  }, [activeAwardId]);

  useEffect(() => {
    void loadAwardDetail();
  }, [loadAwardDetail]);

  const access = awardDetail?.access ?? {
    viewerRole: activeAward?.roleContext ?? 'NONE',
    canManageBuyerActions: activeAward?.roleContext === 'BUYER',
    canSubmitSupplierActions: activeAward?.roleContext === 'SUPPLIER',
    canSignBuyer: activeAward?.roleContext === 'BUYER',
    canSignSupplier: activeAward?.roleContext === 'SUPPLIER',
    readOnlyReason: activeAward?.roleContext === 'BUYER' ? 'Supplier actions are read-only for the buyer.' : null
  } as const;
  const noticeReference = awardDetail?.notice?.reference ?? activeAward?.noticeReference ?? 'Not issued';
  const noticeStatus = awardDetail?.notice?.status ?? activeAward?.status ?? 'Not issued';
  const latestPersistedResponse = [...(awardDetail?.notice?.responses ?? [])]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  const responseStatus = latestPersistedResponse?.action ?? responseMessages[activeAward?.id ?? ''] ?? activeAward?.requiredAction ?? 'No response due';
  const contractHandoffId = awardDetail?.notice?.contractId ?? activeAward?.contractId;
  const contractHandoffStatus = contractHandoffId ? 'Contract linked' : 'Pending contract handoff';
  const hasNotice = Boolean(activeAward?.noticeId ?? awardDetail?.notice?.id);

  const responseActivityRecords = useMemo(() => {
    const records: Array<Record<string, unknown>> = [];
    const localMessage = activeAward ? responseMessages[activeAward.id] : '';
    if (localMessage && activeAward) {
      records.push({
        id: `latest-${activeAward.id}`,
        title: 'Latest submitted response',
        status: localMessage.replace(/^Supplier response submitted:\s*/, ''),
        note: localMessage,
        createdAt: new Date().toISOString()
      });
    }
    if (awardDetail?.notice) {
      records.push({
        id: awardDetail.notice.id,
        title: awardDetail.notice.reference ?? 'Award notice',
        status: awardDetail.notice.status,
        note: awardDetail.notice.contractId ? 'Linked contract is ready for preparation' : 'Contract handoff pending',
        createdAt: awardDetail.notice.issuedAt
      });
    }
    for (const response of awardDetail?.notice?.responses ?? []) {
      records.push({
        id: response.id,
        title: `Supplier response - ${response.action}`,
        status: response.action,
        note: response.note || 'No supplier note captured',
        createdAt: response.createdAt
      });
    }
    for (const audit of awardDetail?.audit ?? []) {
      records.push({
        id: `${audit.event}-${audit.createdAt}`,
        title: audit.event,
        status: 'Recorded',
        note: audit.actorUserId ? `Actor ${audit.actorUserId}` : 'System event',
        createdAt: audit.createdAt
      });
    }
    return records;
  }, [activeAward, awardDetail, responseMessages]);

  function selectAward(award: LifecycleAction) {
    navigate(`/awards-contracts/award-response?award=${award.awardId ?? award.id}`);
  }

  async function refreshAwards(awardId = activeAwardId) {
    await loadAwards();
    await loadAwardDetail(awardId);
  }

  async function recordResponse(award: LifecycleAction, payload: Record<string, unknown>) {
    if (!award.noticeId) {
      setResponseMessages((current) => ({ ...current, [award.id]: 'Award notice is not available yet.' }));
      notifyAward('warning', 'Award notice unavailable', 'The selected award does not have an issued notice yet.');
      return;
    }
    const responseAction = String(payload.action) as 'ACCEPT' | 'REQUEST_CLARIFICATION' | 'DECLINE';
    await awardsContractsApi.respondToNotice(award.noticeId, responseAction, String(payload.note ?? ''), payload.payload as Record<string, unknown>);
    setResponseMessages((current) => ({ ...current, [award.id]: `Supplier response submitted: ${responseAction}` }));
    notifyAward('success', 'Supplier response sent', `Response submitted: ${responseAction}.`);
    await refreshAwards(recommendationIdForAward(award));
  }

  return (
    <ProcurexAwardFrame pageKey="award-response">
      <div className="main-layout procurement-layout evaluation-app-layout award-response-page award-simple-page" data-award-contract-workspace data-award-current-step="supplier-acceptance">
        <main className="main-content procurement-content evaluation-workspace award-response-workspace">
          <AwardHero
            kicker="Supplier award response"
            title={activeAward?.title ?? 'Awards received by your organization'}
            copy="Respond to the award first. Supporting notices, documents, contract handoff, and history are below."
            stats={[
              { value: awards.length, label: 'Awards received' },
              { value: activeAward?.status ?? 'None', label: 'Selected award status' },
              { value: activeAward?.currentStage ?? 'None', label: 'Current stage' }
            ]}
          />

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading supplier award notices"
              message="ProcureX is fetching awards received by your organization."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Award notices could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadAwards()}
            />
          ) : null}

          {detailError && activeAward ? (
            <RemoteStatePanel
              kicker="Detail refresh"
              title="Award response detail could not be refreshed"
              message={detailError}
              status="Warning"
              actionLabel="Retry detail"
              onAction={() => void loadAwardDetail()}
            />
          ) : null}

          {!isLoading && !loadError && !activeAward ? (
            <AwardContractAccessProvider access={access}>
              <section className="procurement-panel evaluation-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Respond to award</span><h2>No award selected</h2></div>
                  <StatusBadge value="No records" />
                </div>
                <div className="scope-empty">Award response details will appear here after your organization receives an award.</div>
                <div className="inline-actions">
                  <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=awards-received">Open awards received</button>
                </div>
              </section>
            </AwardContractAccessProvider>
          ) : null}

          {!isLoading && !loadError && activeAward ? (
            <AwardContractAccessProvider access={access}>
              <section className="procurement-panel evaluation-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Respond to award</span>
                    <h2>Respond to award</h2>
                    <p>Accept the award, ask for clarification, or decline it. Required documents and history stay available below.</p>
                  </div>
                  <StatusBadge value={noticeStatus} />
                </div>

                <div className="award-readonly-summary">
                  <article><span>Award</span><strong>{activeAward.title}</strong></article>
                  <article><span>Buyer</span><strong>{activeAward.otherParty}</strong></article>
                  <article><span>Value</span><strong>{activeAward.amount === null ? 'Not priced' : formatMoney(activeAward.amount, activeAward.currency)}</strong></article>
                  <article><span>Notice</span><strong>{noticeReference}</strong></article>
                  <article><span>Response</span><strong>{responseStatus}</strong></article>
                  <article><span>Deadline</span><strong>{activeAward.dueDate ? new Date(activeAward.dueDate).toLocaleDateString() : 'Not dated'}</strong></article>
                  <article><span>Contract</span><strong>{contractHandoffStatus}</strong></article>
                </div>

                {!hasNotice ? (
                  <LockedFlowStepPanel
                    title="Response is locked"
                    reason={{ message: 'The selected award does not have an issued notice yet, so a supplier response cannot be submitted.' }}
                  />
                ) : (
                  <div className="award-simple-form-stack">
                    <ActionFormPanel
                      title="Supplier award response"
                      badge="Supplier"
                      submitLabel="Submit response"
                      fields={[
                        { name: 'action', label: 'Response', kind: 'select', required: true, options: [option('ACCEPT', 'Accept'), option('REQUEST_CLARIFICATION', 'Request clarification'), option('DECLINE', 'Decline')] },
                        { name: 'note', label: 'Message to buyer', kind: 'textarea' },
                        { name: 'payload', label: 'Response payload', kind: 'json', rows: 4 }
                      ]}
                      initialValues={{
                        action: 'ACCEPT',
                        note: 'Award response submitted from ProcureX supplier workspace',
                        payload: JSON.stringify({ source: 'award-response-workspace', awardId: activeAward.awardId ?? activeAward.id }, null, 2)
                      }}
                      onSubmit={(payload) => recordResponse(activeAward, payload)}
                      defaultSelected
                    />
                  </div>
                )}
              </section>

              <section className="award-simple-details-stack" aria-label="Award response supporting details">
                <ExpandableAwardDetails title="Awards received" summary={`${filteredAwards.length} of ${awards.length} awards`} open={openSection === 'award-notice'}>
                  <div className="queue-toolbar">
                    <label>
                      Search
                      <input
                        className="form-input"
                        placeholder="Award, buyer, reference, status, or action"
                        aria-label="Search awards received"
                        value={awardSearch}
                        onChange={(event) => setAwardSearch(event.target.value)}
                      />
                    </label>
                    <span>Showing {filteredAwards.length} of {awards.length}</span>
                  </div>
                  {filteredAwards.length === 0 ? <div className="scope-empty">No supplier awards match the current search.</div> : (
                    <div className="award-lifecycle-card-grid">
                      {filteredAwards.map((award) => (
                        <LifecycleActionCard row={award} actionLabel={award.id === activeAward.id ? 'Selected' : 'Select'} onAction={selectAward} key={award.id} />
                      ))}
                    </div>
                  )}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Required documents" summary={`${preContractDocuments.length} common documents`} open={openSection === 'required-documents'}>
                  <SimpleTable headers={['Document', 'Owner', 'Status', 'Action']}>
                    {preContractDocuments.map((document) => (
                      <tr key={document}>
                        <td><strong>{document}</strong></td>
                        <td>Supplier Representative</td>
                        <td><StatusBadge value="Required" /></td>
                        <td>{contractHandoffId ? 'Use form below' : 'Available after contract draft'}</td>
                      </tr>
                    ))}
                  </SimpleTable>
                  {contractHandoffId ? (
                    <ActionFormPanel
                      title="Pre-contract required document"
                      badge="Document"
                      submitLabel="Submit document"
                      fields={[
                        { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                        { name: 'title', label: 'Title', kind: 'text', required: true },
                        { name: 'ownerRole', label: 'Document owner', kind: 'select', required: true, options: [option('Supplier Representative'), option('Buyer Representative'), option('Contract Manager')] },
                        { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                        { name: 'documentId', label: 'External document reference (optional)', kind: 'uuid', helpText: 'Use only when referencing an uploaded document outside this workflow.' },
                        { name: 'dueDate', label: 'Due date', kind: 'date' },
                        { name: 'reviewedAt', label: 'Reviewed at', kind: 'datetime' },
                        { name: 'note', label: 'Note', kind: 'textarea' },
                        { name: 'payload', label: 'Document payload', kind: 'json', rows: 4 }
                      ]}
                      initialValues={{
                        documentType: 'performance-security',
                        title: 'Performance security',
                        ownerRole: 'Supplier Representative',
                        status: 'SUBMITTED',
                        payload: '{}'
                      }}
                      onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(contractHandoffId, payload)}
                      defaultSelected
                    />
                  ) : <div className="scope-empty">Required document submission becomes available after contract draft creation.</div>}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Contract handoff" summary={contractHandoffId ? 'Contract is linked' : 'Waiting for draft contract'} open={openSection === 'contract-handoff'}>
                  <div className="scope-empty">
                    {contractHandoffId ? 'The award response is linked to a draft contract. Continue without restarting the supplier flow.' : 'The buyer has not linked a draft contract yet.'}
                  </div>
                  {contractHandoffId ? (
                    <div className="inline-actions">
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${contractHandoffId}`)}>Open contract</button>
                    </div>
                  ) : null}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Response history" summary={`${responseActivityRecords.length} records`} open={openSection === 'activity'}>
                  <AwardPlainRecordList records={responseActivityRecords} emptyMessage="No persisted supplier response activity is available yet." />
                </ExpandableAwardDetails>
              </section>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
