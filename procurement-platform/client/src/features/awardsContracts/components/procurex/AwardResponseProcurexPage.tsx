import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, FlowStep, LifecycleAction } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { AwardContractFlowBar, FlowChangeAlert, LockedFlowStepPanel, flowStepFromSearch, searchWithFlowStep } from './AwardContractFlow';
import {
  ActionWorkspace,
  AwardHero,
  AwardSidebar,
  formatMoney,
  lifecycleActionMatches,
  LifecycleActionCard,
  ProcurexAwardFrame,
  RecordRegister,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

function getAwardId(search: string) {
  return new URLSearchParams(search).get('award') || '';
}

function recommendationIdForAward(award: LifecycleAction | null) {
  if (!award) return '';
  return award.awardId ?? award.id.replace(/^award-/, '');
}

const preContractDocuments = [
  'Performance security',
  'Advance payment guarantee',
  'Insurance',
  'Power of attorney / signatory authorization',
  'Work plan or delivery schedule',
  'Bank details'
];

type AwardResponseGroupId = 'awards' | 'response' | 'documents' | 'registers';
const awardResponseStepIds = ['award-notice', 'response', 'required-documents', 'activity', 'contract-handoff'] as const;
type AwardResponseStepId = (typeof awardResponseStepIds)[number];
const awardResponseStepToGroup: Record<AwardResponseStepId, AwardResponseGroupId> = {
  'award-notice': 'awards',
  response: 'response',
  'required-documents': 'documents',
  activity: 'registers',
  'contract-handoff': 'documents'
};

export function AwardResponseProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedAwardId = useMemo(() => getAwardId(location.search), [location.search]);
  const [awards, setAwards] = useState<LifecycleAction[]>([]);
  const [awardSearch, setAwardSearch] = useState('');
  const [awardDetail, setAwardDetail] = useState<AwardRecommendationDetailDto | null>(null);
  const [detailError, setDetailError] = useState('');
  const [responseMessages, setResponseMessages] = useState<Record<string, string>>({});
  const [flowAlert, setFlowAlert] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const activeStep = useMemo(() => flowStepFromSearch(location.search, awardResponseStepIds, 'award-notice'), [location.search]);
  const activeGroup = awardResponseStepToGroup[activeStep];

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
  const hasResponse = Boolean(latestPersistedResponse) || /accepted|declined|clarification/i.test(noticeStatus);
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
        note: awardDetail.notice.contractId ? 'Linked contract is ready for negotiation' : 'Contract handoff pending',
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
  const activeFlowLock = useMemo(() => {
    const noAward = { message: 'Select an award notice before continuing the supplier response flow.', actionLabel: 'Open Awards Received Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awards-received' };
    const missingNotice = { message: 'The selected award does not have an issued notice yet, so supplier response actions are locked.', actionLabel: 'Open Awards Received Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awards-received' };
    const pendingResponse = { message: 'Record a supplier response before contract handoff can continue.', actionLabel: 'Go to Response Step', navigatePage: 'award-response', routeSearch: `award=${activeAwardId}&step=response` };
    const missingContract = { message: 'Contract handoff is not linked yet. Complete or refresh the response workflow after the buyer creates the draft contract.', actionLabel: 'Go to Response Step', navigatePage: 'award-response', routeSearch: `award=${activeAwardId}&step=response` };
    if (!activeAward) return noAward;
    if (activeStep === 'response' && !hasNotice) return missingNotice;
    if (activeStep === 'required-documents' && !contractHandoffId) return missingContract;
    if (activeStep === 'contract-handoff') {
      if (!hasResponse) return pendingResponse;
      if (!contractHandoffId) return missingContract;
    }
    return null;
  }, [activeAward, activeAwardId, activeStep, contractHandoffId, hasNotice, hasResponse]);
  const flowSteps = useMemo<Array<FlowStep<AwardResponseStepId>>>(() => {
    const noAward = { message: 'Select an award notice before continuing the supplier response flow.', actionLabel: 'Open Awards Received Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awards-received' };
    const missingNotice = { message: 'The selected award does not have an issued notice yet, so supplier response actions are locked.', actionLabel: 'Open Awards Received Queue', navigatePage: 'awarding-contracts', routeSearch: 'queue=awards-received' };
    const pendingResponse = { message: 'Record a supplier response before contract handoff can continue.', actionLabel: 'Go to Response Step', navigatePage: 'award-response', routeSearch: `award=${activeAwardId}&step=response` };
    const missingContract = { message: 'Contract handoff is not linked yet. Required documents can continue after the buyer creates the draft contract.', actionLabel: 'Go to Response Step', navigatePage: 'award-response', routeSearch: `award=${activeAwardId}&step=response` };
    return [
      { id: 'award-notice', label: 'Award Notice', description: 'Review received award', summary: 'Confirm the received award notice, deadline, buyer, value, and response state.', status: activeAward ? 'complete' : 'locked', statusLabel: activeAward ? 'Complete' : 'Locked', count: awards.length, countLabel: 'awards received', lockReason: noAward },
      { id: 'response', label: 'Accept or Decline', description: 'Accept, clarify, or decline', summary: 'Submit the supplier response and keep the selected award in the same flow.', status: !activeAward ? 'locked' : !hasNotice ? 'locked' : hasResponse ? 'complete' : 'available', statusLabel: hasResponse ? 'Response submitted' : hasNotice ? 'Needs action' : 'Locked', count: activeAward ? 1 : 0, countLabel: 'selected award', lockReason: !activeAward ? noAward : missingNotice },
      { id: 'required-documents', label: 'Required Conditions', description: 'Prepare pre-contract files', summary: 'Prepare required supplier documents after the contract handoff exists.', status: !activeAward ? 'locked' : !contractHandoffId ? 'locked' : 'available', statusLabel: contractHandoffId ? 'Ready' : 'Locked', count: preContractDocuments.length, countLabel: 'documents', lockReason: !activeAward ? noAward : missingContract },
      { id: 'activity', label: 'Clarification', description: 'Notice, response, and audit history', summary: 'Review notice events, response history, and contract handoff activity.', status: activeAward ? 'available' : 'locked', statusLabel: activeAward ? 'Ready' : 'Locked', count: responseActivityRecords.length, countLabel: 'activity records', lockReason: noAward },
      { id: 'contract-handoff', label: 'Contract Formation', description: 'Move to draft contract', summary: 'Continue to contract formation once the response and linked contract are ready.', status: !activeAward ? 'locked' : !hasResponse || !contractHandoffId ? 'locked' : 'complete', statusLabel: contractHandoffId ? 'Linked' : hasResponse ? 'Pending contract' : 'Pending response', count: contractHandoffId ? 1 : 0, countLabel: 'linked contracts', lockReason: !activeAward ? noAward : !hasResponse ? pendingResponse : missingContract }
    ];
  }, [activeAward, activeAwardId, awards.length, contractHandoffId, hasNotice, hasResponse, responseActivityRecords.length]);

  function selectAward(award: LifecycleAction) {
    navigate(`/awards-contracts/award-response?award=${award.awardId ?? award.id}&step=response`);
  }

  function selectFlowStep(step: AwardResponseStepId) {
    navigate({ pathname: '/awards-contracts/award-response', search: searchWithFlowStep(location.search, step) });
  }

  async function refreshAwards(awardId = activeAwardId) {
    await loadAwards();
    await loadAwardDetail(awardId);
  }

  async function recordResponse(award: LifecycleAction, payload: Record<string, unknown>) {
    if (!award.noticeId) {
      setResponseMessages((current) => ({ ...current, [award.id]: 'Award notice is not available yet.' }));
      return;
    }
    const responseAction = String(payload.action) as 'ACCEPT' | 'REQUEST_CLARIFICATION' | 'DECLINE';
    await awardsContractsApi.respondToNotice(award.noticeId, responseAction, String(payload.note ?? ''), payload.payload as Record<string, unknown>);
    setResponseMessages((current) => ({ ...current, [award.id]: `Supplier response submitted: ${responseAction}` }));
    setFlowAlert(`Supplier response submitted: ${responseAction}. The award detail has been refreshed.`);
    await refreshAwards(recommendationIdForAward(award));
    navigate({
      pathname: '/awards-contracts/award-response',
      search: searchWithFlowStep(location.search, contractHandoffId ? 'contract-handoff' : 'required-documents')
    });
  }

  return (
    <ProcurexAwardFrame pageKey="award-response">
      <div className="main-layout procurement-layout evaluation-app-layout award-response-page" data-award-contract-workspace data-award-current-step="supplier-acceptance">
        <AwardSidebar title="Awards Received" subtitle={activeAward?.title ?? 'Supplier response workspace'} activeQueue="awards-received" />

        <main className="main-content procurement-content evaluation-workspace award-response-workspace">
          <AwardHero
            kicker="Supplier-side award response"
            title={activeAward?.title ?? 'Awards received by your organization'}
            copy="Review award notices, accept or decline awards, request clarification, and prepare required pre-contract documents."
            stats={[
              { value: awards.length, label: 'Awards received' },
              { value: activeAward?.status ?? 'None', label: 'Selected award status' },
              { value: activeAward?.currentStage ?? 'None', label: 'Current stage' }
            ]}
          />

          {activeAward ? (
            <TopSummary
              items={[
                { label: 'Selected Award', value: activeAward.title },
                { label: 'Buyer', value: activeAward.otherParty },
                { label: 'Award Value', value: activeAward.amount === null ? 'Not priced' : formatMoney(activeAward.amount, activeAward.currency) },
                { label: 'Notice Reference', value: noticeReference },
                { label: 'Notice Status', value: <StatusBadge value={noticeStatus} /> },
                { label: 'Response Status', value: <StatusBadge value={responseStatus} /> },
                { label: 'Response Deadline', value: activeAward.dueDate ? new Date(activeAward.dueDate).toLocaleDateString() : 'Not dated' },
                { label: 'Contract Handoff', value: <StatusBadge value={contractHandoffStatus} /> }
              ]}
            />
          ) : null}
          <FlowChangeAlert message={flowAlert} />

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

          <section className="procurement-panel evaluation-panel awarding-tabs-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Supplier award workspace</span>
                <h2>Supplier response wizard</h2>
              </div>
              <StatusBadge value={flowSteps.find((step) => step.id === activeStep)?.label ?? 'Awards'} />
            </div>
            <AwardContractFlowBar steps={flowSteps} active={activeStep} onSelect={selectFlowStep} label="Supplier award response flow" />
          </section>

          {!isLoading && !loadError && !activeAward ? (
          <AwardContractAccessProvider access={access}>
          <section className="procurement-panel evaluation-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Award detail</span><h2>No award selected</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">Award response details will appear here after your organization receives an award.</div>
              <div className="inline-actions">
                <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=awards-received">Open Awards Received Queue</button>
              </div>
          </section>
          </AwardContractAccessProvider>
          ) : !isLoading && !loadError ? (
            <>
              {activeFlowLock ? (
                <LockedFlowStepPanel title={`${flowSteps.find((step) => step.id === activeStep)?.label ?? 'Workflow'} is locked`} reason={activeFlowLock} />
              ) : null}

              {!activeFlowLock && activeStep === 'contract-handoff' && contractHandoffId ? (
                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Contract handoff</span><h2>Continue to contract formation</h2></div>
                    <StatusBadge value="Ready" />
                  </div>
                  <div className="scope-empty">The award response is linked to a draft contract. Continue without restarting the supplier flow.</div>
                  <div className="inline-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${contractHandoffId}&step=draft`)}>Open Contract</button>
                  </div>
                </section>
              ) : null}

              {!activeFlowLock && activeStep !== 'contract-handoff' ? (
              <>
              {activeGroup === 'awards' ? (
                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Awards received</span><h2>Choose the award notice to work on</h2></div>
                    <StatusBadge value={`${filteredAwards.length} awards`} />
                  </div>
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
                </section>
              ) : null}

              {activeGroup === 'response' ? (
                <section className="procurement-panel evaluation-panel">
                  <ActionWorkspace
                    kicker="Supplier actions"
                    title="Record your award response"
                    badge={activeAward.status}
                    context={
                      <>
                        <TopSummary
                          items={[
                            { label: 'Award', value: activeAward.title },
                            { label: 'Buyer', value: activeAward.otherParty },
                            { label: 'Value', value: activeAward.amount === null ? 'Not priced' : formatMoney(activeAward.amount, activeAward.currency) },
                            { label: 'Notice reference', value: noticeReference },
                            { label: 'Notice status', value: <StatusBadge value={noticeStatus} /> },
                            { label: 'Response status', value: <StatusBadge value={responseStatus} /> },
                            { label: 'Response deadline', value: activeAward.dueDate ? new Date(activeAward.dueDate).toLocaleDateString() : 'Not dated' },
                            { label: 'Contract handoff', value: <StatusBadge value={contractHandoffStatus} /> }
                          ]}
                        />
                        <p className="award-workspace-note" data-award-response-status>
                          {latestPersistedResponse ? `Latest response: ${latestPersistedResponse.action}` : responseMessages[activeAward.id] || activeAward.requiredAction}
                        </p>
                      </>
                    }
                  >
                <ActionFormPanel
                  title="Supplier award response"
                  badge="Supplier"
                  submitLabel="Submit Response"
                  fields={[
                    { name: 'action', label: 'Response action', kind: 'select', required: true, options: [option('ACCEPT', 'Accept'), option('REQUEST_CLARIFICATION', 'Request clarification'), option('DECLINE', 'Decline')] },
                    { name: 'note', label: 'Response note', kind: 'textarea' },
                    { name: 'payload', label: 'Response payload', kind: 'json', rows: 4 }
                  ]}
                  initialValues={{
                    action: 'ACCEPT',
                    note: 'Award response submitted from ProcureX supplier workspace',
                    payload: JSON.stringify({ source: 'award-response-workspace', awardId: activeAward.awardId ?? activeAward.id }, null, 2)
                  }}
                  onSubmit={(payload) => recordResponse(activeAward, payload)}
                />
                  </ActionWorkspace>
                </section>
              ) : null}

              {activeGroup === 'documents' ? (
                <section className="procurement-panel evaluation-panel">
                  <ActionWorkspace
                    kicker="Documents required"
                    title="Pre-contract checklist"
                    badge="Pending Review"
                    context={
                      <SimpleTable headers={['Document', 'Owner', 'Status', 'Action']}>
                        {preContractDocuments.map((document) => (
                          <tr key={document}>
                            <td><strong>{document}</strong></td>
                            <td>Supplier Representative</td>
                            <td><StatusBadge value="Required" /></td>
                            <td>{contractHandoffId ? 'Use form' : 'Available after contract draft'}</td>
                          </tr>
                        ))}
                      </SimpleTable>
                    }
                  >
                    {contractHandoffId ? (
                  <ActionFormPanel
                    title="Pre-contract required document"
                    badge="Document"
                    submitLabel="Submit Document Requirement"
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
                  />
                    ) : <div className="scope-empty">Required document submission becomes available after contract draft creation.</div>}
                  </ActionWorkspace>
                </section>
              ) : null}

              {activeGroup === 'registers' ? (
                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Registers</span><h2>Supplier response activity</h2></div>
                    <StatusBadge value={`${responseActivityRecords.length} records`} />
                  </div>
                  <RecordRegister
                    title="Supplier response activity"
                    records={responseActivityRecords}
                    emptyMessage="No persisted supplier response activity is available yet."
                  />
                </section>
              ) : null}
              </>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
