import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supplierAwards } from '../../fixtures';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge,
  TopSummary
} from './AwardsContractsProcurexShared';

const responseLabels = {
  accept: 'Award Accepted',
  clarify: 'Clarification Requested',
  decline: 'Award Declined'
} as const;

function getAwardId(search: string) {
  return new URLSearchParams(search).get('award') || supplierAwards[0]?.id || '';
}

export function AwardResponseProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedAwardId = useMemo(() => getAwardId(location.search), [location.search]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const activeAward = supplierAwards.find((award) => award.id === selectedAwardId) ?? supplierAwards[0] ?? null;

  function selectAward(awardId: string) {
    navigate(`/awards-contracts/award-response?award=${awardId}`);
  }

  function recordResponse(awardId: string, action: keyof typeof responseLabels) {
    setResponses((current) => ({ ...current, [awardId]: `Current supplier response: ${responseLabels[action]}` }));
  }

  return (
    <ProcurexAwardFrame pageKey="award-response">
      <div className="main-layout procurement-layout evaluation-app-layout award-response-page" data-award-contract-workspace data-award-current-step="supplier-acceptance">
        <AwardSidebar title="Awards Received" subtitle="Supplier response workspace" activeQueue="awards-received" />

        <main className="main-content procurement-content evaluation-workspace award-response-workspace">
          <AwardHero
            kicker="Supplier-side award response"
            title="Awards received by your organization"
            copy="Review award notices, accept or decline awards, request clarification, and prepare required pre-contract documents."
            stats={[
              { value: supplierAwards.length, label: 'Awards received' },
              { value: activeAward?.awardStatus ?? 'None', label: 'Selected award status' },
              { value: activeAward?.contractStatus ?? 'None', label: 'Contract status' }
            ]}
          />

          {activeAward ? (
            <TopSummary
              items={[
                { label: 'Selected Award', value: activeAward.title },
                { label: 'Buyer', value: activeAward.buyer },
                { label: 'Award Value', value: formatMoney(activeAward.awardValue, activeAward.currency) },
                { label: 'Award Status', value: <StatusBadge value={activeAward.awardStatus} /> },
                { label: 'Contract Status', value: <StatusBadge value={activeAward.contractStatus} /> }
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
              {supplierAwards.length === 0 ? <div className="scope-empty">No supplier awards have been received yet.</div> : null}
              {supplierAwards.map((award) => (
                <button
                  className={`supplier-detail-tab${award.id === activeAward.id ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={award.id === activeAward.id}
                  data-award-response-jump={award.id}
                  onClick={() => selectAward(award.id)}
                  key={award.id}
                >
                  {award.title}
                </button>
              ))}
            </div>
          </section>

          {supplierAwards.length === 0 ? (
            <section className="procurement-panel evaluation-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Award detail</span><h2>No award selected</h2></div>
                <StatusBadge value="No records" />
              </div>
              <div className="scope-empty">Award response details will appear here after your organization receives an award.</div>
            </section>
          ) : null}

          {supplierAwards.map((award) => {
            const isActive = award.id === activeAward.id;
            return (
              <article
                className={`procurement-panel evaluation-panel award-response-detail${isActive ? ' active' : ''}`}
                data-award-response-panel={award.id}
                style={{ display: isActive ? '' : 'none' }}
                key={award.id}
              >
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Award detail</span>
                    <h3>{award.title}</h3>
                  </div>
                  <StatusBadge value={award.awardStatus} />
                </div>

                <section className="contract-overview-grid">
                  <article><span>Buyer</span><strong>{award.buyer}</strong></article>
                  <article><span>Type</span><strong>{award.procurementType}</strong></article>
                  <article><span>Award value</span><strong>{formatMoney(award.awardValue, award.currency)}</strong></article>
                  <article><span>Required action</span><strong>{award.requiredAction}</strong></article>
                </section>

                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Supplier actions</span><h2>Record your award response</h2></div>
                    <StatusBadge value={award.contractStatus} />
                  </div>
                  <p data-award-response-status>{responses[award.id] || award.responseStatus}</p>
                  <div className="award-control-grid">
                    <article>
                      <strong>Accept Award</strong>
                      <span>Proceed to document review and contract preparation.</span>
                      <button className="btn btn-primary" type="button" data-award-response-action="accept" onClick={() => recordResponse(award.id, 'accept')}>Accept Award</button>
                    </article>
                    <article>
                      <strong>Request Clarification</strong>
                      <span>Ask the buyer for clarification without changing evaluated bid substance.</span>
                      <button className="btn btn-secondary" type="button" data-award-response-action="clarify" onClick={() => recordResponse(award.id, 'clarify')}>Request Clarification</button>
                    </article>
                    <article>
                      <strong>Decline Award</strong>
                      <span>Decline with a recorded reason and close this supplier response task.</span>
                      <button className="btn btn-secondary" type="button" data-award-response-action="decline" onClick={() => recordResponse(award.id, 'decline')}>Decline Award</button>
                    </article>
                  </div>
                </section>

                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Documents required</span><h2>Pre-contract checklist</h2></div>
                    <StatusBadge value="Pending Review" />
                  </div>
                  <SimpleTable headers={['Document', 'Owner', 'Status', 'Action']}>
                    {award.documents.map((document) => (
                      <tr key={document.name}>
                        <td><strong>{document.name}</strong></td>
                        <td>{document.owner}</td>
                        <td><StatusBadge value={document.status} /></td>
                        <td><button className="btn btn-secondary btn-sm" type="button">{document.action}</button></td>
                      </tr>
                    ))}
                  </SimpleTable>
                </section>

                <section className="procurement-panel evaluation-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Contract preparation</span><h2>Handoff status</h2></div>
                    <StatusBadge value="Awaiting Your Signature" />
                  </div>
                  <div className="status-pipeline horizontal">
                    <div className="done"><strong>Award Notice</strong><span>Notice received by supplier</span></div>
                    <div className="current"><strong>Supplier Response</strong><span>Accept, clarify, or decline</span></div>
                    <div className="current"><strong>Contract Review</strong><span>Buyer prepares draft terms</span></div>
                    <div><strong>Signature</strong><span>Contract moves to signing</span></div>
                  </div>
                  <SimpleTable headers={['Time', 'Actor', 'Event', 'Status']}>
                    {award.activity.map((event) => (
                      <tr key={`${event.time}-${event.event}`}>
                        <td>{event.time}</td>
                        <td>{event.actor}</td>
                        <td>{event.event}</td>
                        <td><StatusBadge value={event.status} /></td>
                      </tr>
                    ))}
                  </SimpleTable>
                </section>
              </article>
            );
          })}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
