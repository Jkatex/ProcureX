import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import { awardsContractsApi } from '../../api';
import type { AwardDecisionDraftInput, AwardRecommendationDetailDto, LifecycleAction } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option } from './AwardContractActionForms';
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
  const hasSupplierResponse = Boolean(detail?.notice?.responses?.length) || /accepted|declined|clarification/i.test(detail?.notice?.status ?? activeRecommendation?.status ?? '');
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
      notifyAward('warning', 'Confirm award first', 'Confirm the award before sending notices.');
      return;
    }
    if (!signatureKeyphrase) {
      setPendingSignature({ action: 'settle' });
      return;
    }
    try {
      const note = String(recommendationDraft(detail).reason ?? detail?.reason ?? 'Award terms settled and notices sent.');
      setDetail(await awardsContractsApi.settleAwardGroup(activeRecommendationId, note, { source: 'simple-award-workspace' }, signatureKeyphrase));
      setPendingSignature(null);
      notifyAward('success', 'Notices sent', 'Award notices were prepared for the selected supplier.');
    } catch (error) {
      const message = apiErrorMessage(error, 'Notices could not be sent.');
      notifyAward('error', 'Notices not sent', /open clauses|negotiation points/i.test(message) ? 'Notices could not be sent. Please try again.' : message);
    }
  }

  function generateContract() {
    if (!isAwardConfirmed || !hasNotice || !supplierAccepted || !selectedContractId) {
      notifyAward('warning', 'Contract not ready', 'Confirm the award, send notices, then wait for supplier acceptance.');
      return;
    }
    navigate(`/awards-contracts/negotiation?contract=${selectedContractId}`);
  }

  async function cancelNotice(reason: string) {
    if (!detail?.notice?.id) return;
    try {
      setDetail(await awardsContractsApi.cancelAwardNotice(detail.notice.id, reason, { source: 'award-recommendation-workspace' }));
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
        title={pendingSignature?.action === 'settle' ? 'Send award notices' : 'Confirm award recommendation'}
        actionLabel={pendingSignature?.action === 'settle' ? 'Send notices' : 'Confirm award'}
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
            title={detail?.supplierName ? `Confirm award for ${detail.supplierName}` : activeRecommendation?.otherParty ? `Confirm award for ${activeRecommendation.otherParty}` : 'Confirm award'}
            copy="Review the recommendation, fill the award decision, then continue to notices and contract preparation."
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
              message="ProcureX is fetching the recommendation and linked award records."
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
              <AwardDecisionForm recommendation={detail ?? (activeRecommendation as unknown as AwardRecommendationDetailDto)} saving={isSaving} onSave={saveDecision} onConfirm={confirmDecision} />

              <div className="award-simple-actions award-simple-actions-secondary">
                <button className="btn btn-secondary" type="button" onClick={() => void sendNotices()}>{hasNotice ? 'Resend notices' : 'Send notices'}</button>
                <button className="btn btn-primary" type="button" onClick={generateContract} aria-disabled={!isAwardConfirmed || !hasNotice || !supplierAccepted || !selectedContractId}>Generate contract</button>
              </div>

              <section className="award-simple-details-stack" aria-label="Supporting award information">
                <ExpandableAwardDetails title="Documents used for this award" summary="Tender document, bid documents, and evaluation report">
                  <SourceDocumentsPanel documents={detail?.sourceDocuments ?? []} />
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Bid ranking" summary="See the recommended supplier and submitted bid documents">
                  <SimpleTable headers={['Supplier', 'Status', 'Amount', 'Bid documents']}>
                    {(detail?.awardGroup?.winners ?? []).length === 0 ? (
                      <tr><td colSpan={4}><div className="scope-empty">No ranked bid record is linked yet.</div></td></tr>
                    ) : detail?.awardGroup?.winners.map((winner) => (
                      <tr key={winner.id}>
                        <td><strong>{winner.supplierName ?? 'Supplier pending'}</strong></td>
                        <td><StatusBadge value={winner.status} /></td>
                        <td>{winner.amount === null ? 'Not priced' : formatMoney(winner.amount, winner.currency)}</td>
                        <td>{winner.bidDocuments.length ? winner.bidDocuments.map((document) => document.name).join(', ') : 'No bid documents'}</td>
                      </tr>
                    ))}
                  </SimpleTable>
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Send notices" summary="Prepare notices for the selected and unsuccessful bidders">
                  <p className="award-workspace-note">Use the button below after the award is confirmed. ProcureX will create the award notice and supplier response record.</p>
                  <div className="inline-actions">
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => void sendNotices()}>{hasNotice ? 'Resend notices' : 'Send notices'}</button>
                  </div>
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Waiting period" summary="Set the waiting period and complaint deadline">
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

                <ExpandableAwardDetails title="Supplier response" summary="Track whether the supplier has accepted or declined">
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
                  {detail?.notice?.status === 'DECLINED' ? (
                    <div className="award-simple-form-stack">
                      <div className="scope-empty">The supplier declined the notice. Select the next ranked supplier by default, or cancel this award path with a recorded reason.</div>
                      <ActionFormPanel
                        title="Select next ranked supplier"
                        badge="Buyer"
                        submitLabel="Send notice to next supplier"
                        fields={[
                          { name: 'reason', label: 'Reason for reissuing notice', kind: 'textarea', required: true, rows: 3 },
                          { name: 'payload', label: 'Reissue record', kind: 'json', rows: 4, advanced: true }
                        ]}
                        initialValues={{
                          reason: 'Previous supplier declined the award notice. Proceeding to the next ranked supplier from the evaluation result.',
                          payload: JSON.stringify({ source: 'declined-award-next-ranked' }, null, 2)
                        }}
                        onSubmit={(payload) => reissueNotice(String(payload.reason ?? 'Proceed to next ranked supplier.'))}
                      />
                      <ActionFormPanel
                        title="Cancel award notice"
                        badge="Buyer"
                        submitLabel="Cancel notice"
                        fields={[
                          { name: 'reason', label: 'Cancellation reason', kind: 'textarea', required: true, rows: 3 },
                          { name: 'payload', label: 'Cancellation record', kind: 'json', rows: 4, advanced: true }
                        ]}
                        initialValues={{
                          reason: 'Award notice declined. Buyer decided not to proceed with another supplier at this time.',
                          payload: JSON.stringify({ source: 'declined-award-cancellation' }, null, 2)
                        }}
                        onSubmit={(payload) => cancelNotice(String(payload.reason ?? 'Award notice cancelled after supplier decline.'))}
                      />
                    </div>
                  ) : null}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Required documents" summary="Add or update documents needed before signing">
                  {selectedContractId ? (
                    <ActionFormPanel
                      title="Required document"
                      badge="Document"
                      submitLabel="Save document"
                      fields={[
                        { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                        { name: 'title', label: 'Document name', kind: 'text', required: true },
                        { name: 'ownerRole', label: 'Owner', kind: 'select', required: true, options: [option('Supplier Representative'), option('Buyer Representative'), option('Contract Manager')] },
                        { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                        { name: 'dueDate', label: 'Due date', kind: 'date' },
                        { name: 'note', label: 'Note', kind: 'textarea' },
                        { name: 'payload', label: 'Payload', kind: 'json', technical: true }
                      ]}
                      initialValues={{ documentType: 'performance-security', title: 'Performance security', ownerRole: 'Supplier Representative', status: 'OPEN', payload: '{}' }}
                      onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(selectedContractId, payload)}
                      onComplete={(result) => {
                        setDetail((current) => current ? { ...current, contract: result as AwardRecommendationDetailDto['contract'] } : current);
                        notifyAward('success', 'Document saved', 'Required document was saved.');
                      }}
                    />
                  ) : <div className="scope-empty">Required documents become available after the supplier accepts and a contract is created.</div>}
                </ExpandableAwardDetails>

                <ExpandableAwardDetails title="Contract readiness" summary="Check what is still needed before contract preparation">
                  <ul className="award-simple-ready-list">
                    <li className={isAwardConfirmed ? 'complete' : 'blocked'}><span>{isAwardConfirmed ? 'OK' : '!'}</span><strong>Award confirmed</strong></li>
                    <li className={hasNotice ? 'complete' : 'blocked'}><span>{hasNotice ? 'OK' : '!'}</span><strong>Notices sent</strong></li>
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
