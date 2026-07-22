/* Renders the awards Contracts Awarding Contracts ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { awardQueueLabels } from '../../fixtures';
import { awardsContractsApi } from '../../api';
import type { AwardContractDashboard, AwardQueueId, LifecycleAction } from '../../types';
import {
  AwardHero,
  ProcurexAwardFrame,
  RemoteStatePanel,
  StatusBadge
} from './AwardsContractsProcurexShared';

const queueIds = Object.keys(awardQueueLabels) as AwardQueueId[];
const smartQueueOrder: AwardQueueId[] = [
  'awarding-in-progress',
  'awards-received',
  'contracts-in-progress',
  'contract-signing',
  'contract-preparation',
  'sample-procurement'
];
const emptyQueues: AwardContractDashboard['queues'] = {
  'sample-procurement': [],
  'contract-preparation': [],
  'awarding-in-progress': [],
  'awards-received': [],
  'contracts-in-progress': [],
  'contract-signing': []
};

const queueNotes: Record<AwardQueueId, string> = {
  'sample-procurement': 'Receive, verify, and track samples.',
  'contract-preparation': 'Prepare draft contracts and clauses.',
  'awarding-in-progress': 'Review awards and send notices.',
  'awards-received': 'Accept, clarify, or decline awards.',
  'contracts-in-progress': 'Review drafts and resolve requests.',
  'contract-signing': 'Request signatures and sign contracts.'
};

function explicitQueueFromSearch(search: string): AwardQueueId | null {
  const queue = new URLSearchParams(search).get('queue');
  return queue && queueIds.includes(queue as AwardQueueId) ? (queue as AwardQueueId) : null;
}

function smartDefaultQueue(queues: AwardContractDashboard['queues']): AwardQueueId {
  return smartQueueOrder.find((queue) => queues[queue].length > 0) ?? 'awarding-in-progress';
}

function emptyQueueMessage(queue: AwardQueueId) {
  const messages: Record<AwardQueueId, string> = {
    'sample-procurement': 'No sample actions are waiting yet.',
    'contract-preparation': 'No contracts are waiting for drafting yet.',
    'awarding-in-progress': 'No award decisions need action yet. After evaluation is complete, award recommendations and notice steps will appear here.',
    'awards-received': 'No supplier awards have been received yet.',
    'contracts-in-progress': 'No contracts need negotiation or final acceptance yet.',
    'contract-signing': 'No contracts are pending signature yet.'
  };
  return messages[queue];
}

function routeWithDefaultStep(row: LifecycleAction) {
  const route = row.nextAction?.url || row.nextRoute || '/awards-contracts';
  const [path, rawSearch = ''] = route.split('?');
  const params = new URLSearchParams(rawSearch);
  if (!params.has('step')) {
    if (path.includes('/recommendation')) params.set('step', 'award-decision');
    else if (path.includes('/award-response')) params.set('step', 'response');
    else if (path.includes('/drafting')) params.set('step', 'draft');
    else if (path.includes('/negotiation')) params.set('step', 'draft');
    else if (path.includes('/signing')) params.set('step', 'signatures');
    else if (path.includes('/post-award')) params.set('step', 'cmp');
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

function rowReference(row: LifecycleAction) {
  return row.reference ?? row.noticeReference ?? row.tenderId ?? row.contractId ?? 'Lifecycle record';
}

function rowButtonLabel(row: LifecycleAction, queue: AwardQueueId) {
  if (row.nextAction?.label) return row.nextAction.label;
  if (queue === 'awarding-in-progress') return 'Review award';
  if (queue === 'sample-procurement') return 'Manage samples';
  if (queue === 'contract-preparation') return 'Open drafting';
  if (queue === 'contracts-in-progress') return 'Negotiate contract';
  if (queue === 'contract-signing') return 'Open signing';
  if (queue === 'awards-received') return 'Respond to award';
  return row.requiredAction || 'Open';
}

function rowPriority(row: LifecycleAction) {
  if (row.riskLevel === 'Critical' || row.riskLevel === 'High') return row.riskLevel;
  if (/blocked|overdue|signature|required/i.test(`${row.status} ${row.requiredAction}`)) return 'High';
  if (/pending|review|awaiting|due/i.test(`${row.status} ${row.requiredAction}`)) return 'Medium';
  return row.riskLevel || 'Low';
}

function formatDue(row: LifecycleAction) {
  if (row.dueDate) return new Date(row.dueDate).toLocaleDateString();
  return row.currentStage || 'Not dated';
}

function queueRank(queue: AwardQueueId) {
  const index = smartQueueOrder.indexOf(queue);
  return index === -1 ? smartQueueOrder.length : index;
}

function priorityRank(row: LifecycleAction) {
  const priority = rowPriority(row);
  if (priority === 'Critical') return 0;
  if (priority === 'High') return 1;
  if (priority === 'Medium') return 2;
  return 3;
}

function dueTime(row: LifecycleAction) {
  if (!row.dueDate) return Number.MAX_SAFE_INTEGER;
  const time = new Date(row.dueDate).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function nextActionRows(queues: AwardContractDashboard['queues']) {
  return smartQueueOrder
    .flatMap((queue) => queues[queue].map((row) => ({ queue, row })))
    .filter(({ row }) => row.nextAction?.canAct !== false)
    .sort((left, right) => {
      const priority = priorityRank(left.row) - priorityRank(right.row);
      if (priority !== 0) return priority;
      const due = dueTime(left.row) - dueTime(right.row);
      if (due !== 0) return due;
      return queueRank(left.queue) - queueRank(right.queue);
    })
    .slice(0, 5);
}

function NextActionsPanel({ actions, onAction }: { actions: Array<{ queue: AwardQueueId; row: LifecycleAction }>; onAction: (row: LifecycleAction) => void }) {
  return (
    <section className="procurement-panel evaluation-panel awarding-next-actions-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Your next actions</span>
          <h2>Start with the next action</h2>
        </div>
        <StatusBadge value={actions.length ? `${actions.length} ready` : 'No actions'} tone={actions.length ? 'success' : 'info'} />
      </div>
      {actions.length ? (
        <div className="data-table evaluation-table-scroll awarding-contracts-table awarding-next-actions-table">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Next action</th>
                <th>Work area</th>
                <th>Due / Impact</th>
                <th>Role</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {actions.map(({ queue, row }) => (
                <tr key={`${queue}-${row.id}`}>
                  <td><StatusBadge value={rowPriority(row)} /></td>
                  <td>
                    <strong>{row.requiredAction}</strong>
                    <span>{row.title}</span>
                    <small>{row.otherParty}</small>
                  </td>
                  <td>
                    <strong>{awardQueueLabels[queue]}</strong>
                    <span>{row.currentStage}</span>
                  </td>
                  <td>{formatDue(row)}</td>
                  <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} tone="info" /></td>
                  <td><button className="btn btn-primary btn-sm" type="button" onClick={() => onAction(row)}>{rowButtonLabel(row, queue)}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="scope-empty award-card-empty">
          <p>No action needs your attention right now.</p>
        </div>
      )}
    </section>
  );
}

function QueueTable({
  queue,
  rows,
  onAction
}: {
  queue: AwardQueueId;
  rows: LifecycleAction[];
  onAction: (row: LifecycleAction) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="scope-empty award-card-empty">
        <p>{emptyQueueMessage(queue)}</p>
      </div>
    );
  }

  return (
    <div className="data-table evaluation-table-scroll awarding-contracts-table">
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Action</th>
            <th>Related Tender/Contract</th>
            <th>Due / Impact</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Button</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const disabled = row.nextAction?.canAct === false;
            return (
              <tr key={row.id}>
                <td><StatusBadge value={rowPriority(row)} /></td>
                <td>
                  <strong>{row.requiredAction}</strong>
                  <span>{row.currentStage}</span>
                </td>
                <td>
                  <strong>{row.title}</strong>
                  <span>{row.otherParty}</span>
                  <small>{rowReference(row)}</small>
                </td>
                <td>{formatDue(row)}</td>
                <td><StatusBadge value={row.roleContext === 'BUYER' ? 'Buyer' : 'Supplier'} tone="info" /></td>
                <td><StatusBadge value={row.status} /></td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    disabled={disabled}
                    title={row.nextAction?.disabledReason ?? row.requiredAction}
                    onClick={() => onAction(row)}
                  >
                    {rowButtonLabel(row, queue)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AwardingContractsProcurexPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AwardContractDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
  const activeQueue = useMemo(() => explicitQueueFromSearch(location.search) ?? smartDefaultQueue(queues), [location.search, queues]);
  const nextActions = useMemo(() => nextActionRows(queues), [queues]);
  const summary = dashboard?.summary ?? {
    awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
    contractActions: queues['sample-procurement'].length + queues['contract-preparation'].length + queues['contracts-in-progress'].length + queues['contract-signing'].length
  };

  function jumpToQueue(queue: AwardQueueId) {
    navigate(`/awards-contracts?queue=${queue}`);
  }

  function followAction(row: LifecycleAction) {
    if (row.nextAction && !row.nextAction.canAct) return;
    navigate(routeWithDefaultStep(row));
  }

  return (
    <ProcurexAwardFrame pageKey="awarding-contracts">
      <div className="main-layout procurement-layout awarding-contracts-page awarding-contracts-page--prototype">
        <main className="main-content procurement-content awarding-contracts-workspace">
          <AwardHero
            kicker="Awarding and Contracts"
            title="Your awards and contracts"
            copy="Track awards, contracts, and next actions."
            stats={[
              { value: queues['sample-procurement'].length, label: 'Sample actions' },
              { value: summary.awardQueues, label: 'Awards' },
              { value: summary.contractActions, label: 'Contract actions' }
            ]}
          />

          {isLoading && !dashboard ? (
            <RemoteStatePanel
              kicker="Loading"
              title="Loading awarding and contract records"
              message="Loading your queues."
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
              <NextActionsPanel actions={nextActions} onAction={followAction} />

              <section className="procurement-panel evaluation-panel awarding-tabs-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Lifecycle queues</span>
                    <h2>Choose a work area</h2>
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

                <p className="awarding-tab-note">{queueNotes[activeQueue]}</p>

                <div className="awarding-tab-content">
                  {queueIds.map((queue) => (
                    <div
                      className={`tab-content ${activeQueue === queue ? 'tab-content--visible' : 'tab-content--hidden'}`}
                      data-tab={queue}
                      key={queue}
                    >
                      <QueueTable queue={queue} rows={queues[queue]} onAction={followAction} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </main>
      </div>
    </ProcurexAwardFrame>
  );
}
