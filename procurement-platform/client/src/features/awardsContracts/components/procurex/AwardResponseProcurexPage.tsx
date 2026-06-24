import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { awardsContractsApi } from '../../api';
import type { LifecycleAction } from '../../types';
import { ActionFormPanel, lifecycleStatusOptions, option } from './AwardContractActionForms';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

function getAwardId(search: string) {
  return new URLSearchParams(search).get('award') || '';
}

const preContractDocuments = [
  'Performance security',
  'Advance payment guarantee',
  'Insurance',
  'Power of attorney / signatory authorization',
  'Work plan or delivery schedule',
  'Bank details'
];

export function AwardResponseProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedAwardId = useMemo(() => getAwardId(location.search), [location.search]);
  const [awards, setAwards] = useState<LifecycleAction[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let active = true;
    awardsContractsApi.dashboard()
      .then((data) => {
        if (active) setAwards(data.queues['awards-received']);
      })
      .catch(() => {
        if (active) setAwards([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeAward = awards.find((award) => award.awardId === selectedAwardId || award.id === selectedAwardId) ?? awards[0] ?? null;

  function selectAward(award: LifecycleAction) {
    navigate(`/awards-contracts/award-response?award=${award.awardId ?? award.id}`);
  }

  async function refreshAwards() {
    const dashboard = await awardsContractsApi.dashboard();
    setAwards(dashboard.queues['awards-received']);
  }

  async function recordResponse(award: LifecycleAction, payload: Record<string, unknown>) {
    if (!award.noticeId) {
      setResponses((current) => ({ ...current, [award.id]: 'Award notice is not available yet.' }));
      return;
    }
    await awardsContractsApi.respondToNotice(award.noticeId, String(payload.action) as 'ACCEPT' | 'REQUEST_CLARIFICATION' | 'DECLINE', String(payload.note ?? ''), payload.payload as Record<string, unknown>);
    await refreshAwards();
    setResponses((current) => ({ ...current, [award.id]: `Current supplier response: ${payload.action}` }));
  }

  return (
    <ProcurexAwardFrame pageKey="award-response">
      <div className="main-layout procurement-layout evaluation-app-layout award-response-page" data-award-contract-workspace data-award-current-step="supplier-acceptance">
        <AwardSidebar title="Awards Received" subtitle="Supplier response workspace" activeQueue="awards-received" />

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
                { label: 'Award Status', value: <StatusBadge value={activeAward.status} /> },
                { label: 'Required Action', value: activeAward.requiredAction }
              ]}
            />
          ) : null}

          <section className="procurement-panel evaluation-panel awarding-tabs-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Awards received</span>
                <h2>Select an award and respond before contract preparation continues</h2>
              </div>
            </div>
            <div className="supplier-detail-tabs awarding-contract-tabs" role="tablist" aria-label="Supplier awards received">
              {awards.length === 0 ? <div className="scope-empty">No supplier awards have been received yet.</div> : null}
              {awards.map((award) => (
                <button
                  className={`supplier-detail-tab${award.id === activeAward?.id ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={award.id === activeAward?.id}
                  onClick={() => selectAward(award)}
                  key={award.id}
                >
                  {award.title}
                </button>
              ))}
            </div>
          </section>

          {!activeAward ? (
            <section className="procurement-panel evaluation-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Award detail</span><h2>No award selected</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">Award response details will appear here after your organization receives an award.</div>
            </section>
          ) : (
            <>
              <section className="procurement-panel evaluation-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Supplier actions</span><h2>Record your award response</h2></div>
                  <StatusBadge value={activeAward.status} />
                </div>
                <p data-award-response-status>{responses[activeAward.id] || activeAward.requiredAction}</p>
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
              </section>

              <section className="procurement-panel evaluation-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">Documents required</span><h2>Pre-contract checklist</h2></div>
                  <StatusBadge value="Pending Review" />
                </div>
                <SimpleTable headers={['Document', 'Owner', 'Status', 'Action']}>
                  {preContractDocuments.map((document) => (
                    <tr key={document}>
                      <td><strong>{document}</strong></td>
                      <td>Supplier Representative</td>
                      <td><StatusBadge value="Required" /></td>
                      <td>{activeAward.contractId ? 'Use form below' : 'Available after contract draft'}</td>
                    </tr>
                  ))}
                </SimpleTable>
                {activeAward.contractId ? (
                  <ActionFormPanel
                    title="Pre-contract required document"
                    badge="Document"
                    submitLabel="Submit Document Requirement"
                    fields={[
                      { name: 'documentType', label: 'Document type', kind: 'text', required: true },
                      { name: 'title', label: 'Title', kind: 'text', required: true },
                      { name: 'ownerRole', label: 'Owner role', kind: 'text', required: true },
                      { name: 'status', label: 'Status', kind: 'select', options: lifecycleStatusOptions },
                      { name: 'documentId', label: 'Document ID', kind: 'uuid' },
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
                    onSubmit={(payload) => awardsContractsApi.upsertRequiredDocument(activeAward.contractId as string, payload)}
                  />
                ) : null}
              </section>
            </>
          )}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
