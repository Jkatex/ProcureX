import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import { awardsContractsApi } from '../../api';
import type { AwardDecisionDraftInput, AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { ActionFormPanel, option } from './AwardContractActionForms';
import { AwardContractAccessProvider } from './AwardContractRoleAccess';
import {
  AwardDecisionForm,
  ExpandableAwardDetails,
  notifyAward,
  SourceDocumentsPanel
} from './AwardContractSimpleShared';
import {
  AwardHero,
  formatMoney,
  ProcurexAwardFrame,
  RemoteStatePanel,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

function getRecommendationId(search: string) {
  return new URLSearchParams(search).get('recommendation') || '';
}

function recommendationIdFor(row: LifecycleAction | null) {
  return row?.awardId ?? row?.id.replace(/^award-/, '') ?? '';
}

function recommendationDraft(detail: AwardRecommendationDetailDto | null) {
  return (detail?.payload?.awardDecisionDraft ?? {}) as Record<string, unknown>;
}

function latestSupplierResponse(detail: AwardRecommendationDetailDto | null) {
  return [...(detail?.notice?.responses ?? [])].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
}

function rankingRows(detail: AwardRecommendationDetailDto | null) {
  const winners = detail?.awardGroup?.winners ?? [];
  if (winners.length) {
    return winners.map((winner, index) => ({
      id: winner.id,
      rank: index + 1,
      supplier: winner.supplierName ?? 'Supplier pending',
      amount: winner.amount,
      currency: winner.currency,
      status: winner.status
    }));
  }
  const rankings = Array.isArray(detail?.payload?.rankings) ? detail.payload.rankings : [];
  return rankings.map((row, index) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.supplier ?? index),
      rank: Number(record.rank ?? index + 1),
      supplier: String(record.supplier ?? 'Supplier pending'),
      amount: typeof record.amount === 'number' ? record.amount : null,
      currency: String(record.currency ?? detail?.currency ?? 'TZS'),
      status: Number(record.rank ?? index + 1) === 1 ? 'RECOMMENDED' : 'RANKED'
    };
  });
}

function awardFlowSteps(input: {
  isAwardConfirmed: boolean;
  hasNotice: boolean;
  supplierAccepted: boolean;
  supplierDeclined: boolean;
  selectedContractId: string;
}) {
  return [
    { label: 'Approve award', status: input.isAwardConfirmed ? 'complete' : 'current', detail: input.isAwardConfirmed ? 'Decision approved' : 'Review evaluation and approve the winner' },
    { label: 'Offer notice', status: input.hasNotice ? 'complete' : input.isAwardConfirmed ? 'current' : 'locked', detail: input.hasNotice ? 'Offer sent to supplier' : 'Send award offer notice' },
    {
      label: 'Supplier response',
      status: input.supplierAccepted ? 'complete' : input.supplierDeclined ? 'blocked' : input.hasNotice ? 'current' : 'locked',
      detail: input.supplierAccepted ? 'Accepted' : input.supplierDeclined ? 'Declined' : input.hasNotice ? 'Waiting for response' : 'No notice yet'
    },
    { label: 'Contract draft', status: input.selectedContractId ? 'current' : 'locked', detail: input.selectedContractId ? 'Open drafting workspace' : 'Created after acceptance' }
  ];
}

