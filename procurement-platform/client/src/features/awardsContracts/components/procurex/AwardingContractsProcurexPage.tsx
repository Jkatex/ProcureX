import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  awardQueueLabels,
  summaryCards,
} from '../../fixtures';
import { awardsContractsApi } from '../../api';
import type { AwardContractDashboard, AwardQueueId, LifecycleAction } from '../../types';
import {
  AwardHero,
  AwardSidebar,
  formatMoney,
  ProcurexAwardFrame,
  SimpleTable,
  StatusBadge
} from './AwardsContractsProcurexShared';

const queueIds = Object.keys(awardQueueLabels) as AwardQueueId[];
const emptyQueues: AwardContractDashboard['queues'] = {
  'my-urgent-actions': [],
  'awarding-in-progress': [],
  'awards-received': [],
  'contracts-in-progress': [],
  'active-contracts': [],
  'closed-contracts': []
};

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
  const [dashboard, setDashboard] = useState<AwardContractDashboard | null>(null);

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    let active = true;
    awardsContractsApi.dashboard()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch(() => {
        if (active) setDashboard(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const queues = dashboard?.queues ?? emptyQueues;
  const summary = dashboard?.summary ?? {
    urgentActions: queues['my-urgent-actions'].length,
    awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
    contractActions: queues['contracts-in-progress'].length + queues['active-contracts'].length
  };

  function jumpToQueue(queue: AwardQueueId) {
    navigate(`/awards-contracts?queue=${queue}`);
  }

  function followAction(row: LifecycleAction) {
    if (row.nextAction && !row.nextAction.canAct) return;
    navigate(row.nextAction?.url || row.nextRoute || '/awards-contracts');
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
              { value: summary.urgentActions, label: 'Urgent actions' },
              { value: summary.awardQueues, label: 'Award queues' },
              { value: summary.contractActions, label: 'Contract actions' }
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
                <strong>{queues[item.queue].length}</strong>
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
                  {queues['my-urgent-actions'].length === 0 ? <EmptyRows colSpan={7} message="No urgent award or contract actions yet." /> : null}
                  {queues['my-urgent-actions'].map((row) => (
                    <tr key={row.id}>
                      <td><StatusBadge value={row.riskLevel} /></td>
                      <td><strong>{row.requiredAction}</strong><span>{row.currentStage}</span></td>
                      <td>{row.title}<span>{row.otherParty}</span></td>
                      <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'Not dated'}</td>
                      <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} /></td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          disabled={row.nextAction?.canAct === false}
                          title={row.nextAction?.disabledReason ?? row.requiredAction}
                          onClick={() => followAction(row)}
                        >
                          {row.nextAction?.label ?? 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'awarding-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awarding-in-progress">
                <div className="queue-toolbar">
                  <label>Search <input className="form-input" placeholder="Tender name or reference" aria-label="Search pending awarding tenders" /></label>
                  <span>Showing {queues['awarding-in-progress'].length} of {queues['awarding-in-progress'].length}</span>
                </div>
                <SimpleTable headers={['Tender Title', 'Role', 'Stage', 'Recommended Supplier', 'Award Status', 'Due / Risk', 'Action']} className="awarding-contracts-table">
                  {queues['awarding-in-progress'].length === 0 ? <EmptyRows colSpan={7} message="No buyer-side awards are in progress yet." /> : null}
                  {queues['awarding-in-progress'].map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong><span>{row.tenderId}</span></td>
                      <td><StatusBadge value="Buyer" /></td>
                      <td>{row.currentStage}</td>
                      <td>{row.otherParty}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td><StatusBadge value={row.riskLevel} /><span>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'Not dated'}</span></td>
                      <td>
                        <div className="awarding-row-actions">
                          <button className="btn btn-secondary btn-sm" type="button" data-navigate="bid-evaluation">View Evaluation</button>
                          <button className="btn btn-primary btn-sm" type="button" disabled={row.nextAction?.canAct === false} title={row.nextAction?.disabledReason ?? row.requiredAction} onClick={() => followAction(row)}>{row.nextAction?.label ?? row.requiredAction}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'awards-received' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awards-received">
                <SimpleTable headers={['Tender Title', 'Role', 'Buyer', 'Award Value', 'Status', 'Stage', 'Required Action']} className="awarding-contracts-table">
                  {queues['awards-received'].length === 0 ? <EmptyRows colSpan={7} message="No supplier awards have been received yet." /> : null}
                  {queues['awards-received'].map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value="Supplier" /></td>
                      <td>{row.otherParty}</td>
                      <td>{row.amount === null ? 'Not priced' : formatMoney(row.amount, row.currency)}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>{row.currentStage}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => followAction(row)}
                        >
                          {row.nextAction?.label ?? row.requiredAction}
                        </button>
                      </td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'contracts-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="contracts-in-progress">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Current Status', 'Required Action', 'Due Date']} className="awarding-contracts-table">
                  {queues['contracts-in-progress'].length === 0 ? <EmptyRows colSpan={6} message="No contracts are in progress yet." /> : null}
                  {queues['contracts-in-progress'].map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} /></td>
                      <td>{row.otherParty}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td><button className="btn btn-primary btn-sm" type="button" disabled={row.nextAction?.canAct === false} title={row.nextAction?.disabledReason ?? row.requiredAction} onClick={() => followAction(row)}>{row.nextAction?.label ?? row.requiredAction}</button></td>
                      <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'Not dated'}</td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'active-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="active-contracts">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Stage', 'Next Action', 'Risk', 'Action']} className="awarding-contracts-table">
                  {queues['active-contracts'].length === 0 ? <EmptyRows colSpan={7} message="No active contracts are available yet." /> : null}
                  {queues['active-contracts'].map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} /></td>
                      <td>{row.otherParty}</td>
                      <td>{row.currentStage}</td>
                      <td>{row.requiredAction}</td>
                      <td><StatusBadge value={row.riskLevel} /></td>
                      <td><button className="btn btn-primary btn-sm" type="button" onClick={() => followAction(row)}>Track</button></td>
                    </tr>
                  ))}
                </SimpleTable>
              </div>

              <div className={`tab-content ${activeQueue === 'closed-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="closed-contracts">
                <SimpleTable headers={['Contract', 'Your Role', 'Other Party', 'Final Value', 'Stage', 'Status', 'Action']} className="awarding-contracts-table">
                  {queues['closed-contracts'].length === 0 ? <EmptyRows colSpan={7} message="No closed contracts are archived yet." /> : null}
                  {queues['closed-contracts'].map((row) => (
                    <tr key={row.id}>
                      <td><strong>{row.title}</strong></td>
                      <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} /></td>
                      <td>{row.otherParty}</td>
                      <td>{row.amount === null ? 'Not priced' : formatMoney(row.amount, row.currency)}</td>
                      <td>{row.currentStage}</td>
                      <td><StatusBadge value={row.status} /></td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => followAction(row)}
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
