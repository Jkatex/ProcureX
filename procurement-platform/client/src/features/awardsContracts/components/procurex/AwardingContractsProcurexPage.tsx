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
const emptyQueues: AwardContractDashboard['queues'] = {
  'sample-procurement': [],
  'contract-preparation': [],
  'awarding-in-progress': [],
  'awards-received': [],
  'contracts-in-progress': [],
  'active-contracts': [],
  'closed-contracts': []
};

const queueNotes: Record<AwardQueueId, string> = {
  'sample-procurement': 'Buyer-side sample receipt, verification, custody, evaluation, lab testing, clarification, return, disposal, and reference sample records.',
  'contract-preparation': 'Buyer-owned contract drafts prepared after tender publication, while evaluation and award decisions remain locked.',
  'awarding-in-progress': 'Buyer-side tenders moving from evaluation result, recommendation, approval, notices, and contract handoff.',
  'awards-received': 'Supplier-side awards awaiting notice review, response, clarification, acceptance, or contract formation.',
  'contracts-in-progress': 'Drafting, review, negotiation, approval, document completion, and signing actions.',
  'active-contracts': 'Contracts under mobilization, delivery, inspections, risk control, invoice review, payment tracking, or warranty work.',
  'closed-contracts': 'Completed, terminated, or archived contract records with closure and performance history.'
};

function getQueueFromSearch(search: string): AwardQueueId {
  const queue = new URLSearchParams(search).get('queue') as AwardQueueId | null;
  return queue && queueIds.includes(queue) ? queue : 'sample-procurement';
}

function emptyQueueMessage(queue: AwardQueueId) {
  const messages: Record<AwardQueueId, string> = {
    'sample-procurement': 'No sample procurement actions are waiting yet.',
    'contract-preparation': 'No pre-award contract drafts are being prepared yet.',
    'awarding-in-progress': 'No buyer-side awards are in progress yet.',
    'awards-received': 'No supplier awards have been received yet.',
    'contracts-in-progress': 'No contracts are in progress yet.',
    'active-contracts': 'No active contracts are available yet.',
    'closed-contracts': 'No closed contracts are archived yet.'
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
    else if (path.includes('/negotiation')) params.set('step', 'draft');
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
  if (queue === 'sample-procurement') return 'Manage samples';
  if (queue === 'contract-preparation') return 'Prepare contract';
  if (queue === 'active-contracts') return 'Track';
  if (queue === 'closed-contracts') return 'View Closure';
  if (queue === 'awards-received') return 'Respond';
  return row.requiredAction || 'Review';
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
  const activeQueue = useMemo(() => getQueueFromSearch(location.search), [location.search]);
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
  const summary = dashboard?.summary ?? {
    awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
    contractActions: queues['sample-procurement'].length + queues['contract-preparation'].length + queues['contracts-in-progress'].length + queues['active-contracts'].length
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
            title="Your awarding and contracts - in every role you play"
            copy="Your company can be a buyer on tenders you created and a supplier on tenders you won. Both roles are shown below with clear next actions."
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
              <section className="procurement-panel evaluation-panel awarding-tabs-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Lifecycle queues</span>
                    <h2>Work is sorted by required action, with role shown inside each row</h2>
                    <p>The dashboard keeps buyer and supplier responsibilities visible without forcing separate accounts.</p>
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
