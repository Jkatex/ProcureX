import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import {
  awardQueueLabels,
  summaryCards,
} from '../../fixtures';
import { awardsContractsApi } from '../../api';
import type { AwardContractDashboard, AwardQueueId, LifecycleAction } from '../../types';
import {
  AwardHero,
  AwardSidebar,
  lifecycleActionMatches,
  LifecycleActionCard,
  ProcurexAwardFrame,
  RemoteStatePanel,
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

function QueueCards({
  rows,
  emptyMessage,
  emptyAction,
  actionLabel,
  onAction
}: {
  rows: LifecycleAction[];
  emptyMessage: string;
  emptyAction?: ReactNode;
  actionLabel?: string;
  onAction: (row: LifecycleAction) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="scope-empty award-card-empty">
        <p>{emptyMessage}</p>
        {emptyAction ? <div className="inline-actions">{emptyAction}</div> : null}
      </div>
    );
  }
  return (
    <div className="award-lifecycle-card-grid">
      {rows.map((row) => (
        <LifecycleActionCard row={row} actionLabel={actionLabel} onAction={onAction} key={row.id} />
      ))}
    </div>
  );
}

function getQueueFromSearch(search: string): AwardQueueId {
  const queue = new URLSearchParams(search).get('queue') as AwardQueueId | null;
  return queue && queueIds.includes(queue) ? queue : 'my-urgent-actions';
}

function emptyQueueMessage(queue: AwardQueueId, hasSearch: boolean) {
  if (hasSearch) return 'No records match that search.';
  const messages: Record<AwardQueueId, string> = {
    'my-urgent-actions': 'No urgent award or contract actions yet. New required actions appear here after awards, notices, contracts, or payments need attention.',
    'awarding-in-progress': 'No buyer-side awards are in progress yet. Complete bid evaluation first, then award recommendations will appear here.',
    'awards-received': 'No supplier awards have been received yet. Buyer award notices appear here after they are issued.',
    'contracts-in-progress': 'No contracts are in progress yet. Accept an award notice or generate a draft contract first.',
    'active-contracts': 'No active contracts are available yet. Signed or mobilized contracts appear here after formation is complete.',
    'closed-contracts': 'No closed contracts are archived yet. Completed close-out records appear here after active contract execution.'
  };
  return messages[queue];
}

function emptyQueueAction(queue: AwardQueueId) {
  const actionByQueue: Record<AwardQueueId, { label: string; queue: AwardQueueId }> = {
    'my-urgent-actions': { label: 'Open Awarding Queue', queue: 'awarding-in-progress' },
    'awarding-in-progress': { label: 'Open Urgent Actions', queue: 'my-urgent-actions' },
    'awards-received': { label: 'Open Awarding Queue', queue: 'awarding-in-progress' },
    'contracts-in-progress': { label: 'Open Awards Received', queue: 'awards-received' },
    'active-contracts': { label: 'Open Contracts in Progress', queue: 'contracts-in-progress' },
    'closed-contracts': { label: 'Open Active Contracts', queue: 'active-contracts' }
  };
  const action = actionByQueue[queue];
  return (
    <button className="btn btn-secondary btn-sm" type="button" data-navigate="awarding-contracts" data-route-search={`queue=${action.queue}`}>
      {action.label}
    </button>
  );
}

function dueSoonCount(rows: LifecycleAction[]) {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return rows.filter((row) => {
    if (!row.dueDate) return false;
    const due = new Date(row.dueDate).getTime();
    return Number.isFinite(due) && due >= now && due - now <= week;
  }).length;
}