export function AwardRecommendationProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedRecommendationId = useMemo(() => getRecommendationId(location.search), [location.search]);
  const [recommendations, setRecommendations] = useState<LifecycleAction[]>([]);
  const [detail, setDetail] = useState<AwardRecommendationDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [pendingSignature, setPendingSignature] = useState<{ action: 'confirm' | 'settle'; payload?: AwardDecisionDraftInput } | null>(null);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const dashboard = await awardsContractsApi.dashboard();
      setRecommendations(dashboard.queues['awarding-in-progress']);
    } catch (error) {
      setRecommendations([]);
      setLoadError(apiErrorMessage(error, 'Award recommendations could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  const activeRecommendation =
    recommendations.find((row) => row.awardId === requestedRecommendationId || row.id === requestedRecommendationId) ?? recommendations[0] ?? null;
  const activeRecommendationId = requestedRecommendationId || recommendationIdFor(activeRecommendation);

  const loadDetail = useCallback(async () => {
    if (!activeRecommendationId) {
      setDetail(null);
      setDetailError('');
      return;
    }
    setDetailError('');
    try {
      setDetail(await awardsContractsApi.recommendation(activeRecommendationId));
    } catch (error) {
      setDetail(null);
      setDetailError(apiErrorMessage(error, 'Award detail could not be loaded.'));
    }
  }, [activeRecommendationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const selectedContractId = detail ? detail.notice?.contractId ?? detail.contract?.id ?? '' : activeRecommendation?.contractId ?? '';
  const isAwardConfirmed = detail?.status === 'APPROVED' || activeRecommendation?.status === 'APPROVED';
  const hasNotice = detail ? Boolean(detail.notice) : Boolean(activeRecommendation?.noticeId);
  const supplierAccepted = detail?.notice?.status === 'ACCEPTED';
  const supplierDeclined = detail?.notice?.status === 'DECLINED';
  const hasSupplierResponse = Boolean(detail?.notice?.responses?.length) || /accepted|declined|clarification/i.test(detail?.notice?.status ?? activeRecommendation?.status ?? '');
  const response = latestSupplierResponse(detail);
  const rankings = rankingRows(detail);
  const hasAlternateSupplier = rankings.length > 1 || (detail?.awardGroup?.winners ?? []).some((winner) => winner.recommendationId && winner.recommendationId !== activeRecommendationId);
  const flowSteps = awardFlowSteps({ isAwardConfirmed, hasNotice, supplierAccepted, supplierDeclined, selectedContractId });
  const access = detail?.access ?? {
    viewerRole: activeRecommendation?.roleContext ?? 'NONE',
    canManageBuyerActions: activeRecommendation?.roleContext === 'BUYER',
    canSubmitSupplierActions: activeRecommendation?.roleContext === 'SUPPLIER',
    canSignBuyer: activeRecommendation?.roleContext === 'BUYER',
    canSignSupplier: activeRecommendation?.roleContext === 'SUPPLIER',
    readOnlyReason: activeRecommendation?.roleContext === 'SUPPLIER' ? 'Buyer actions are read-only for the supplier.' : null
  } as const;

  async function saveDecision(payload: AwardDecisionDraftInput) {
    if (!activeRecommendationId) return;
    setIsSaving(true);
    try {
      setDetail(await awardsContractsApi.saveAwardDecisionDraft(activeRecommendationId, payload));
      await loadRecommendations();
      notifyAward('success', 'Award saved', 'Award decision draft saved.');
    } catch (error) {
      notifyAward('error', 'Award not saved', apiErrorMessage(error, 'Award decision could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDecision(payload: AwardDecisionDraftInput, signatureKeyphrase?: string) {
    if (!activeRecommendationId) return;
    if (!signatureKeyphrase) {
      setPendingSignature({ action: 'confirm', payload });
      return;
    }
    setIsSaving(true);
    try {
      setDetail(await awardsContractsApi.approveRecommendation(activeRecommendationId, payload.note, payload, signatureKeyphrase));
      setPendingSignature(null);
      await loadRecommendations();
      notifyAward('success', 'Award confirmed', 'The award decision has been confirmed.');
    } catch (error) {
      notifyAward('error', 'Award not confirmed', apiErrorMessage(error, 'The award could not be confirmed.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function sendNotices(signatureKeyphrase?: string) {
    if (!activeRecommendationId) return;
    if (!isAwardConfirmed) {
      notifyAward('warning', 'Approve award first', 'Approve the award first.');
      return;
    }
    if (!signatureKeyphrase) {
      setPendingSignature({ action: 'settle' });
      return;
    }
    try {
      const note = String(recommendationDraft(detail).reason ?? detail?.reason ?? 'Award terms settled and notices sent.');
      setDetail(await awardsContractsApi.settleAwardGroup(activeRecommendationId, note, { source: 'award-offer-notice-workspace' }, signatureKeyphrase));
      setPendingSignature(null);
      await loadRecommendations();
      notifyAward('success', 'Award offer sent', 'The award offer notice was sent to the selected supplier.');
    } catch (error) {
      const message = apiErrorMessage(error, 'Award offer could not be sent.');
      notifyAward('error', 'Offer not sent', /open clauses|negotiation points/i.test(message) ? 'Award offer could not be sent. Please try again.' : message);
    }
  }

  function generateContract() {
    if (!isAwardConfirmed || !hasNotice || !supplierAccepted || !selectedContractId) {
      notifyAward('warning', 'Contract not ready', 'Confirm the award, send notices, then wait for supplier acceptance.');
      return;
    }
    navigate(`/awards-contracts/drafting?contract=${selectedContractId}`);
  }

  async function cancelNotice(reason: string) {
    if (!detail?.notice?.id) return;
    try {
      setDetail(await awardsContractsApi.cancelAwardNotice(detail.notice.id, reason, { source: 'award-recommendation-workspace' }));
      await loadRecommendations();
      notifyAward('success', 'Notice cancelled', 'The award notice was cancelled with a recorded reason.');
    } catch (error) {
      notifyAward('error', 'Notice not cancelled', apiErrorMessage(error, 'The award notice could not be cancelled.'));
    }
  }

  async function reissueNotice(reason: string) {
    if (!detail?.notice?.id) return;
    try {
      setDetail(await awardsContractsApi.reissueAwardNotice(detail.notice.id, reason, { source: 'award-recommendation-workspace' }));
      notifyAward('success', 'Next supplier notified', 'A new award notice was prepared for the next ranked supplier.');
      await loadRecommendations();
    } catch (error) {
      notifyAward('error', 'Notice not reissued', apiErrorMessage(error, 'A new award notice could not be prepared.'));
    }
  }

  return (
    <ProcurexAwardFrame pageKey="award-recommendation">
      <SignatureKeyphraseModal
        open={pendingSignature !== null}
        title={pendingSignature?.action === 'settle' ? 'Send award offer notice' : 'Approve award recommendation'}
        actionLabel={pendingSignature?.action === 'settle' ? 'Send award offer notice' : 'Approve award'}
        isSubmitting={isSaving}
        onCancel={() => setPendingSignature(null)}
        onConfirm={(signatureKeyphrase) => {
          if (pendingSignature?.action === 'settle') void sendNotices(signatureKeyphrase);
          else if (pendingSignature?.payload) void confirmDecision(pendingSignature.payload, signatureKeyphrase);
        }}
      />
      <div className="main-layout procurement-layout evaluation-app-layout award-page award-page-no-sidebar award-simple-page" data-award-contract-workspace>
        <main className="main-content procurement-content evaluation-workspace award-simple-workspace">
          <AwardHero
            kicker="Award recommendation"
            title={detail?.supplierName ? `Award offer for ${detail.supplierName}` : activeRecommendation?.otherParty ? `Award offer for ${activeRecommendation.otherParty}` : 'Award offer'}
            copy="Approve the award and send the offer."
            stats={[
              { value: detail?.amount ?? activeRecommendation?.amount ?? 0, label: detail?.currency ?? activeRecommendation?.currency ?? 'TZS' },
              { value: detail?.status ?? activeRecommendation?.status ?? 'Draft', label: 'Award status' },
              { value: selectedContractId ? 'Ready' : 'Pending', label: 'Contract' }
            ]}
          />

          {isLoading ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading award recommendation"
              message="Loading award records."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Award recommendation could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadRecommendations()}
            />
          ) : null}

          {detailError && activeRecommendationId ? (
            <RemoteStatePanel
              kicker="Detail"
              title="Award detail could not be loaded"
              message={detailError}
              status="Warning"
              actionLabel="Retry detail"
              onAction={() => void loadDetail()}
            />
          ) : null}

          {!isLoading && !loadError && !activeRecommendation ? (
            <section className="procurement-panel evaluation-panel award-page-empty">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Award recommendation</span>
                  <h2>No recommendation is ready yet.</h2>
                </div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">When evaluation is completed, the award decision form will appear here.</div>
            </section>
          ) : null}

          {!isLoading && !loadError && activeRecommendation ? (
            <AwardContractAccessProvider access={{ ...access, hideLockedActions: true }}>
              <section className="procurement-panel evaluation-panel award-offer-flow-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Award process</span>
                    <h2>Decision to contract draft</h2>
                  </div>
                  <StatusBadge value={supplierDeclined ? 'Declined' : supplierAccepted ? 'Accepted' : hasNotice ? 'Awaiting supplier response' : isAwardConfirmed ? 'Ready to notify' : 'Decision required'} />
                </div>
                <div className="award-offer-steps" aria-label="Award offer progress">
                  {flowSteps.map((step, index) => (
                    <article className={`award-offer-step ${step.status}`} key={step.label}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{step.label}</strong>
                        <em>{step.detail}</em>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <div className="award-decision-command-grid">
                <div className="award-offer-primary">
                  {!isAwardConfirmed ? (
                    <AwardDecisionForm
                      recommendation={detail ?? (activeRecommendation as unknown as AwardRecommendationDetailDto)}
                      saving={isSaving}
                      onSave={saveDecision}
                      onConfirm={confirmDecision}
                      confirmLabel="Approve award"
                    />
                  ) : null}

                  {isAwardConfirmed && !hasNotice ? (
                    <section className="procurement-panel evaluation-panel award-offer-current">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Send offer notice</span>
                          <h2>Offer the award to {detail?.supplierName ?? activeRecommendation.otherParty}</h2>
                          <p>Send the offer to the supplier.</p>
                        </div>
                        <StatusBadge value="Ready" />
                      </div>
                      <div className="award-response-note-box">
                        <span>Award reason</span>
                        <p>{String(recommendationDraft(detail).reason ?? detail?.reason ?? 'No award reason captured yet.')}</p>
                      </div>
                      <div className="award-simple-actions">
                        <button className="btn btn-primary" type="button" onClick={() => void sendNotices()}>Send award offer notice</button>
                      </div>
                    </section>
                  ) : null}

                  {hasNotice && !supplierAccepted && !supplierDeclined ? (
                    <section className="procurement-panel evaluation-panel award-offer-current">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Supplier response</span>
                          <h2>Waiting for supplier decision</h2>
                          <p>Waiting for the supplier.</p>
                        </div>
                        <StatusBadge value={detail?.notice?.status ?? activeRecommendation.status} />
                      </div>
                      <div className="award-readonly-summary">
                        <article><span>Notice</span><strong>{detail?.notice?.reference ?? activeRecommendation.noticeReference ?? 'Notice issued'}</strong></article>
                        <article><span>Issued</span><strong>{detail?.notice?.issuedAt ? new Date(detail.notice.issuedAt).toLocaleString() : 'Recently'}</strong></article>
                        <article><span>Latest response</span><strong>{response?.action ?? 'Awaiting supplier'}</strong></article>
                      </div>
                    </section>
                  ) : null}

                  {supplierDeclined ? (
                    <section className="procurement-panel evaluation-panel award-offer-current">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Supplier declined</span>
                          <h2>Review the decline response</h2>
                          <p>Review the supplier reason.</p>
                        </div>
                        <StatusBadge value="Declined" />
                      </div>
                      <div className="award-response-note-box">
                        <span>Supplier response</span>
                        <p>{response?.note || detail?.notice?.supplierNote || 'The supplier declined without a detailed reason.'}</p>
                      </div>
                      {hasAlternateSupplier ? (
                        <ActionFormPanel
                          title="Offer next ranked supplier"
                          badge="Buyer"
                          submitLabel="Send offer to next supplier"
                          fields={[
                            { name: 'reason', label: 'Reason for offering next supplier', kind: 'textarea', required: true, rows: 3 }
                          ]}
                          initialValues={{
                            reason: 'Previous supplier declined the award offer. Proceeding to the next ranked supplier from the evaluation result.'
                          }}
                          onSubmit={(payload) => reissueNotice(String(payload.reason ?? 'Proceed to next ranked supplier.'))}
                        />
                      ) : (
                        <div className="award-simple-form-stack">
                          <div className="scope-empty">No alternate ranked supplier is available for this award. Record the cancellation reason to close this award path.</div>
                          <ActionFormPanel
                            title="Cancel award process"
                            badge="Buyer"
                            submitLabel="Cancel award"
                            fields={[
                              { name: 'reason', label: 'Cancellation reason', kind: 'textarea', required: true, rows: 3 }
                            ]}
                            initialValues={{
                              reason: 'Award offer declined and no alternate ranked supplier is available.'
                            }}
                            onSubmit={(payload) => cancelNotice(String(payload.reason ?? 'Award notice cancelled after supplier decline.'))}
                          />
                        </div>
                      )}
                    </section>
                  ) : null}

                  {supplierAccepted ? (
                    <section className="procurement-panel evaluation-panel award-offer-current">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Contract draft</span>
                          <h2>Supplier accepted the award</h2>
                          <p>Open drafting to prepare the contract.</p>
                        </div>
                        <StatusBadge value={selectedContractId ? 'Draft ready' : 'Contract pending'} />
                      </div>
                      <div className="award-response-note-box">
                        <span>Supplier message</span>
                        <p>{response?.note || detail?.notice?.supplierNote || 'The supplier accepted the award and is waiting for the contract draft.'}</p>
                      </div>
                      <div className="award-simple-actions">
                        <button className="btn btn-primary" type="button" onClick={generateContract}>Open contract drafting</button>
                      </div>
                    </section>
                  ) : null}
                </div>

                <aside className="procurement-panel evaluation-panel award-offer-side" aria-label="Award summary">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">Award summary</span>
                      <h2>{detail?.tenderTitle ?? activeRecommendation.title}</h2>
                    </div>
                    <StatusBadge value={detail?.status ?? activeRecommendation.status} />
                  </div>
                  <div className="award-readonly-summary">
                    <article><span>Recommended supplier</span><strong>{detail?.supplierName ?? activeRecommendation.otherParty}</strong></article>
                    <article><span>Value</span><strong>{detail?.amount === null || detail?.amount === undefined ? activeRecommendation.amount === null ? 'Not priced' : formatMoney(activeRecommendation.amount, activeRecommendation.currency) : formatMoney(detail.amount, detail.currency)}</strong></article>
                    <article><span>Notice</span><strong>{detail?.notice?.reference ?? activeRecommendation.noticeReference ?? 'Not sent'}</strong></article>
                    <article><span>Contract</span><strong>{selectedContractId ? 'Linked' : 'Created after acceptance'}</strong></article>
                  </div>
                  <div className="award-offer-ranking">
                    <h3>Supplier ranking</h3>
                    <SimpleTable headers={['Rank', 'Supplier', 'Amount', 'Status']}>
                      {rankings.length ? rankings.map((row) => (
                        <tr key={row.id}>
                          <td>{row.rank}</td>
                          <td><strong>{row.supplier}</strong></td>
                          <td>{row.amount === null || row.amount === undefined ? 'Not priced' : formatMoney(row.amount, row.currency)}</td>
                          <td><StatusBadge value={row.status} /></td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}><div className="scope-empty">No ranking table is linked yet.</div></td></tr>
                      )}
                    </SimpleTable>
                  </div>
                </aside>
              </div>

              <section className="award-simple-details-stack" aria-label="Supporting award information">
                <ExpandableAwardDetails title="Award documents" summary="Tender, bid, and evaluation files">
                  <SourceDocumentsPanel documents={detail?.sourceDocuments ?? []} />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Waiting period" summary="Dates and status">
                  <ActionFormPanel
                    title="Waiting period"
                    badge="Buyer"
                    submitLabel="Save waiting period"
                    fields={[
                      { name: 'startsAt', label: 'Start date and time', kind: 'datetime' },
                      { name: 'endsAt', label: 'End date and time', kind: 'datetime' },
                      { name: 'days', label: 'Number of days', kind: 'number', min: 0, max: 365 },
                      { name: 'status', label: 'Status', kind: 'select', options: ['PENDING', 'ACTIVE', 'WAIVED', 'EXPIRED'].map((value) => option(value)) },
                      { name: 'waived', label: 'Waive waiting period', kind: 'checkbox' },
                      { name: 'waiverReason', label: 'Reason if waived', kind: 'textarea' },
                      { name: 'payload', label: 'Payload', kind: 'json', technical: true }
                    ]}
                    initialValues={{ days: '7', status: 'PENDING', waived: false, payload: '{}' }}
                    onSubmit={(payload) => awardsContractsApi.upsertStandstillPeriod(activeRecommendationId, payload)}
                    onComplete={(result) => {
                      setDetail(result as AwardRecommendationDetailDto);
                      notifyAward('success', 'Waiting period saved', 'Waiting period details were saved.');
                    }}
                  />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Supplier responses" summary="Response history">
                  <SimpleTable headers={['Notice', 'Status', 'Latest response']}>
                    <tr>
                      <td>{detail?.notice?.reference ?? 'No notice sent yet'}</td>
                      <td><StatusBadge value={detail?.notice?.status ?? activeRecommendation.status} /></td>
                      <td>{hasSupplierResponse ? detail?.notice?.responses?.[0]?.action ?? 'Response recorded' : 'Awaiting response'}</td>
                    </tr>
                  </SimpleTable>
                  {detail?.notice?.responses?.length ? (
                    <SimpleTable headers={['Action', 'Reason / message', 'Date']}>
                      {detail.notice.responses.map((response) => (
                        <tr key={response.id}>
                          <td><StatusBadge value={response.action} /></td>
                          <td>{response.note || 'No reason captured'}</td>
                          <td>{new Date(response.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </SimpleTable>
                  ) : null}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Contract readiness" summary="Required steps">
                  <ul className="award-simple-ready-list">
                    <li className={isAwardConfirmed ? 'complete' : 'blocked'}><span>{isAwardConfirmed ? 'OK' : '!'}</span><strong>Award confirmed</strong></li>
                    <li className={hasNotice ? 'complete' : 'blocked'}><span>{hasNotice ? 'OK' : '!'}</span><strong>Offer notice sent</strong></li>
                    <li className={supplierAccepted ? 'complete' : 'blocked'}><span>{supplierAccepted ? 'OK' : '!'}</span><strong>Supplier accepted</strong></li>
                    <li className={selectedContractId ? 'complete' : 'blocked'}><span>{selectedContractId ? 'OK' : '!'}</span><strong>Contract linked</strong></li>
                  </ul>
                </ExpandableAwardDetails>
              </section>
            </AwardContractAccessProvider>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
