import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  activeContracts,
  awardQueueLabels,
  closedContracts,
  contractActions,
  pendingAwards,
  summaryCards,
  supplierAwards,
  urgentActions
} from '../../fixtures';
import type { AwardQueueId } from '../../types';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  routeWithSearch,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

const queueIds = Object.keys(awardQueueLabels) as AwardQueueId[];

function EmptyRows({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="scope-empty">{message}</div>
      </td>
    </tr>
  );
}

function getQueueFromSearch(search: string): AwardQueueId {
  const queue = new URLSearchParams(search).get('queue') as AwardQueueId | null;
  return queue && queueIds.includes(queue) ? queue : 'my-urgent-actions';
}

export function AwardingContractsProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeQueue = useMemo(() => getQueueFromSearch(location.search), [location.search]);

  function jumpToQueue(queue: AwardQueueId) {
    navigate(`/awards-contracts?queue=${queue}`);
  }

  return (
    <ProcurexAwardFrame pageKey="awarding-contracts">
      <div className="main-layout procurement-layout awarding-contracts-page">
        <AwardSidebar title="Awarding and Contracts" subtitle="Relationship based workspace" activeQueue={activeQueue} />

        <main className="main-content procurement-content awarding-contracts-workspace">
          <AwardHero
            kicker="Awarding and Contracts"
            title="Your awarding and contracts — in every role you play"
            copy="Your company can be a buyer on tenders you created and a supplier on tenders you won. Both roles are shown below with clear next actions."
            stats={[
              { value: urgentActions.length, label: 'Urgent actions' },
              { value: 5, label: 'Award queues' },
              { value: contractActions.length, label: 'Contract actions' }
            ]}
          />

          <div className="award-info-banner">
            <strong>Role context</strong>
            <span>Buyer rows are tenders your organization created. Supplier rows are awards your organization won from another buyer.</span>
          </div>

          <section className="awarding-summary-grid">
            {summaryCards.map((item) => (
              <button
                className="awarding-summary-card"
                type="button"
                data-awarding-tab-jump={item.queue}
                data-route-search={`queue=${item.queue}`}
                aria-label={`Go to ${awardQueueLabels[item.queue]} tab`}
                onClick={() => jumpToQueue(item.queue)}
                key={item.queue}
              >
                <span className="summary-trend" aria-hidden="true">{item.trend}</span>
                <strong>{item.value}</strong>
                <span>{item.label} <em className="summary-view">View</em></span>
                <em>{item.detail}</em>
              </button>
            ))}
          </section>

          <section className="procurement-panel evaluation-panel awarding-tabs-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Lifecycle queues</span>
                <h2>Work is sorted by required action, with role shown inside each row</h2>
                <p className="panel-note">The dashboard keeps buyer and supplier responsibilities visible without forcing separate accounts.</p>
              </div>
            </div>

            <div className="supplier-detail-tabs awarding-contract-tabs" role="tablist" aria-label="Awarding and contract queues">
              {queueIds.map((queue) => (
                <button
                  className={`supplier-detail-tab${queue === activeQueue ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={queue === activeQueue}
                  data-tab={queue}
                  onClick={() => jumpToQueue(queue)}
                  key={queue}
                >
                  {awardQueueLabels[queue]}
                </button>
              ))}
            </div>

            <div className="awarding-tab-content">
              <div className={`tab-content ${activeQueue === 'my-urgent-actions' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="my-urgent-actions">
                <p className="awarding-tab-note">This queue aggregates buyer and supplier work that needs attention across awards, contracts, invoices, variations, and closure.</p>
                <SimpleTable headers={['Priority', 'Action', 'Related Tender/Contract', 'Due / Impact', 'Owner', 'Status', 'Button']} className="awarding-contracts-table">
                  {urgentActions.length === 0 ? <EmptyRows colSpan={7} message="No urgent award or contract actions yet." /> : null}
                  {urgentActions.map((row) => (
                    <tr key={row.id}>
                      <td><StatusBadge value={row.priority} /></td>
                      <td><strong>{row.action}</strong></td>
                      <td>{row.item}<span>{row.party}</span></td>
                      <td>{row.dueDate}</td>
                      <td><StatusBadge value={row.role} /></td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          data-select-tender={row.tenderId}
                          data-navigate={row.nav}
                          data-route-search={row.routeSearch}
                        >
                          {row.buttonLabel}
                        </button>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'awarding-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awarding-in-progress">
                <div className="queue-toolbar">
                  <label>Search <input className="form-input" placeholder="Tender name or reference" aria-label="Search pending awarding tenders" /></label>
                  <span>Showing {pendingAwards.length} of {pendingAwards.length}</span>
                </div>
                <SimpleTable headers={['Tender Title', 'Role', 'Type', 'Evaluation Results', 'Recommended Supplier', 'Award Status', 'Contract Status', 'Progress', 'Action']} className="awarding-contracts-table">
                  {pendingAwards.length === 0 ? <EmptyRows colSpan={9} message="No buyer-side awards are in progress yet." /> : null}
                  {pendingAwards.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong><span>{row.reference}</span></td>
                      <td><StatusBadge value={row.role} /></td>
                      <td>{row.procurementType}</td>
                      <td><StatusBadge value={row.evaluationStatus} /></td>
                      <td>{row.recommendedSupplier}</td>
                      <td><StatusBadge value={row.awardStatus} /></td>
                      <td><StatusBadge value={row.contractStatus} /></td>
                      <td><StatusBadge value={row.progressStatus} /><span>{row.progressStep}</span><small>{row.progressDate}</small></td>
                      <td>
                        <div className="awarding-row-actions">
                          <button className="btn btn-secondary btn-sm" type="button" data-select-tender={row.id} data-navigate="bid-evaluation">View Evaluation Report</button>
                          <button className="btn btn-primary btn-sm" type="button" data-select-tender={row.id} data-navigate="award-recommendation">{row.action}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'awards-received' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awards-received">
                <SimpleTable headers={['Tender Title', 'Role', 'Buyer', 'Type', 'Award Value', 'Award Status', 'Contract Status', 'Progress', 'Required Action']} className="awarding-contracts-table">
                  {supplierAwards.length === 0 ? <EmptyRows colSpan={9} message="No supplier awards have been received yet." /> : null}
                  {supplierAwards.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value="Supplier" /></td>
                      <td>{row.buyer}</td>
                      <td>{row.procurementType}</td>
                      <td>{formatMoney(row.awardValue, row.currency)}</td>
                      <td><StatusBadge value={row.awardStatus} /></td>
                      <td><StatusBadge value={row.contractStatus} /></td>
                      <td><StatusBadge value="Not saved" /><span>Evaluation Results</span><small>Jun 3, 2026</small></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          data-select-tender={row.id}
                          data-navigate="award-response"
                          data-route-search={`award=${row.id}`}
                        >
                          {row.requiredAction}
                        </button>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'contracts-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="contracts-in-progress">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Current Status', 'Required Action', 'Due Date']} className="awarding-contracts-table">
                  {contractActions.length === 0 ? <EmptyRows colSpan={6} message="No contracts are in progress yet." /> : null}
                  {contractActions.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.contract}</strong></td>
                      <td><StatusBadge value={row.role} /></td>
                      <td>{row.otherParty}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td><button className="btn btn-primary btn-sm" type="button" data-navigate="contract-negotiation" data-route-search={row.routeSearch}>{row.requiredAction}</button></td>
                      <td>{row.dueDate}</td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'active-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="active-contracts">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Progress', 'Next Milestone', 'Payment Status', 'Action']} className="awarding-contracts-table">
                  {activeContracts.length === 0 ? <EmptyRows colSpan={7} message="No active contracts are available yet." /> : null}
                  {activeContracts.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value={row.role} /></td>
                      <td>{row.otherParty}</td>
                      <td><div className="awarding-mini-progress"><span style={{ width: `${row.progress}%` }} /></div><small>{row.progressLabel}</small></td>
                      <td>{row.nextMilestone}</td>
                      <td><StatusBadge value={row.paymentStatus} /></td>
                      <td><button className="btn btn-primary btn-sm" type="button" data-navigate="post-award-tracking" data-route-search="mode=active&tab=milestones">Track</button></td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'closed-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="closed-contracts">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Final Value', 'Completion Date', 'Performance', 'Status', 'Action']} className="awarding-contracts-table">
                  {closedContracts.length === 0 ? <EmptyRows colSpan={8} message="No closed contracts are archived yet." /> : null}
                  {closedContracts.map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value={row.role} /></td>
                      <td>{row.otherParty}</td>
                      <td>{formatMoney(row.finalValue, row.currency)}</td>
                      <td>{row.completionDate}</td>
                      <td>{row.performanceRating}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          data-navigate="post-award-tracking"
                          data-route-search={routeWithSearch('', `mode=closed&tab=closure&contract=${row.id}`).replace(/^\?/, '')}
                        >
                          View Closure
                        </button>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