export function AwardingContractsProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeQueue = useMemo(() => getQueueFromSearch(location.search), [location.search]);
  const [dashboard, setDashboard] = useState<AwardContractDashboard | null>(null);
  const [selectedAction, setSelectedAction] = useState<LifecycleAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [queueSearch, setQueueSearch] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setDashboard(await awardsContractsApi.dashboard());
    } catch (error) {
      setDashboard(null);
      setLoadError(apiErrorMessage(error, 'Awarding and contract records could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const queues = dashboard?.queues ?? emptyQueues;
  const filteredQueues = useMemo(
    () =>
      queueIds.reduce((next, queue) => {
        next[queue] = queues[queue].filter((row) => lifecycleActionMatches(row, queueSearch));
        return next;
      }, { ...emptyQueues } as AwardContractDashboard['queues']),
    [queueSearch, queues]
  );
  const hasQueueSearch = queueSearch.trim().length > 0;
  const summary = dashboard?.summary ?? {
    urgentActions: queues['my-urgent-actions'].length,
    awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
    contractActions: queues['contracts-in-progress'].length + queues['active-contracts'].length
  };
  const allRows = useMemo(() => queueIds.flatMap((queue) => queues[queue]), [queues]);
  const buyerRowCount = allRows.filter((row) => row.roleContext === 'BUYER').length;
  const supplierRowCount = allRows.filter((row) => row.roleContext === 'SUPPLIER').length;
  const highRiskCount = allRows.filter((row) => /high|critical/i.test(row.riskLevel)).length;
  const soonCount = dueSoonCount(allRows);

  function jumpToQueue(queue: AwardQueueId) {
    navigate(`/awards-contracts?queue=${queue}`);
  }

  function followAction(row: LifecycleAction) {
    if (row.nextAction && !row.nextAction.canAct) return;
    setSelectedAction(row);
  }

  function continueAction(row: LifecycleAction) {
    navigate(row.nextAction?.url || row.nextRoute || '/awards-contracts');
  }

  return (
    <ProcurexAwardFrame pageKey="awarding-contracts">
      <div className="main-layout procurement-layout awarding-contracts-page">
        <AwardSidebar title="Awarding and Contracts" subtitle="Relationship based workspace" activeQueue={activeQueue} />

        <main className="main-content procurement-content awarding-contracts-workspace">
          <AwardHero
            kicker="Awarding and Contracts"
            title="Your awarding and contracts - in every role you play"
            copy="Your company can be a buyer on tenders you created and a supplier on tenders you won. Both roles are shown below with clear next actions."
            stats={[
              { value: summary.urgentActions, label: 'Urgent actions' },
              { value: summary.awardQueues, label: 'Award queues' },
              { value: summary.contractActions, label: 'Contract actions' }
            ]}
          />

          <section className="award-command-strip" aria-label="Award and contract command summary">
            <article><span>Buyer work</span><strong>{buyerRowCount}</strong></article>
            <article><span>Supplier work</span><strong>{supplierRowCount}</strong></article>
            <article><span>High risk</span><strong>{highRiskCount}</strong></article>
            <article><span>Due this week</span><strong>{soonCount}</strong></article>
          </section>

          {isLoading && !dashboard ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading awarding and contract records"
              message="ProcureX is fetching your role-aware award, contract, and post-award queues."
              status="Loading"
            />
          ) : null}

          {loadError ? (
            <RemoteStatePanel
              kicker="Service status"
              title="Awarding and contracts could not be loaded"
              message={loadError}
              status="Error"
              actionLabel="Retry loading"
              onAction={() => void loadDashboard()}
            />
          ) : null}

          {!isLoading && !loadError ? (
          <>
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

            <div className="queue-toolbar">
              <label>
                Search
                <input
                  className="form-input"
                  placeholder="Tender, reference, party, stage, status, or action"
                  aria-label="Search award and contract records"
                  value={queueSearch}
                  onChange={(event) => setQueueSearch(event.target.value)}
                />
              </label>
              <span>Showing {filteredQueues[activeQueue].length} of {queues[activeQueue].length}</span>
            </div>

            <div className="award-filter-chip-row" aria-label="Saved award and contract filters">
              {[
                { label: 'All', value: '' },
                { label: 'Buyer', value: 'buyer' },
                { label: 'Supplier', value: 'supplier' },
                { label: 'High risk', value: 'high' },
                { label: 'Contracts', value: 'contract' }
              ].map((chip) => (
                <button
                  className={`award-filter-chip${queueSearch.trim().toLowerCase() === chip.value ? ' active' : ''}`}
                  type="button"
                  onClick={() => setQueueSearch(chip.value)}
                  key={chip.label}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="awarding-tab-content">
              <div className={`tab-content ${activeQueue === 'my-urgent-actions' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="my-urgent-actions">
                <p className="awarding-tab-note">This queue aggregates buyer and supplier work that needs attention across awards, contracts, invoices, variations, and closure.</p>
                <QueueCards rows={filteredQueues['my-urgent-actions']} emptyMessage={emptyQueueMessage('my-urgent-actions', hasQueueSearch)} emptyAction={emptyQueueAction('my-urgent-actions')} onAction={followAction} />
              </div>

              <div className={`tab-content ${activeQueue === 'awarding-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awarding-in-progress">
                <QueueCards rows={filteredQueues['awarding-in-progress']} emptyMessage={emptyQueueMessage('awarding-in-progress', hasQueueSearch)} emptyAction={emptyQueueAction('awarding-in-progress')} onAction={followAction} />
              </div>

              <div className={`tab-content ${activeQueue === 'awards-received' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="awards-received">
                <QueueCards rows={filteredQueues['awards-received']} emptyMessage={emptyQueueMessage('awards-received', hasQueueSearch)} emptyAction={emptyQueueAction('awards-received')} onAction={followAction} />
              </div>

              <div className={`tab-content ${activeQueue === 'contracts-in-progress' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="contracts-in-progress">
                <QueueCards rows={filteredQueues['contracts-in-progress']} emptyMessage={emptyQueueMessage('contracts-in-progress', hasQueueSearch)} emptyAction={emptyQueueAction('contracts-in-progress')} onAction={followAction} />
              </div>

              <div className={`tab-content ${activeQueue === 'active-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="active-contracts">
                <QueueCards rows={filteredQueues['active-contracts']} emptyMessage={emptyQueueMessage('active-contracts', hasQueueSearch)} emptyAction={emptyQueueAction('active-contracts')} actionLabel="Track" onAction={followAction} />
              </div>

              <div className={`tab-content ${activeQueue === 'closed-contracts' ? 'tab-content--visible' : 'tab-content--hidden'}`} data-tab="closed-contracts">
                <QueueCards rows={filteredQueues['closed-contracts']} emptyMessage={emptyQueueMessage('closed-contracts', hasQueueSearch)} emptyAction={emptyQueueAction('closed-contracts')} actionLabel="View Closure" onAction={followAction} />
              </div>
            </div>
          </section>
          </>
          ) : null}
        </main>
        {selectedAction ? (
          <div className="award-action-drawer-backdrop" role="presentation">
            <aside className="award-action-drawer" role="dialog" aria-modal="true" aria-label={selectedAction.requiredAction}>
              <section className="award-action-form award-action-form-drawer">
                <div className="award-drawer-heading">
                  <div>
                    <span className="section-kicker">Lifecycle action</span>
                    <h2>{selectedAction.requiredAction}</h2>
                    <p>{selectedAction.title}</p>
                  </div>
                  <div className="award-drawer-heading-actions">
                    <StatusBadge value={selectedAction.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} />
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelectedAction(null)}>Close</button>
                  </div>
                </div>
                <section className="contract-overview-grid">
                  <article><span>Record</span><strong>{selectedAction.reference ?? selectedAction.noticeReference ?? selectedAction.tenderId ?? 'Lifecycle record'}</strong></article>
                  <article><span>Stage</span><strong>{selectedAction.currentStage}</strong></article>
                  <article><span>Status</span><strong>{selectedAction.status}</strong></article>
                  <article><span>Other party</span><strong>{selectedAction.otherParty}</strong></article>
                  <article><span>Due date</span><strong>{selectedAction.dueDate ? new Date(selectedAction.dueDate).toLocaleDateString() : 'Not dated'}</strong></article>
                </section>
                <div className="scope-empty">
                  Continue to the dedicated workspace for this action. ProcureX will keep the role checks, linked records, evidence requirements, and submission controls tied to the selected lifecycle record.
                </div>
                {selectedAction.nextAction?.canAct === false ? (
                  <p className="panel-note">{selectedAction.nextAction.disabledReason ?? 'This action is not available for your role.'}</p>
                ) : null}
                <div className="inline-actions award-drawer-footer">
                  <button className="btn btn-primary btn-sm" type="button" disabled={selectedAction.nextAction?.canAct === false} onClick={() => continueAction(selectedAction)}>
                    Continue
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => setSelectedAction(null)}>Cancel</button>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </ProcurexAwardFrame>
  );
}
