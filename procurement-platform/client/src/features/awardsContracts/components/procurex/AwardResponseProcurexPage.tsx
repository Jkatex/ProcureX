import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import { awardsContractsApi } from '../../api';
import type { AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import { notifyAward } from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
  lifecycleActionMatches,
  LifecycleActionCard,
  ProcurexAwardFrame,
  RemoteStatePanel,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getAwardId(search: string) {
  return new URLSearchParams(search).get('award') || '';
}

function recommendationIdForAward(award: LifecycleAction | null) {
  if (!award) return '';
  return award.awardId ?? award.id.replace(/^award-/, '');
}

export function AwardResponseProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedAwardId = useMemo(() => getAwardId(location.search), [location.search]);
  const [awards, setAwards] = useState<LifecycleAction[]>([]);
  const [awardSearch, setAwardSearch] = useState('');
  const [awardDetail, setAwardDetail] = useState<AwardRecommendationDetailDto | null>(null);
  const [detailError, setDetailError] = useState('');
  const [responseMessages, setResponseMessages] = useState<Record<string, string>>({});
  const [acceptNote, setAcceptNote] = useState('We accept the award offer.');
  const [clarificationNote, setClarificationNote] = useState('Please clarify the award notice.');
  const [declineReason, setDeclineReason] = useState('');
  const [pendingResponseSignature, setPendingResponseSignature] = useState<{ award: LifecycleAction; payload: Record<string, unknown> } | null>(null);
  const [signatureError, setSignatureError] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
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
  const normalizedNoticeStatus = String(noticeStatus).toUpperCase();
  const latestPersistedResponse = [...(awardDetail?.notice?.responses ?? [])]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  const responseStatus = latestPersistedResponse?.action ?? responseMessages[activeAward?.id ?? ''] ?? activeAward?.requiredAction ?? 'No response due';
  const contractHandoffId = awardDetail?.notice?.contractId ?? activeAward?.contractId;
  const contractHandoffStatus = contractHandoffId ? 'Contract linked' : 'Pending contract handoff';
  const hasNotice = Boolean(activeAward?.noticeId ?? awardDetail?.notice?.id);
  const accepted = normalizedNoticeStatus === 'ACCEPTED';
  const declined = normalizedNoticeStatus === 'DECLINED';
  const responseClosed = accepted || declined || normalizedNoticeStatus === 'CANCELLED';
  const decisionDraft = (awardDetail?.payload?.awardDecisionDraft ?? {}) as Record<string, unknown>;
  const awardReason = String(decisionDraft.reason ?? awardDetail?.reason ?? 'No award reason is recorded yet.');
  const awardConditions = String(decisionDraft.conditions ?? 'No special conditions are recorded.');

  function selectAward(award: LifecycleAction) {
    navigate(`/awards-contracts/award-response?award=${award.awardId ?? award.id}`);
  }

  async function refreshAwards(awardId = activeAwardId) {
    await loadAwards();
    await loadAwardDetail(awardId);
  }

  async function recordResponse(award: LifecycleAction, payload: Record<string, unknown>, signatureKeyphrase?: string) {
    if (!award.noticeId) {
      setResponseMessages((current) => ({ ...current, [award.id]: 'Award notice is not available yet.' }));
      notifyAward('warning', 'Award notice unavailable', 'The selected award does not have an issued notice yet.');
      return;
    }
    const responseAction = String(payload.action) as 'ACCEPT' | 'REQUEST_CLARIFICATION' | 'DECLINE';
    if ((responseAction === 'ACCEPT' || responseAction === 'DECLINE') && !signatureKeyphrase) {
      setSignatureError('');
      setPendingResponseSignature({ award, payload });
      return;
    }
    setIsSubmittingResponse(true);
    try {
      await awardsContractsApi.respondToNotice(award.noticeId, responseAction, String(payload.note ?? ''), payload.payload as Record<string, unknown>, signatureKeyphrase);
      setPendingResponseSignature(null);
      setSignatureError('');
      setResponseMessages((current) => ({ ...current, [award.id]: `Supplier response submitted: ${responseAction}` }));
      notifyAward('success', 'Supplier response sent', `Response submitted: ${responseAction}.`);
      await refreshAwards(recommendationIdForAward(award));
    } catch (error) {
      const message = apiErrorMessage(error, 'The response could not be submitted.');
      setSignatureError(message);
      notifyAward('error', 'Supplier response not sent', message);
    } finally {
      setIsSubmittingResponse(false);
    }
  }

  return (
    <ProcurexAwardFrame pageKey="award-response">
      <SignatureKeyphraseModal
        open={pendingResponseSignature !== null}
        title="Submit award response"
        actionLabel="Sign and submit"
        isSubmitting={isSubmittingResponse}
        error={signatureError}
        onCancel={() => {
          setPendingResponseSignature(null);
          setSignatureError('');
        }}
        onConfirm={(signatureKeyphrase) => {
          if (pendingResponseSignature) void recordResponse(pendingResponseSignature.award, pendingResponseSignature.payload, signatureKeyphrase);
        }}
      />
      <div className="main-layout procurement-layout evaluation-app-layout award-response-page award-simple-page" data-award-contract-workspace data-award-current-step="supplier-acceptance">
        <main className="main-content procurement-content evaluation-workspace award-response-workspace">
          <AwardHero
            kicker="Supplier award response"
            title={activeAward?.title ?? 'Awards received by your organization'}
            copy="Review the offer and respond."
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
              message="Loading awards received."
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
            <AwardContractAccessProvider access={{ ...access, hideLockedActions: true }}>
              <section className="procurement-panel evaluation-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Respond to award</span><h2>No award selected</h2></div>
                  <StatusBadge value="No records" />
                </div>
                <div className="scope-empty">No award is ready yet.</div>
                <div className="inline-actions">
                  <button className="btn btn-secondary" type="button" data-navigate="awarding-contracts" data-route-search="queue=awards-received">Open awards received</button>
                </div>
              </section>
            </AwardContractAccessProvider>
          ) : null}

          {!isLoading && !loadError && activeAward ? (
            <AwardContractAccessProvider access={{ ...access, hideLockedActions: true }}>
              <div className="award-response-main-grid">
                <section className="procurement-panel evaluation-panel award-offer-current">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Award offer notice</span>
                      <h2>{noticeReference}</h2>
                      <p>Review and respond.</p>
                    </div>
                    <StatusBadge value={noticeStatus} />
                  </div>

                  <div className="award-readonly-summary">
                    <article><span>Award</span><strong>{activeAward.title}</strong></article>
                    <article><span>Buyer</span><strong>{activeAward.otherParty}</strong></article>
                    <article><span>Value</span><strong>{activeAward.amount === null ? 'Not priced' : formatMoney(activeAward.amount, activeAward.currency)}</strong></article>
                    <article><span>Response</span><strong>{responseStatus}</strong></article>
                    <article><span>Deadline</span><strong>{activeAward.dueDate ? new Date(activeAward.dueDate).toLocaleDateString() : 'Not dated'}</strong></article>
                    <article><span>Contract</span><strong>{contractHandoffStatus}</strong></article>
                  </div>

                  <div className="award-offer-notice-card">
                    <div>
                      <span>Reason for award</span>
                      <p>{awardReason}</p>
                    </div>
                    <div>
                      <span>Conditions</span>
                      <p>{awardConditions}</p>
                    </div>
                    {awardDetail?.notice?.buyerNote ? (
                      <div>
                        <span>Buyer message</span>
                        <p>{awardDetail.notice.buyerNote}</p>
                      </div>
                    ) : null}
                  </div>

                  {!hasNotice ? (
                    <div className="scope-empty">This award is listed, but the buyer has not issued the award offer notice yet.</div>
                  ) : null}

                  {accepted ? (
                    <div className="award-response-note-box">
                      <span>Award accepted</span>
                      <p>{latestPersistedResponse?.note || 'Award accepted.'}</p>
                      <div className="inline-actions">
                        {contractHandoffId ? (
                          <button className="btn btn-primary" type="button" onClick={() => navigate(`/awards-contracts/negotiation?contract=${contractHandoffId}`)}>Open contract negotiation</button>
                        ) : (
                          <button className="btn btn-secondary" type="button" disabled>Waiting for buyer draft</button>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {declined ? (
                    <div className="award-response-note-box">
                      <span>Award declined</span>
                      <p>{latestPersistedResponse?.note || 'Award declined.'}</p>
                    </div>
                  ) : null}

                  {hasNotice && !responseClosed ? (
                    <div className="award-response-action-grid">
                      <article className="award-response-action-card">
                        <div>
                          <span className="section-kicker">Accept award</span>
                          <h3>Accept award</h3>
                        </div>
                        <label className="award-form-field">
                          <span>Message to buyer</span>
                          <textarea className="form-input" rows={4} value={acceptNote} onChange={(event) => setAcceptNote(event.target.value)} />
                        </label>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={isSubmittingResponse}
                          onClick={() => void recordResponse(activeAward, {
                            action: 'ACCEPT',
                            note: acceptNote,
                            payload: { source: 'award-response-workspace', requestContractDraft: true, awardId: activeAward.awardId ?? activeAward.id }
                          })}
                        >
                          Accept award and request contract draft
                        </button>
                      </article>

                      <article className="award-response-action-card">
                        <div>
                          <span className="section-kicker">Clarification</span>
                          <h3>Ask buyer for clarification</h3>
                          <p>Ask the buyer a question.</p>
                        </div>
                        <label className="award-form-field">
                          <span>Clarification needed</span>
                          <textarea className="form-input" rows={4} value={clarificationNote} onChange={(event) => setClarificationNote(event.target.value)} />
                        </label>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={isSubmittingResponse || !clarificationNote.trim()}
                          onClick={() => void recordResponse(activeAward, {
                            action: 'REQUEST_CLARIFICATION',
                            note: clarificationNote,
                            payload: { source: 'award-response-workspace', awardId: activeAward.awardId ?? activeAward.id }
                          })}
                        >
                          Send clarification request
                        </button>
                      </article>

                      <article className="award-response-action-card">
                        <div>
                          <span className="section-kicker">Decline</span>
                          <h3>Decline award offer</h3>
                          <p>Give a short reason.</p>
                        </div>
                        <label className="award-form-field">
                          <span>Decline reason</span>
                          <textarea className="form-input" rows={4} value={declineReason} placeholder="Explain why you cannot accept this award." onChange={(event) => setDeclineReason(event.target.value)} />
                        </label>
                        <button
                          className="btn btn-danger"
                          type="button"
                          disabled={isSubmittingResponse || !declineReason.trim()}
                          onClick={() => void recordResponse(activeAward, {
                            action: 'DECLINE',
                            note: declineReason,
                            payload: { source: 'award-response-workspace', awardId: activeAward.awardId ?? activeAward.id }
                          })}
                        >
                          Decline award
                        </button>
                      </article>
                    </div>
                  ) : null}
                </section>

                <aside className="procurement-panel evaluation-panel award-offer-side">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Awards received</span>
                      <h2>{filteredAwards.length} visible</h2>
                    </div>
                    <StatusBadge value={`${awards.length} total`} />
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
                </aside>
              </div>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
