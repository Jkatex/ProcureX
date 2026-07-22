/* Connects post Award route pages to their feature shell so routing stays thinner than workflow UI logic. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiErrorMessage } from '@/shared/api/errors';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';
import { postAwardApi } from '../api';
import type { PostAwardContractRow, PostAwardRecord, PostAwardStageId, PostAwardTask, PostAwardWorkspace } from '../types';

const stageOrder: PostAwardStageId[] = ['setup', 'delivery', 'inspections', 'finance', 'risk', 'changes', 'claims', 'documents', 'closeout', 'performance', 'history'];

function routeFor(pageKey: string) {
  const routes: Record<string, string> = {
    'workspace-dashboard': '/dashboard',
    'account-profile': '/identity/profile',
    marketplace: '/procurement/marketplace',
    'communication-center': '/communication',
    'bid-evaluation': '/evaluation',
    'awarding-contracts': '/awards-contracts',
    'post-award': '/post-award',
    'records-history': '/records'
  };
  return routes[pageKey] ?? '/dashboard';
}

function queryValue(search: string, key: string) {
  return new URLSearchParams(search).get(key) ?? '';
}

function pathStage(pathname: string): PostAwardStageId | '' {
  const [, tail = ''] = pathname.split('/post-award/');
  const candidate = tail.split('/')[0] as PostAwardStageId;
  return stageOrder.includes(candidate) ? candidate : '';
}

function selectedStage(location: ReturnType<typeof useLocation>): PostAwardStageId {
  const fromPath = pathStage(location.pathname);
  const fromQuery = queryValue(location.search, 'stage') as PostAwardStageId;
  if (fromPath) return fromPath;
  if (stageOrder.includes(fromQuery)) return fromQuery;
  return 'delivery';
}

function dateLabel(value?: string | null) {
  if (!value) return 'Not dated';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function isoNow() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number | string | null | undefined, currency = 'TZS') {
  if (value === null || value === undefined || value === '') return 'Not priced';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${currency} ${numeric.toLocaleString()}` : `${currency} ${value}`;
}

function totalContractValue(contracts: PostAwardContractRow[]) {
  return contracts.reduce((sum, contract) => {
    const amount = Number(contract.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

function hasElevatedRisk(contract: PostAwardContractRow) {
  return /critical|high/i.test(contract.riskLevel);
}

function hasDueDate(contract: PostAwardContractRow) {
  return Boolean(contract.dueDate);
}

function badgeTone(value: string) {
  if (/critical|high|blocked|rejected|terminated|failed|open ncr/i.test(value)) return 'error';
  if (/medium|submitted|review|pending|open|waiting|warning/i.test(value)) return 'warning';
  if (/accepted|approved|closed|paid|complete|success|active|done|matched|healthy/i.test(value)) return 'success';
  return 'info';
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ value, tone }: { value: string; tone?: string }) {
  return <span className={`post-award-pill post-award-pill-${tone ?? badgeTone(value)}`}>{humanize(value)}</span>;
}

export function PostAwardAppPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [contracts, setContracts] = useState<PostAwardContractRow[]>([]);
  const [workspace, setWorkspace] = useState<PostAwardWorkspace | null>(null);
  const [activeStage, setActiveStage] = useState<PostAwardStageId>(() => selectedStage(location));
  const [activeTask, setActiveTask] = useState<PostAwardTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminQueueView, setAdminQueueView] = useState<'BUYER' | 'SUPPLIER'>('BUYER');
  const selectedContractId = queryValue(location.search, 'contract');

  useEffect(() => {
    document.body.dataset.page = 'post-award';
    document.body.dataset.procurexReactPage = 'true';
    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  useEffect(() => {
    setActiveStage(selectedStage(location));
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    async function loadContracts() {
      setLoading(true);
      setError('');
      try {
        const rows = await postAwardApi.contracts();
        if (cancelled) return;
        setContracts(rows);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Contracts could not be loaded.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadContracts();
    return () => {
      cancelled = true;
    };
  }, [selectedContractId]);

  useEffect(() => {
    if (!selectedContractId) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setError('');
      try {
        const next = await postAwardApi.workspace(selectedContractId);
        if (!cancelled) {
          setWorkspace(next);
          setActiveTask(null);
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'Contract details could not be loaded.'));
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [selectedContractId]);

  const activeSection = useMemo(
    () => workspace?.workflowSections.find((section) => section.id === activeStage) ?? workspace?.workflowSections[0],
    [activeStage, workspace]
  );
  const activeStageRecords = activeSection?.records ?? [];
  const queue = useMemo(() => tasksForViewer(workspace), [workspace]);
  const adminQueue = workspace?.contract.viewerRole === 'ADMIN'
    ? (adminQueueView === 'BUYER' ? workspace.buyerTasks : workspace.supplierTasks)
    : queue;
  const stageTasks = adminQueue.filter((task) => task.sectionId === activeStage);
  const recommendedTask = stageTasks.find((task) => task.status === 'READY') ?? stageTasks[0] ?? queue.find((task) => task.status === 'READY') ?? queue[0] ?? null;
  const readyCount = queue.filter((task) => task.status === 'READY').length;
  const blockedCount = queue.filter((task) => task.status === 'BLOCKED').length;

  function selectContract(contractId: string) {
    navigate(`/post-award?contract=${encodeURIComponent(contractId)}&stage=delivery`);
    setActiveTask(null);
  }

  function openContractStage(contractId: string, stageId: PostAwardStageId = 'delivery') {
    navigate(`/post-award?contract=${encodeURIComponent(contractId)}&stage=${stageId}`);
    setActiveTask(null);
  }

  function selectStage(stageId: PostAwardStageId) {
    setActiveStage(stageId);
    setActiveTask(null);
    navigate(`/post-award?contract=${encodeURIComponent(selectedContractId)}&stage=${stageId}`, { replace: true });
  }

  function applyWorkspace(next: PostAwardWorkspace) {
    setWorkspace(next);
    setActiveTask(null);
  }

  return (
    <>
      <WorkspaceTopBar title="Contract Tracking" onNavigate={(pageKey) => navigate(routeFor(pageKey))} />
      <main className="post-award-app" data-post-award-app>
        <section className="post-award-workspace">
          {!selectedContractId ? (
            <PostAwardEntrance contracts={contracts} loading={loading} error={error} onOpen={openContractStage} />
          ) : (
            <>
              <ContractSelector contracts={contracts} loading={loading} selectedContractId={selectedContractId} onSelect={selectContract} />
              {error ? <div className="post-award-alert">{error}</div> : null}
              {!workspace && !workspaceLoading ? (
                <div className="post-award-empty post-award-empty-large">
                  <strong>Select a contract</strong>
                  <span>Choose a signed contract to continue.</span>
                </div>
              ) : null}
              {workspace ? (
                <>
              <PostAwardHero workspace={workspace} readyCount={readyCount} blockedCount={blockedCount} recommendedTask={recommendedTask} />
              <StatusSummary workspace={workspace} queueLength={queue.length} readyCount={readyCount} blockedCount={blockedCount} />
              <OperationalPulse workspace={workspace} />
              <StageStepper sections={workspace.workflowSections} activeStage={activeStage} tasks={adminQueue} onSelect={selectStage} />

              <section className="post-award-stage-panel">
                <div className="post-award-pane-head post-award-pane-head-large">
                  <div>
                    <span>{activeSection?.description}</span>
                    <strong>{activeSection?.label}</strong>
                  </div>
                  {workspaceLoading ? <em>Refreshing...</em> : null}
                </div>
                <WorkflowSteps section={activeSection} />
                <Blockers workspace={workspace} stageId={activeStage} />
              </section>

              <section className="post-award-work-panel">
                <div className="post-award-panel-intro">
                  <span>Next task</span>
                  <h2>{workspace.contract.viewerRole === 'ADMIN' ? `${humanize(adminQueueView)} tasks` : `${humanize(workspace.contract.viewerRole)} tasks`}</h2>
                  <p>{recommendedTask ? recommendedTask.detail : 'No task is waiting here.'}</p>
                </div>
                {workspace.contract.viewerRole === 'ADMIN' ? (
                  <div className="post-award-role-toggle" role="tablist" aria-label="Task owner">
                    <button className={adminQueueView === 'BUYER' ? 'active' : ''} type="button" onClick={() => setAdminQueueView('BUYER')}>Buyer tasks</button>
                    <button className={adminQueueView === 'SUPPLIER' ? 'active' : ''} type="button" onClick={() => setAdminQueueView('SUPPLIER')}>Supplier tasks</button>
                  </div>
                ) : null}
                <TaskQueue title={workspace.contract.viewerRole === 'ADMIN' ? `${humanize(adminQueueView)} tasks` : `${humanize(workspace.contract.viewerRole)} tasks`} tasks={stageTasks} activeTask={activeTask} onSelect={setActiveTask} />
              </section>

              <section className="post-award-guided-panel" aria-label="Contract action">
                <div className="post-award-pane-head post-award-pane-head-large">
                  <div>
                    <span>Action</span>
                    <strong>{activeTask ? activeTask.title : recommendedTask ? recommendedTask.title : 'Choose a task'}</strong>
                  </div>
                  <StatusPill value={activeTask?.owner ?? recommendedTask?.owner ?? workspace.contract.viewerRole} tone="info" />
                </div>
                {activeTask ? (
                  <PostAwardActionForm task={activeTask} workspace={workspace} onSaved={applyWorkspace} />
                ) : recommendedTask ? (
                  <div className="post-award-empty post-award-guided-empty">
                    <strong>Suggested task</strong>
                    <span>{recommendedTask.detail}</span>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => setActiveTask(recommendedTask)}>Start task</button>
                  </div>
                ) : (
                  <div className="post-award-empty">Choose a task to start.</div>
                )}
              </section>

              <FinancialEligibility workspace={workspace} />

              <section className="post-award-records-panel">
                <div className="post-award-pane-head post-award-pane-head-large">
                  <div>
                    <span>Saved items</span>
                    <strong>{activeSection?.label}</strong>
                  </div>
                  <StatusPill value={`${activeStageRecords.length} records`} tone="info" />
                </div>
                <RecordTable records={activeStageRecords} />
              </section>

              <SecondaryRegisters workspace={workspace} />
                </>
              ) : null}
            </>
          )}
        </section>
      </main>
    </>
  );
}

function PostAwardEntrance({ contracts, loading, error, onOpen }: { contracts: PostAwardContractRow[]; loading: boolean; error: string; onOpen: (contractId: string, stageId?: PostAwardStageId) => void }) {
  const currency = contracts.find((contract) => contract.currency)?.currency ?? 'TZS';
  const activeCount = contracts.filter((contract) => /active|in progress|signed/i.test(contract.status)).length;
  const highRiskCount = contracts.filter(hasElevatedRisk).length;
  const dueCount = contracts.filter(hasDueDate).length;
  const buyerCount = contracts.filter((contract) => contract.viewerRole === 'BUYER').length;
  const supplierCount = contracts.filter((contract) => contract.viewerRole === 'SUPPLIER').length;

  return (
    <div className="post-award-entrance">
      <section className="procurement-hero evaluation-hero-panel award-hero-panel post-award-entrance-hero">
        <div>
          <span className="section-kicker">Track signed contracts</span>
          <h1>Contract tracking</h1>
          <p>Follow signed contracts from setup to delivery, payment, changes, close-out, and performance.</p>
        </div>
        <div className="evaluation-hero-stats">
          <div>
            <strong>{loading ? '...' : contracts.length}</strong>
            <span>Contracts</span>
          </div>
          <div>
            <strong>{loading ? '...' : buyerCount}</strong>
            <span>Buyer side</span>
          </div>
          <div>
            <strong>{loading ? '...' : supplierCount}</strong>
            <span>Supplier side</span>
          </div>
        </div>
      </section>

      {error ? <div className="post-award-alert post-award-entrance-alert">{error}</div> : null}

      <section className="post-award-entrance-summary" aria-label="Contract summary">
        <article>
          <span>Active contracts</span>
          <strong>{activeCount}</strong>
          <p>Contracts you can track now.</p>
        </article>
        <article>
          <span>Need attention</span>
          <strong>{highRiskCount}</strong>
          <p>Contracts marked high or critical risk.</p>
        </article>
        <article>
          <span>Due soon</span>
          <strong>{dueCount}</strong>
          <p>Contracts with a due date.</p>
        </article>
        <article>
          <span>Total value</span>
          <strong>{money(totalContractValue(contracts), currency)}</strong>
          <p>Total value of contracts shown here.</p>
        </article>
      </section>

      <section className="post-award-contract-selector post-award-entrance-contracts" aria-label="Contracts">
        <div className="post-award-pane-head post-award-pane-head-large">
          <div>
            <span>Signed contracts</span>
            <strong>Choose a contract</strong>
          </div>
          <StatusPill value={loading ? 'Loading' : `${contracts.length} contracts`} tone="info" />
        </div>
        {loading ? <div className="post-award-empty">Loading contracts...</div> : null}
        {!loading && !error && contracts.length === 0 ? (
          <div className="post-award-empty post-award-empty-large">
            <strong>No contracts ready yet</strong>
            <span>Finish signing before a contract appears here.</span>
          </div>
        ) : null}
        {contracts.length ? (
          <div className="post-award-entrance-table-wrap">
            <table className="post-award-table post-award-entrance-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Role</th>
                  <th>With</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Due / step</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>
                      <strong>{contract.title}</strong>
                      <span>{contract.reference}</span>
                    </td>
                    <td><StatusPill value={contract.viewerRole} tone="info" /></td>
                    <td>{contract.viewerRole === 'SUPPLIER' ? contract.buyerName : contract.supplierName ?? 'Supplier pending'}</td>
                    <td><StatusPill value={contract.status} /></td>
                    <td><StatusPill value={contract.riskLevel || 'Normal'} /></td>
                    <td>{contract.dueDate ? dateLabel(contract.dueDate) : contract.stage}</td>
                    <td>{money(contract.amount, contract.currency)}</td>
                    <td>
                      <div className="inline-actions post-award-entrance-actions">
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => onOpen(contract.id)}>Open</button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(contract.id, 'setup')}>Setup</button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(contract.id, 'delivery')}>Delivery</button>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onOpen(contract.id, 'finance')}>Finance</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ContractSelector({ contracts, loading, selectedContractId, onSelect }: { contracts: PostAwardContractRow[]; loading: boolean; selectedContractId: string; onSelect: (contractId: string) => void }) {
  const selected = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0];
  return (
    <section className="post-award-contract-selector" aria-label="Contracts">
      <div className="post-award-pane-head post-award-pane-head-large">
        <div>
          <span>Selected contract</span>
          <strong>{selected ? selected.title : 'Choose a contract'}</strong>
        </div>
        <StatusPill value={`${contracts.length} contracts`} tone="info" />
      </div>
      {loading ? <div className="post-award-empty">Loading contracts...</div> : null}
      {!loading && contracts.length === 0 ? <div className="post-award-empty">No signed contracts are ready yet.</div> : null}
      {contracts.length ? (
        <select className="form-input post-award-contract-select" value={selectedContractId || selected?.id || ''} onChange={(event) => onSelect(event.target.value)} aria-label="Select contract">
          {contracts.map((contract) => (
            <option value={contract.id} key={contract.id}>
              {contract.reference} - {contract.title}
            </option>
          ))}
        </select>
      ) : null}
    </section>
  );
}

function PostAwardHero({ workspace, readyCount, blockedCount, recommendedTask }: { workspace: PostAwardWorkspace; readyCount: number; blockedCount: number; recommendedTask: PostAwardTask | null }) {
  return (
    <header className="post-award-contract-header">
      <div>
        <span>{workspace.contract.reference} / {workspace.procurementType}</span>
        <h1>{workspace.contract.title}</h1>
        <p>{workspace.contract.buyerName} / {workspace.contract.supplierName ?? 'Supplier pending'}</p>
        <div className="post-award-hero-next">
          <span>Next task</span>
          <strong>{recommendedTask ? `${humanize(recommendedTask.owner)} task ready` : 'No task waiting'}</strong>
        </div>
      </div>
      <div className="post-award-header-meta">
        <StatusPill value={workspace.contract.status} />
        <StatusPill value={workspace.contract.viewerRole} tone="info" />
        <strong>{money(workspace.contract.amount, workspace.contract.currency)}</strong>
        <small>{readyCount} ready / {blockedCount} stuck</small>
      </div>
    </header>
  );
}

function StatusSummary({ workspace, queueLength, readyCount, blockedCount }: { workspace: PostAwardWorkspace; queueLength: number; readyCount: number; blockedCount: number }) {
  return (
    <section className="post-award-command-strip">
      <article className={`post-award-health post-award-health-${workspace.health.level.toLowerCase()}`}>
        <span>Overall status</span>
        <strong>{workspace.health.label}</strong>
        <p>{workspace.health.summary}</p>
      </article>
      <article>
        <span>Ready tasks</span>
        <strong>{readyCount}</strong>
        <p>{queueLength ? 'Open the next task assigned to you.' : 'No tasks are due.'}</p>
      </article>
      <article>
        <span>Problems</span>
        <strong>{blockedCount}</strong>
        <p>{blockedCount ? 'Fix these before the next step.' : 'No problems in your task list.'}</p>
      </article>
      <article>
        <span>Ready to invoice</span>
        <strong>{workspace.financialEligibility.invoiceableRecords.length}</strong>
        <p>{money(workspace.financialEligibility.payableAmount, workspace.financialEligibility.currency)} ready for review.</p>
      </article>
    </section>
  );
}

function StageStepper({ sections, activeStage, tasks, onSelect }: { sections: PostAwardWorkspace['workflowSections']; activeStage: PostAwardStageId; tasks: PostAwardTask[]; onSelect: (stageId: PostAwardStageId) => void }) {
  return (
    <nav className="post-award-stages" aria-label="Contract steps">
      {sections.map((section, index) => {
        const openTasks = tasks.filter((task) => task.sectionId === section.id && task.status !== 'DONE').length;
        return (
          <button className={section.id === activeStage ? 'active' : ''} type="button" onClick={() => onSelect(section.id)} key={section.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{section.label}</strong>
            <em>{openTasks} open</em>
            <StatusPill value={section.status} />
          </button>
        );
      })}
    </nav>
  );
}

function tasksForViewer(workspace: PostAwardWorkspace | null) {
  if (!workspace) return [];
  if (workspace.contract.viewerRole === 'SUPPLIER') return workspace.supplierTasks;
  if (workspace.contract.viewerRole === 'BUYER') return workspace.buyerTasks;
  return [...workspace.buyerTasks, ...workspace.supplierTasks];
}

function WorkflowSteps({ section }: { section?: PostAwardWorkspace['workflowSections'][number] }) {
  if (!section) return null;
  return (
    <div className="post-award-workflow-steps">
      {section.steps.map((step) => (
        <article key={step.id}>
          <span>{step.owner}</span>
          <strong>{step.label}</strong>
          <StatusPill value={step.status} />
          <em>{step.count} records</em>
        </article>
      ))}
    </div>
  );
}

function Blockers({ workspace, stageId }: { workspace: PostAwardWorkspace; stageId: PostAwardStageId }) {
  const blockers = workspace.currentBlockers.filter((blocker) => blocker.sectionId === stageId);
  if (blockers.length === 0) return null;
  return (
    <section className="post-award-blockers">
      {blockers.map((blocker) => (
        <article key={blocker.id}>
          <StatusPill value={blocker.severity} />
          <strong>{blocker.title}</strong>
          <p>{blocker.detail}</p>
        </article>
      ))}
    </section>
  );
}

function TaskQueue({ title, tasks, activeTask, onSelect }: { title: string; tasks: PostAwardTask[]; activeTask: PostAwardTask | null; onSelect: (task: PostAwardTask) => void }) {
  const visible = tasks;
  return (
    <section className="post-award-task-panel">
      <div className="post-award-pane-head">
        <span>{title}</span>
        <strong>{tasks.length}</strong>
      </div>
      {visible.length === 0 ? <div className="post-award-empty">No tasks here.</div> : null}
      <div className="post-award-action-list">
        {visible.map((task) => (
          <button
            className={`post-award-action-card${activeTask?.id === task.id ? ' active' : ''}`}
            type="button"
            disabled={task.status === 'DONE'}
            title={task.detail}
            onClick={() => onSelect(task)}
            key={`${task.owner}-${task.id}`}
          >
            <span>{task.owner} / {task.priority}</span>
            <strong>{task.title}</strong>
            <em>{task.detail}</em>
            <StatusPill value={task.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function FinancialEligibility({ workspace }: { workspace: PostAwardWorkspace }) {
  const finance = workspace.financialEligibility;
  if (finance.invoiceableRecords.length === 0 && finance.blockedReasons.length === 0 && finance.paymentQueue.length === 0 && finance.financialCloseoutBlockers.length === 0) return null;
  return (
    <section className="post-award-finance-box">
      <div className="post-award-pane-head">
        <span>Payments</span>
        <strong>{finance.invoiceableRecords.length + finance.paymentQueue.length}</strong>
      </div>
      <div className="post-award-finance-metrics">
        <article><span>Ready to pay</span><strong>{money(finance.payableAmount, finance.currency)}</strong></article>
        <article><span>Paid</span><strong>{money(finance.paidAmount, finance.currency)}</strong></article>
        <article><span>Held back</span><strong>{money(finance.retentionSummary.remainingRetention, finance.retentionSummary.currency)}</strong></article>
        <article><span>Advance left</span><strong>{money(finance.advanceRecoverySummary.outstandingAmount, finance.advanceRecoverySummary.currency)}</strong></article>
        <article><span>Deductions</span><strong>{money(finance.deductionSummary.pendingDeductionsAmount, finance.deductionSummary.currency)}</strong></article>
        <article><span>Receipts needed</span><strong>{finance.supplierReceiptPending}</strong></article>
      </div>
      {finance.paymentQueue.length ? (
        <div className="post-award-eligible-list">
          {finance.paymentQueue.slice(0, 6).map((item) => (
            <article key={`${item.type}-${item.id}-${item.actionKey}`}>
              <strong>{item.title}</strong>
              <span>{humanize(item.actionKey)} / {item.owner}</span>
              <em>{money(item.amount, item.currency)}</em>
              {item.blockingReasons.length ? <small>{item.blockingReasons.join(', ')}</small> : null}
            </article>
          ))}
        </div>
      ) : null}
      {finance.invoiceableRecords.length ? (
        <div className="post-award-eligible-list">
          {finance.invoiceableRecords.map((record) => (
            <article key={`${record.type}-${record.id}`}>
              <strong>{record.title}</strong>
              <span>{humanize(record.type)} / {record.status}</span>
              <em>{record.remainingInvoiceableAmount === null ? money(record.amount, record.currency) : `${money(record.remainingInvoiceableAmount, record.currency)} left`}</em>
              {record.blockingReasons.length ? <small>{record.blockingReasons.join(', ')}</small> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="post-award-empty">Nothing is ready to invoice yet.</div>
      )}
    </section>
  );
}

function OperationalPulse({ workspace }: { workspace: PostAwardWorkspace }) {
  const operational = workspace.operationalReadiness;
  const notices = workspace.communicationSummary;
  const meetings = workspace.meetingActionSummary;
  const securities = workspace.securityExpirySummary;
  const warranty = workspace.warrantySummary;
  const closeout = workspace.closeoutReadiness;
  return (
    <section className="post-award-operational-pulse">
      <article>
        <span>Setup</span>
        <strong>{operational.ready ? 'Ready' : `${operational.blockers.length} problems`}</strong>
        <p>{operational.activationItems.approved}/{operational.activationItems.total} items done</p>
      </article>
      <article>
        <span>Notices</span>
        <strong>{notices.openNotices}</strong>
        <p>{notices.awaitingAcknowledgement} to acknowledge / {notices.awaitingResponse} to answer</p>
      </article>
      <article>
        <span>Meeting tasks</span>
        <strong>{meetings.openActions}</strong>
        <p>{meetings.supplierActions} supplier / {meetings.buyerActions} buyer</p>
      </article>
      <article>
        <span>Guarantees</span>
        <strong>{securities.expired ? `${securities.expired} expired` : `${securities.expiringSoon} expiring`}</strong>
        <p>{securities.unresolved} guarantee or insurance items need review</p>
      </article>
      <article>
        <span>Warranty</span>
        <strong>{warranty.open}</strong>
        <p>{warranty.awaitingSupplier} supplier / {warranty.awaitingBuyer} buyer tasks</p>
      </article>
      <article>
        <span>Close-out</span>
        <strong>{closeout.ready ? 'Clear' : `${closeout.blockers.length} problems`}</strong>
        <p>{closeout.steps.filter((step) => step.status === 'DONE').length}/{closeout.steps.length} steps done</p>
      </article>
    </section>
  );
}

function RecordTable({ records }: { records: PostAwardRecord[] }) {
  if (records.length === 0) return <div className="post-award-empty">No saved items here yet.</div>;
  return (
    <div className="post-award-table-wrap">
      <table className="post-award-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <strong>{record.title}</strong>
                <span>{humanize(record.type)}</span>
              </td>
              <td><StatusPill value={record.status} /></td>
              <td>{dateLabel(record.dueDate ?? record.createdAt)}</td>
              <td>{money(record.amount, record.currency ?? 'TZS')}</td>
              <td>{record.note ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecondaryRegisters({ workspace }: { workspace: PostAwardWorkspace }) {
  return (
    <section className="post-award-secondary">
      <div className="post-award-pane-head">
        <span>More saved items</span>
        <strong>{workspace.secondary.reduce((total, item) => total + item.count, 0) + workspace.timeline.length}</strong>
      </div>
      <div className="post-award-secondary-grid">
        {workspace.secondary.map((register) => (
          <article key={register.id}>
            <span>{register.label}</span>
            <strong>{register.count}</strong>
          </article>
        ))}
        <article>
          <span>Timeline</span>
          <strong>{workspace.timeline.length}</strong>
        </article>
      </div>
    </section>
  );
}

function PostAwardActionForm({ task, workspace, onSaved }: { task: PostAwardTask; workspace: PostAwardWorkspace; onSaved: (workspace: PostAwardWorkspace) => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const contractId = workspace.contract.id;
  const blocked = task.status === 'BLOCKED';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage('');
    try {
      const payload = payloadFor(task.actionKey, form, workspace);
      const next = await saveAction(task.actionKey, contractId, payload, workspace);
      onSaved(next);
    } catch (error) {
      setMessage(apiErrorMessage(error, 'This task could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="post-award-form" onSubmit={submit}>
      <div>
        <h2>{task.title}</h2>
        <p>{task.detail}</p>
      </div>
      {blocked ? <div className="post-award-alert">Finish the earlier step before saving this task.</div> : null}
      <FieldsForAction actionKey={task.actionKey} workspace={workspace} />
      {message ? <p className="post-award-form-error">{message}</p> : null}
      <button className="btn btn-primary btn-sm" type="submit" disabled={saving || blocked}>{saving ? 'Saving...' : 'Save action'}</button>
    </form>
  );
}

function FieldsForAction({ actionKey, workspace }: { actionKey: string; workspace: PostAwardWorkspace }) {
  const delivery = workspace.workflowSections.find((stage) => stage.id === 'delivery')?.records ?? [];
  const finance = workspace.workflowSections.find((stage) => stage.id === 'finance')?.records ?? [];
  const inspections = workspace.workflowSections.find((stage) => stage.id === 'inspections')?.records ?? [];
  const risk = workspace.workflowSections.find((stage) => stage.id === 'risk')?.records ?? [];
  const changes = workspace.workflowSections.find((stage) => stage.id === 'changes')?.records ?? [];
  const claims = workspace.workflowSections.find((stage) => stage.id === 'claims')?.records ?? [];
  const documents = workspace.workflowSections.find((stage) => stage.id === 'documents')?.records ?? [];
  const closeout = workspace.workflowSections.find((stage) => stage.id === 'closeout')?.records ?? [];
  const history = workspace.workflowSections.find((stage) => stage.id === 'history')?.records ?? [];
  const secondaryTermination = workspace.secondary.find((register) => register.id === 'termination')?.records ?? [];
  const isOpenRecord = (record: { status: string }) => !['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED', 'COMPLETED', 'PAID', 'MATCHED', 'REJECTED', 'WAIVED', 'CANCELLED', 'TERMINATED', 'SETTLED'].includes(String(record.status).toUpperCase());
  const schedules = delivery.filter((record) => record.type === 'delivery_schedule');
  const dispatches = delivery.filter((record) => record.type === 'dispatch_notice');
  const goodsReceipts = delivery.filter((record) => record.type === 'goods_receipt');
  const goodsInspections = inspections.filter((record) => record.type === 'goods_inspection');
  const worksProgressReports = delivery.filter((record) => record.type === 'works_progress_report');
  const approvedWorksProgressReports = worksProgressReports.filter((record) => ['APPROVED', 'VERIFIED', 'ACCEPTED', 'CERTIFIED', 'CLOSED'].includes(String(record.status).toUpperCase()));
  const submittedWorksProgressReports = worksProgressReports.filter((record) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(record.status).toUpperCase()));
  const boqMeasurements = delivery.filter((record) => record.type === 'boq_measurement');
  const approvedBoqMeasurements = boqMeasurements.filter((record) => ['APPROVED', 'CERTIFIED', 'CLOSED'].includes(String(record.status).toUpperCase()));
  const measuredBoqMeasurements = boqMeasurements.filter((record) => ['MEASURED', 'SUBMITTED', 'REVIEW', 'DRAFT'].includes(String(record.status).toUpperCase()));
  const ipcs = finance.filter((record) => record.type === 'interim_payment_certificate');
  const draftIpcs = ipcs.filter((record) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(record.status).toUpperCase()));
  const defects = inspections.filter((record) => record.type === 'defect');
  const openDefects = defects.filter((record) => !['CLOSED', 'WAIVED', 'REJECTED'].includes(String(record.status).toUpperCase()));
  const servicePeriods = delivery.filter((record) => record.type === 'service_period');
  const serviceLevels = delivery.filter((record) => record.type === 'service_level');
  const serviceReports = delivery.filter((record) => record.type === 'service_report');
  const submittedServiceReports = serviceReports.filter((record) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(record.status).toUpperCase()));
  const approvedServiceReports = serviceReports.filter((record) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(record.status).toUpperCase()));
  const serviceCredits = delivery.concat(finance).filter((record) => record.type === 'service_credit');
  const draftServiceCredits = serviceCredits.filter((record) => ['DRAFT', 'REVIEW', 'SUBMITTED'].includes(String(record.status).toUpperCase()));
  const serviceIncidents = risk.filter((record) => record.type === 'service_incident');
  const openServiceIncidents = serviceIncidents.filter((record) => !['CLOSED', 'WAIVED', 'REJECTED'].includes(String(record.status).toUpperCase()));
  const consultancyDeliverables = delivery.filter((record) => record.type === 'consultancy_deliverable');
  const versions = delivery.filter((record) => record.type === 'deliverable_version');
  const submittedVersions = versions.filter((record) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(record.status).toUpperCase()));
  const approvedVersions = versions.filter((record) => ['APPROVED', 'ACCEPTED', 'CERTIFIED', 'VERIFIED', 'CLOSED'].includes(String(record.status).toUpperCase()));
  const reviews = inspections.concat(finance).filter((record) => record.type === 'deliverable_review');
  const payableReviews = reviews.filter((record) => record.payload?.paymentEligible === true || record.status === 'APPROVED');
  const finalReports = delivery.concat(closeout).filter((record) => record.type === 'consultancy_final_report');
  const submittedFinalReports = finalReports.filter((record) => ['SUBMITTED', 'REVIEW', 'IN_PROGRESS'].includes(String(record.status).toUpperCase()));
  const invoices = finance.filter((record) => record.type === 'invoice');
  const submittedInvoices = invoices.filter((record) => ['SUBMITTED', 'REVIEW'].includes(String(record.status).toUpperCase()));
  const matchedInvoices = invoices.filter((record) => String(record.status).toUpperCase() === 'MATCHED');
  const returnedInvoices = invoices.filter((record) => ['BLOCKED', 'REJECTED'].includes(String(record.status).toUpperCase()));
  const paymentApprovals = finance.filter((record) => record.type === 'payment_approval');
  const openPaymentApprovals = paymentApprovals.filter((record) => ['REVIEW', 'SUBMITTED'].includes(String(record.status).toUpperCase()));
  const payments = finance.filter((record) => record.type === 'payment');
  const initiatedPayments = payments.filter((record) => ['REVIEW', 'MATCHED'].includes(String(record.status).toUpperCase()));
  const paidPayments = payments.filter((record) => String(record.status).toUpperCase() === 'PAID');
  const acceptances = inspections.filter((record) => record.type === 'acceptance');
  const activationItems = workspace.workflowSections.find((stage) => stage.id === 'setup')?.records.filter((record) => record.type === 'activation_item') ?? [];
  const changeRequests = changes.filter((record) => record.type === 'change_request');
  const openChangeRequests = changeRequests.filter(isOpenRecord);
  const variations = changes.filter((record) => record.type === 'variation');
  const openVariations = variations.filter(isOpenRecord);
  const extensionRequests = changes.filter((record) => record.type === 'extension_request');
  const openExtensionRequests = extensionRequests.filter(isOpenRecord);
  const openNcrs = risk.filter((record) => record.type === 'non_conformance').filter(isOpenRecord);
  const openRisks = risk.filter((record) => record.type === 'risk').filter(isOpenRecord);
  const openIssues = risk.filter((record) => record.type === 'issue').filter(isOpenRecord);
  const openClaims = claims.filter((record) => record.type === 'claim').filter(isOpenRecord);
  const openDisputes = claims.concat(changes).filter((record) => record.type === 'dispute').filter(isOpenRecord);
  const openTerminations = secondaryTermination.filter(isOpenRecord);
  const signedAmendments = changes.filter((record) => record.type === 'amendment' && ['SIGNED', 'APPROVED'].includes(String(record.status).toUpperCase()));
  const notices = risk.filter((record) => record.type === 'notice');
  const openNotices = notices.filter((record) => !['CLOSED', 'CANCELLED', 'REJECTED'].includes(String(record.status).toUpperCase()));
  const meetingActions = history.filter((record) => record.type === 'meeting_action');
  const openMeetingActions = meetingActions.filter(isOpenRecord);
  const securities = documents.concat(workspace.secondary.find((register) => register.id === 'securities')?.records ?? []).filter((record) => record.type === 'security');
  const warranties = documents.filter((record) => record.type === 'warranty');
  const openWarranties = warranties.filter(isOpenRecord);

  if (actionKey === 'management-plan') {
    return (
      <>
        <TextArea name="objectives" label="Objectives" required />
        <TextArea name="monitoringPlan" label="Monitoring plan" />
        <TextArea name="reportingPlan" label="Reporting plan" />
        <TextArea name="communicationPlan" label="Communication plan" />
      </>
    );
  }
  if (actionKey === 'management-plan-draft') return <><label className="post-award-check"><input name="overwrite" type="checkbox" /> Replace existing CMP draft</label><TextArea name="note" label="Draft note" /></>;
  if (actionKey === 'activation-submit' || actionKey === 'activation-review') {
    return (
      <>
        <SelectInput name="itemId" label="Activation item" records={activationItems} required />
        {actionKey === 'activation-review' ? <SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'WAIVED']} /> : null}
        <TextArea name="note" label="Note" />
      </>
    );
  }
  if (actionKey === 'goods-delivery-schedule') {
    return (
      <>
        <TextInput name="description" label="Goods or line description" required />
        <NumberInput name="plannedQuantity" label="Planned quantity" />
        <TextInput name="unit" label="Unit" />
        <TextInput name="deliveryLocation" label="Delivery location" />
        <TextInput name="plannedDeliveryDate" label="Planned delivery date" type="date" defaultValue={today()} />
      </>
    );
  }
  if (actionKey === 'dispatch-notice') {
    return (
      <>
        <SelectInput name="scheduleId" label="Delivery schedule" records={schedules} empty="No linked schedule" required />
        <TextInput name="dispatchReference" label="Dispatch reference" />
        <TextInput name="carrier" label="Carrier" />
        <TextInput name="trackingReference" label="Tracking reference" />
        <NumberInput name="dispatchedQuantity" label="Dispatched quantity" />
        <TextInput name="expectedArrivalDate" label="Expected arrival date" type="date" defaultValue={today()} />
      </>
    );
  }
  if (actionKey === 'goods-receipt') {
    return (
      <>
        <SelectInput name="dispatchNoticeId" label="Dispatch notice" records={dispatches} empty="No linked dispatch" required />
        <SelectInput name="scheduleId" label="Delivery schedule" records={schedules} empty="No linked schedule" />
        <TextInput name="receiptReference" label="Receipt reference" />
        <TextInput name="lineDescription" label="Received goods" required />
        <NumberInput name="receivedQuantity" label="Received quantity" />
        <NumberInput name="acceptedQuantity" label="Accepted quantity" />
        <NumberInput name="rejectedQuantity" label="Rejected quantity" />
        <TextArea name="note" label="Receipt note" />
      </>
    );
  }
  if (actionKey === 'goods-inspection') {
    return (
      <>
        <SelectInput name="goodsReceiptId" label="Goods receipt" records={goodsReceipts} empty="No receipt ready" required />
        <TextInput name="goodsDescription" label="Goods inspected" required />
        <NumberInput name="quantityOrdered" label="Quantity ordered" />
        <NumberInput name="quantityReceived" label="Quantity received" />
        <NumberInput name="quantityAccepted" label="Quantity accepted" />
        <NumberInput name="quantityRejected" label="Quantity rejected" />
        <SelectStatic name="result" label="Result" values={['APPROVED', 'REJECTED', 'OPEN']} />
        <TextArea name="note" label="Inspection note" />
      </>
    );
  }
  if (actionKey === 'acceptance') return <><SelectInput name="goodsReceiptId" label="Goods receipt" records={goodsReceipts} empty="No linked receipt" /><SelectInput name="goodsInspectionId" label="Goods inspection" records={goodsInspections} empty="No linked inspection" /><TextInput name="certificateNo" label="Acceptance certificate" /><SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'CLOSED']} /><NumberInput name="acceptedValue" label="Accepted value" /><TextArea name="note" label="Acceptance note" /></>;
  if (actionKey === 'site-handover') return <><TextInput name="location" label="Site location" required /><TextInput name="handoverDate" label="Handover date" type="date" defaultValue={today()} /><TextInput name="handoverReference" label="Handover reference" /><TextInput name="handedOverBy" label="Handed over by" /><TextInput name="receivedBy" label="Received by" /><TextArea name="constraints" label="Constraints and access issues" /></>;
  if (actionKey === 'works-progress') return <><TextInput name="reportReference" label="Report reference" /><TextInput name="programmeReference" label="Programme reference" /><TextInput name="periodStart" label="Period start" type="date" /><TextInput name="periodEnd" label="Period end" type="date" /><NumberInput name="progressPercent" label="Progress percent" /><TextArea name="narrative" label="Progress narrative" required /><TextArea name="resources" label="Labour, plant, and materials" /><TextArea name="delays" label="Delays, safety, weather, and constraints" /></>;
  if (actionKey === 'works-progress-review') return <><SelectInput name="reportId" label="Progress report" records={submittedWorksProgressReports.length ? submittedWorksProgressReports : worksProgressReports} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'REVISION_REQUIRED']} /><NumberInput name="progressPercent" label="Accepted progress percent" /><TextArea name="note" label="Review note" /></>;
  if (actionKey === 'boq-measurement') return <><SelectInput name="reportId" label="Approved progress report" records={approvedWorksProgressReports.length ? approvedWorksProgressReports : worksProgressReports} empty="No approved progress report" required /><TextInput name="measurementReference" label="Measurement reference" /><TextInput name="boqItemReference" label="BOQ item reference" required /><TextArea name="description" label="Measurement description" /><NumberInput name="previousQuantity" label="Previous quantity" /><NumberInput name="currentQuantity" label="Current quantity" /><NumberInput name="cumulativeQuantity" label="Cumulative quantity" /><NumberInput name="unitRate" label="Unit rate" /><NumberInput name="amount" label="Measured amount" /><NumberInput name="certifiedQuantity" label="Certified quantity" /><NumberInput name="certifiedAmount" label="Certified amount" /><SelectStatic name="status" label="Status" values={['MEASURED', 'APPROVED', 'CERTIFIED']} /></>;
  if (actionKey === 'boq-measurement-review') return <><SelectInput name="measurementId" label="BOQ measurement" records={measuredBoqMeasurements.length ? measuredBoqMeasurements : boqMeasurements} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'CERTIFIED', 'REJECTED']} /><NumberInput name="certifiedQuantity" label="Certified quantity" /><NumberInput name="certifiedAmount" label="Certified amount" /><TextArea name="note" label="Review note" /></>;
  if (actionKey === 'interim-payment-certificate') return <><SelectInput name="measurementId" label="Approved BOQ measurement" records={approvedBoqMeasurements.length ? approvedBoqMeasurements : boqMeasurements} empty="No approved measurement" required /><TextInput name="certificateNumber" label="Certificate number" /><SelectStatic name="certificateType" label="Certificate type" values={['INTERIM', 'PENULTIMATE']} /><TextInput name="periodStart" label="Period start" type="date" /><TextInput name="periodEnd" label="Period end" type="date" /><NumberInput name="grossAmount" label="Gross amount" /><NumberInput name="retentionAmount" label="Retention" /><NumberInput name="advanceRecoveryAmount" label="Advance recovery" /><NumberInput name="liquidatedDamagesAmount" label="Liquidated damages" /><NumberInput name="taxWithholdingAmount" label="Tax withholding" /><NumberInput name="otherDeductionsAmount" label="Other deductions" /><NumberInput name="netAmount" label="Net payable" /><SelectStatic name="status" label="Status" values={['DRAFT', 'CERTIFIED', 'APPROVED']} /></>;
  if (actionKey === 'ipc-certify') return <><SelectInput name="certificateId" label="Interim payment certificate" records={draftIpcs.length ? draftIpcs : ipcs} required /><SelectStatic name="status" label="Decision" values={['CERTIFIED', 'APPROVED', 'REJECTED']} /><NumberInput name="grossAmount" label="Gross amount" /><NumberInput name="retentionAmount" label="Retention" /><NumberInput name="advanceRecoveryAmount" label="Advance recovery" /><NumberInput name="liquidatedDamagesAmount" label="Liquidated damages" /><NumberInput name="taxWithholdingAmount" label="Tax withholding" /><NumberInput name="otherDeductionsAmount" label="Other deductions" /><NumberInput name="netAmount" label="Net payable" /><TextArea name="note" label="Certification note" /></>;
  if (actionKey === 'contract-defect') return <><TextInput name="title" label="Defect title" required /><TextInput name="defectReference" label="Defect reference" /><SelectStatic name="severity" label="Severity" values={['MINOR', 'MAJOR', 'CRITICAL']} /><TextArea name="description" label="Defect description" /><TextInput name="dueDate" label="Correction due date" type="date" /><TextInput name="responseDueDate" label="Response due date" type="date" /><TextInput name="sourceRecordType" label="Source record type" /><TextInput name="sourceRecordId" label="Source record id" /></>;
  if (actionKey === 'defect-response') return <><SelectInput name="defectId" label="Open defect" records={openDefects} empty="No open defect" required /><TextArea name="response" label="Corrective response" required /><TextArea name="evidenceNote" label="Evidence note" /></>;
  if (actionKey === 'defect-verify') return <><SelectInput name="defectId" label="Defect response" records={openDefects.length ? openDefects : defects} required /><SelectStatic name="status" label="Decision" values={['CLOSED', 'APPROVED', 'REJECTED', 'IN_PROGRESS']} /><TextArea name="verifiedNote" label="Verification note" /></>;
  if (actionKey === 'works-completion-certificate') return <><SelectStatic name="certificateType" label="Certificate type" values={['PRACTICAL_COMPLETION', 'FINAL_ACCOUNT', 'FINAL_COMPLETION']} /><TextInput name="certificateNumber" label="Certificate number" /><SelectInput name="progressReportId" label="Progress report" records={approvedWorksProgressReports.length ? approvedWorksProgressReports : worksProgressReports} empty="No linked progress report" /><SelectInput name="ipcId" label="IPC or final account basis" records={ipcs} empty="No linked IPC" /><TextInput name="completionDate" label="Completion date" type="date" defaultValue={today()} /><NumberInput name="finalAccountAmount" label="Final account amount" /><NumberInput name="retentionReleaseAmount" label="Retention release" /><TextArea name="defectsSummary" label="Defects summary" /><TextArea name="outstandingWorks" label="Outstanding works" /><TextArea name="note" label="Certificate note" /><SelectStatic name="status" label="Status" values={['ISSUED', 'APPROVED', 'CERTIFIED', 'CLOSED']} /></>;
  if (actionKey === 'service-level') return <><TextInput name="metricKey" label="Metric key" required /><TextInput name="title" label="Service level title" required /><TextInput name="targetValue" label="Target value" /><TextInput name="measurementUnit" label="Measurement unit" /><TextArea name="creditRule" label="Credit or penalty rule" /></>;
  if (actionKey === 'service-period') return <><TextInput name="periodKey" label="Period key" required /><TextInput name="startDate" label="Start date" type="date" defaultValue={today()} required /><TextInput name="endDate" label="End date" type="date" defaultValue={today()} required /></>;
  if (actionKey === 'service-report') return <><SelectInput name="periodId" label="Service period" records={servicePeriods} empty="No linked period" required /><TextInput name="reportReference" label="Report reference" /><TextArea name="summary" label="Service delivery summary" required /><TextArea name="slaEvidence" label="SLA evidence" /><TextArea name="breachExplanation" label="Breach explanation" /><TextArea name="correctiveAction" label="Corrective action" /></>;
  if (actionKey === 'service-report-review') return <><SelectInput name="reportId" label="Service report" records={submittedServiceReports.length ? submittedServiceReports : serviceReports} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'REVISION_REQUIRED']} /><SelectStatic name="verifiedSlaResult" label="SLA result" values={['MET', 'PARTIAL', 'BREACHED', 'NOT_APPLICABLE']} /><NumberInput name="acceptedAmount" label="Accepted service amount" /><TextInput name="correctionDueDate" label="Correction due date" type="date" /><TextArea name="note" label="Review note" /></>;
  if (actionKey === 'service-incident') return <><TextInput name="title" label="Incident or complaint title" required /><TextInput name="incidentReference" label="Incident reference" /><SelectStatic name="incidentType" label="Type" values={['INCIDENT', 'COMPLAINT', 'SLA_BREACH']} /><SelectStatic name="severity" label="Severity" values={['MINOR', 'MAJOR', 'CRITICAL']} /><SelectInput name="serviceLevelId" label="Service level" records={serviceLevels} empty="No linked SLA" /><SelectInput name="periodId" label="Service period" records={servicePeriods} empty="No linked period" /><SelectInput name="serviceReportId" label="Service report" records={serviceReports} empty="No linked report" /><TextArea name="description" label="Description" /><TextInput name="dueDate" label="Correction due date" type="date" /><TextInput name="responseDueDate" label="Response due date" type="date" /></>;
  if (actionKey === 'service-incident-response') return <><SelectInput name="incidentId" label="Open incident" records={openServiceIncidents} empty="No open incident" required /><TextArea name="response" label="Breach explanation and corrective action" required /><TextArea name="evidenceNote" label="Evidence note" /></>;
  if (actionKey === 'service-incident-verify') return <><SelectInput name="incidentId" label="Incident response" records={openServiceIncidents.length ? openServiceIncidents : serviceIncidents} required /><SelectStatic name="status" label="Decision" values={['CLOSED', 'APPROVED', 'REJECTED', 'IN_PROGRESS']} /><TextArea name="verifiedNote" label="Verification note" /></>;
  if (actionKey === 'service-credit') return <><SelectInput name="serviceLevelId" label="Service level" records={serviceLevels} empty="No linked SLA" /><SelectInput name="periodId" label="Service period" records={servicePeriods} empty="No linked period" /><SelectInput name="serviceReportId" label="Approved service report" records={approvedServiceReports.length ? approvedServiceReports : serviceReports} empty="No linked report" /><SelectStatic name="creditType" label="Credit or penalty type" values={['SERVICE_CREDIT', 'PENALTY', 'PAYABLE_ADJUSTMENT']} /><NumberInput name="amount" label="Credit or penalty amount" /><NumberInput name="invoiceImpactAmount" label="Invoice impact amount" /><TextArea name="reason" label="Reason" /></>;
  if (actionKey === 'service-credit-review') return <><SelectInput name="creditId" label="Service credit or penalty" records={draftServiceCredits.length ? draftServiceCredits : serviceCredits} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'APPLIED', 'REJECTED']} /><NumberInput name="amount" label="Approved amount" /><NumberInput name="invoiceImpactAmount" label="Invoice impact amount" /><TextArea name="reason" label="Decision reason" /></>;
  if (actionKey === 'consultancy-deliverable') return <><TextInput name="deliverableCode" label="Deliverable code" required /><TextInput name="title" label="Deliverable title" required /><TextInput name="dueDate" label="Due date" type="date" /><TextArea name="description" label="Acceptance criteria" /><NumberInput name="acceptedAmount" label="Planned accepted amount" /><label className="post-award-check"><input name="paymentEligible" type="checkbox" /> Payment eligible when approved</label><label className="post-award-check"><input name="isFinalReport" type="checkbox" /> This is the final report deliverable</label></>;
  if (actionKey === 'consultancy-deliverable-review') return <><SelectInput name="deliverableId" label="Deliverable" records={consultancyDeliverables} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'IN_PROGRESS']} /><NumberInput name="acceptedAmount" label="Accepted amount" /><label className="post-award-check"><input name="paymentEligible" type="checkbox" defaultChecked /> Payment eligible</label><TextArea name="note" label="Review note" /></>;
  if (actionKey === 'deliverable-version') return <><SelectInput name="deliverableId" label="Deliverable" records={consultancyDeliverables} empty="No linked deliverable" required /><SelectInput name="previousVersionId" label="Previous version" records={versions} empty="First version" /><NumberInput name="versionNo" label="Version number" /><TextArea name="revisionReason" label="Revision or correction reason" /><TextArea name="note" label="Submission note" /></>;
  if (actionKey === 'deliverable-review') return <><SelectInput name="versionId" label="Submitted version" records={submittedVersions.length ? submittedVersions : versions} empty="No linked version" required /><SelectStatic name="decision" label="Decision" values={['APPROVED', 'REVISION_REQUESTED', 'REJECTED']} /><NumberInput name="acceptedAmount" label="Accepted amount" /><TextInput name="revisionDueDate" label="Revision due date" type="date" /><label className="post-award-check"><input name="paymentEligible" type="checkbox" /> Payment eligible</label><TextArea name="comments" label="Supplier-visible comments" /><TextArea name="buyerPrivateNotes" label="Buyer private notes" /></>;
  if (actionKey === 'deliverable-payment-eligibility') return <><SelectInput name="reviewId" label="Approved review" records={payableReviews.length ? payableReviews : reviews} required /><SelectStatic name="decision" label="Decision" values={['APPROVED', 'CERTIFIED']} /><NumberInput name="acceptedAmount" label="Accepted invoiceable amount" /><label className="post-award-check"><input name="paymentEligible" type="checkbox" defaultChecked /> Payment eligible</label><TextArea name="note" label="Payment eligibility note" /></>;
  if (actionKey === 'consultancy-final-report') return <><TextInput name="reportReference" label="Final report reference" /><SelectInput name="deliverableId" label="Final report deliverable" records={consultancyDeliverables} empty="No linked deliverable" /><SelectInput name="versionId" label="Approved version" records={approvedVersions.length ? approvedVersions : versions} empty="No linked version" /><TextArea name="summary" label="Final report summary" required /></>;
  if (actionKey === 'consultancy-final-report-review') return <><SelectInput name="reportId" label="Final report" records={submittedFinalReports.length ? submittedFinalReports : finalReports} required /><SelectStatic name="status" label="Decision" values={['APPROVED', 'REJECTED', 'CLOSED']} /><NumberInput name="acceptedAmount" label="Accepted amount" /><label className="post-award-check"><input name="paymentEligible" type="checkbox" defaultChecked /> Payment eligible</label><TextArea name="note" label="Review note" /></>;
  if (actionKey === 'invoice') {
    return (
      <>
        <TextInput name="reference" label="Invoice reference" required />
        <SelectInvoiceable workspace={workspace} />
        <NumberInput name="amount" label="Invoice amount" required />
        <TextInput name="currency" label="Currency" defaultValue={workspace.contract.currency} required />
      </>
    );
  }
  if (actionKey === 'three-way-match') return <><SelectInput name="invoiceId" label="Invoice" records={submittedInvoices.length ? submittedInvoices : invoices} required /><SelectInput name="acceptanceId" label="Acceptance certificate" records={acceptances} empty="No linked acceptance" /><SelectInput name="goodsReceiptId" label="Goods receipt" records={goodsReceipts} empty="No linked receipt" /><SelectInput name="goodsInspectionId" label="Goods inspection" records={goodsInspections} empty="No linked inspection" /><SelectInput name="scheduleId" label="Delivery schedule" records={schedules} empty="No linked schedule" /><label className="post-award-check"><input name="poMatched" type="checkbox" defaultChecked /> Contract/order matches</label><label className="post-award-check"><input name="receiptMatched" type="checkbox" defaultChecked /> Receipt or acceptance matches</label><label className="post-award-check"><input name="invoiceMatched" type="checkbox" defaultChecked /> Invoice amount matches</label><NumberInput name="varianceAmount" label="Variance amount" /><TextInput name="mismatchType" label="Mismatch type" /><TextArea name="note" label="Match note" /></>;
  if (actionKey === 'invoice-correction') return <><SelectInput name="invoiceId" label="Returned invoice" records={returnedInvoices.length ? returnedInvoices : invoices} required /><TextArea name="note" label="Correction note" required /></>;
  if (actionKey === 'invoice-verify') return <><SelectInput name="invoiceId" label="Submitted invoice" records={submittedInvoices.length ? submittedInvoices : invoices} required /><SelectStatic name="financeAction" label="Invoice decision" values={['verify', 'return', 'reject']} /><TextArea name="note" label="Supplier-visible note" /><TextArea name="privateNote" label="Buyer private verification note" /></>;
  if (actionKey === 'payment-recommendation') return <><SelectInput name="invoiceId" label="Matched invoice" records={matchedInvoices.length ? matchedInvoices : invoices} required /><NumberInput name="amountApproved" label="Recommended amount" /><NumberInput name="retentionAmount" label="Retention" /><NumberInput name="advanceRecovery" label="Advance recovery" /><NumberInput name="liquidatedDamages" label="Liquidated damages" /><NumberInput name="taxWithholding" label="Tax withholding" /><NumberInput name="netAmount" label="Net payable" /><TextArea name="note" label="Recommendation note" /><TextArea name="privateNote" label="Internal finance note" /></>;
  if (actionKey === 'payment-approval-review') return <><SelectInput name="approvalId" label="Payment recommendation" records={openPaymentApprovals.length ? openPaymentApprovals : paymentApprovals} required /><SelectStatic name="approvalAction" label="Decision" values={['approve', 'review', 'reject']} /><NumberInput name="amountApproved" label="Approved amount" /><TextInput name="signatureKeyphrase" label="Digital signature keyphrase" type="password" /><TextArea name="note" label="Decision note" /><TextArea name="privateNote" label="Internal approval note" /></>;
  if (actionKey === 'payment-initiate') return <><SelectInput name="invoiceId" label="Approved invoice" records={matchedInvoices.length ? matchedInvoices : invoices} required /><NumberInput name="grossAmount" label="Gross amount" /><NumberInput name="retentionAmount" label="Retention" /><NumberInput name="advanceRecovery" label="Advance recovery" /><NumberInput name="liquidatedDamages" label="Liquidated damages" /><NumberInput name="taxWithholding" label="Tax withholding" /><NumberInput name="netAmount" label="Net payable" /><TextInput name="reference" label="Payment initiation reference" /><TextArea name="note" label="Payment note" /></>;
  if (actionKey === 'payment-complete') return <><SelectInput name="paymentId" label="Initiated payment" records={initiatedPayments.length ? initiatedPayments : payments} required /><TextInput name="paidAt" label="Paid at" type="datetime-local" /><TextInput name="reference" label="Payment reference" /><NumberInput name="grossAmount" label="Gross amount" /><NumberInput name="retentionAmount" label="Retention" /><NumberInput name="advanceRecovery" label="Advance recovery" /><NumberInput name="liquidatedDamages" label="Liquidated damages" /><NumberInput name="taxWithholding" label="Tax withholding" /><NumberInput name="netAmount" label="Net paid" /><TextArea name="note" label="Completion note" /></>;
  if (actionKey === 'payment-confirmation') return <><SelectInput name="paymentId" label="Completed payment" records={paidPayments.length ? paidPayments : payments} required /><NumberInput name="paidAmount" label="Amount received" required /><TextInput name="confirmationReference" label="Receipt reference" /><TextInput name="paidAt" label="Receipt date" type="datetime-local" /><TextArea name="note" label="Supplier receipt note" /></>;
  if (actionKey === 'finance-deduction-review') return <><SelectInput name="invoiceId" label="Linked invoice" records={invoices} empty="No linked invoice" /><SelectStatic name="deductionType" label="Deduction type" values={['FINANCE_DEDUCTION', 'SERVICE_CREDIT', 'PENALTY', 'LIQUIDATED_DAMAGES']} /><NumberInput name="amount" label="Amount" /><SelectStatic name="status" label="Decision status" values={['DRAFT', 'APPROVED', 'REJECTED', 'APPLIED']} /><TextArea name="note" label="Deduction basis" /><TextArea name="privateNote" label="Internal finance note" /></>;
  if (actionKey === 'finance-retention') return <><NumberInput name="amount" label="Retention amount resolved" /><SelectStatic name="status" label="Decision status" values={['DRAFT', 'APPROVED', 'APPLIED']} /><TextArea name="note" label="Retention decision" /><TextArea name="privateNote" label="Internal retention note" /></>;
  if (actionKey === 'finance-advance-recovery') return <><NumberInput name="amount" label="Advance recovery amount" /><SelectStatic name="status" label="Decision status" values={['DRAFT', 'APPROVED', 'APPLIED']} /><TextArea name="note" label="Advance recovery decision" /><TextArea name="privateNote" label="Internal recovery note" /></>;
  if (actionKey === 'finance-liquidated-damages') return <><SelectInput name="invoiceId" label="Linked invoice" records={invoices} empty="No linked invoice" /><NumberInput name="amount" label="Liquidated damages amount" /><SelectStatic name="status" label="Decision status" values={['DRAFT', 'APPROVED', 'REJECTED', 'APPLIED']} /><TextArea name="note" label="LD calculation basis" /><TextArea name="privateNote" label="Internal LD note" /></>;
  if (actionKey === 'payment-approval') return <><SelectInput name="invoiceId" label="Matched invoice" records={matchedInvoices.length ? matchedInvoices : invoices} required /><NumberInput name="amountApproved" label="Amount approved" /><TextInput name="signatureKeyphrase" label="Digital signature keyphrase" type="password" required /><TextArea name="note" label="Approval note" /></>;
  if (actionKey === 'issue') return <><TextInput name="title" label="Issue title" required /><TextInput name="category" label="Category" defaultValue="execution" required /><TextArea name="description" label="Description" /><TextArea name="note" label="Resolution note" /></>;
  if (actionKey === 'non-conformance') return <><TextInput name="category" label="Category" defaultValue="QUALITY" required /><TextInput name="title" label="NCR title" required /><SelectStatic name="severity" label="Severity" values={['MINOR', 'MAJOR', 'CRITICAL']} /><TextArea name="correctiveAction" label="Corrective action" /><TextInput name="correctiveActionDeadline" label="Corrective deadline" type="date" /></>;
  if (actionKey === 'change-request') return <><TextInput name="changeType" label="Change type" defaultValue="SCOPE" required /><TextInput name="title" label="Change title" required /><TextArea name="reason" label="Reason" /><TextArea name="technicalReview" label="Technical review" /><TextArea name="financialReview" label="Financial review" /></>;
  if (actionKey === 'claim') return <><TextInput name="title" label="Claim title" required /><TextInput name="claimType" label="Claim type" defaultValue="GENERAL" /><TextArea name="description" label="Claim description" /><NumberInput name="amount" label="Amount claimed" /></>;
  if (actionKey === 'change-request-respond') return <><SelectInput name="recordId" label="Change request" records={openChangeRequests} empty="No open change request" required /><TextArea name="response" label="Supplier impact response" required /><TextArea name="note" label="Evidence or assumptions" /></>;
  if (actionKey === 'change-request-review') return <><SelectInput name="recordId" label="Change request" records={openChangeRequests} empty="No open change request" required /><SelectStatic name="controlAction" label="Decision step" values={['review', 'approve', 'reject']} /><SelectInput name="amendmentId" label="Signed amendment" records={signedAmendments} empty="No signed amendment" /><TextArea name="note" label="Review or decision note" /><TextArea name="privateNote" label="Internal legal/budget note" /></>;
  if (actionKey === 'variation-review') return <><SelectInput name="recordId" label="Variation" records={openVariations} empty="No open variation" required /><SelectStatic name="controlAction" label="Decision" values={['review', 'approve', 'reject']} /><SelectInput name="amendmentId" label="Signed amendment" records={signedAmendments} empty="No signed amendment" /><TextArea name="note" label="Decision reasons" /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'extension-review') return <><SelectInput name="recordId" label="Extension request" records={openExtensionRequests} empty="No open extension request" required /><SelectStatic name="controlAction" label="Decision" values={['review', 'approve', 'reject']} /><TextArea name="note" label="Decision reasons" /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'claim-response') return <><SelectInput name="recordId" label="Claim" records={openClaims} empty="No open claim" required /><SelectStatic name="controlAction" label="Action" values={['respond', 'settle', 'reject', 'escalate']} /><NumberInput name="amountApproved" label="Approved or settlement amount" /><TextArea name="response" label="Response or decision" required /><TextArea name="privateNote" label="Internal assessment note" /></>;
  if (actionKey === 'ncr-response') return <><SelectInput name="recordId" label="Open NCR" records={openNcrs} empty="No open NCR" required /><TextArea name="response" label="Corrective action and evidence" required /><TextArea name="note" label="Supplier note" /></>;
  if (actionKey === 'ncr-verify') return <><SelectInput name="recordId" label="Submitted NCR" records={openNcrs} empty="No NCR waiting verification" required /><SelectStatic name="status" label="Verification result" values={['APPROVED', 'REJECTED']} /><TextArea name="note" label="Verification note" required /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'risk-mitigate') return <><SelectInput name="recordId" label="Open risk" records={openRisks} empty="No open risk" required /><SelectStatic name="controlAction" label="Action" values={['mitigate', 'close']} /><TextInput name="dueDate" label="Next review date" type="date" /><TextArea name="note" label="Mitigation update" required /></>;
  if (actionKey === 'issue-resolve') return <><SelectInput name="recordId" label="Open issue" records={openIssues} empty="No open issue" required /><TextArea name="response" label="Resolution note or evidence" required /></>;
  if (actionKey === 'issue-close') return <><SelectInput name="recordId" label="Resolved issue" records={openIssues} empty="No issue waiting closure" required /><TextArea name="note" label="Buyer closure note" required /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'dispute') return <><TextInput name="title" label="Dispute title" required /><TextInput name="category" label="Route" defaultValue="DISPUTE_BOARD" /><TextArea name="description" label="Dispute description" /><TextArea name="note" label="Proposed resolution" /></>;
  if (actionKey === 'dispute-response') return <><SelectInput name="recordId" label="Open dispute" records={openDisputes} empty="No open dispute" required /><TextArea name="response" label="Supplier dispute response" required /></>;
  if (actionKey === 'dispute-resolve') return <><SelectInput name="recordId" label="Open dispute" records={openDisputes} empty="No open dispute" required /><SelectStatic name="controlAction" label="Decision" values={['resolve', 'close']} /><TextArea name="decision" label="Resolution decision" required /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'termination') return <><SelectStatic name="terminationType" label="Termination type" values={['SUPPLIER_DEFAULT', 'BUYER_DEFAULT', 'CONVENIENCE', 'MUTUAL', 'FORCE_MAJEURE', 'INSOLVENCY', 'FRAUD_CORRUPTION']} /><TextArea name="reason" label="Termination reason" required /><TextInput name="contractClause" label="Contract clause" /><TextInput name="faultParty" label="Fault party" /><TextInput name="cureDeadline" label="Cure deadline" type="date" /></>;
  if (actionKey === 'termination-response') return <><SelectInput name="recordId" label="Termination notice" records={openTerminations} empty="No termination notice" required /><TextArea name="response" label="Supplier response or cure evidence" required /></>;
  if (actionKey === 'termination-decision') return <><SelectInput name="recordId" label="Termination record" records={openTerminations} empty="No open termination" required /><SelectStatic name="controlAction" label="Decision" values={['decide', 'settle', 'terminate', 'close', 'reject']} /><NumberInput name="settlementAmount" label="Settlement amount" /><TextArea name="decision" label="Decision or settlement note" required /><TextInput name="signatureKeyphrase" label="Signature keyphrase" type="password" /><TextArea name="privateNote" label="Internal note" /></>;
  if (actionKey === 'notice') return <><SelectStatic name="noticeType" label="Notice type" values={['ORDINARY_MESSAGE', 'FORMAL_NOTICE', 'NOTICE_TO_CORRECT', 'NOTICE_OF_DELAY', 'NOTICE_OF_DEFAULT', 'VARIATION_NOTICE', 'TERMINATION_NOTICE']} /><TextInput name="title" label="Notice title" required /><TextArea name="body" label="Notice body" /><SelectStatic name="recipientRole" label="Recipient" values={['SUPPLIER', 'BUYER']} /><TextInput name="dueDate" label="Response due date" type="date" /><TextArea name="note" label="Note" /></>;
  if (actionKey === 'notice-acknowledge') return <><SelectInput name="recordId" label="Notice" records={openNotices} empty="No open notice" required /><TextArea name="note" label="Acknowledgement note" /></>;
  if (actionKey === 'notice-respond') return <><SelectInput name="recordId" label="Notice" records={openNotices} empty="No open notice" required /><TextArea name="response" label="Response or corrective position" required /><TextArea name="note" label="Response note" /></>;
  if (actionKey === 'notice-close') return <><SelectInput name="recordId" label="Notice" records={openNotices.length ? openNotices : notices} empty="No notice" required /><TextArea name="note" label="Closeout note" /><TextArea name="privateNote" label="Buyer private closeout note" /></>;
  if (actionKey === 'meeting') return <><SelectStatic name="meetingType" label="Meeting type" values={['KICK_OFF_MEETING', 'PROGRESS_MEETING', 'TECHNICAL_MEETING', 'SITE_MEETING', 'PERFORMANCE_REVIEW', 'DISPUTE_MEETING', 'CLOSEOUT_MEETING']} /><TextInput name="title" label="Meeting title" required /><TextInput name="meetingDate" label="Meeting date" type="datetime-local" /><TextArea name="agenda" label="Agenda" /><TextArea name="minutes" label="Minutes" /><TextArea name="decisions" label="Decisions" /><TextInput name="actionTitle" label="First action item" /><SelectStatic name="actionOwnerRole" label="Action owner" values={['SUPPLIER', 'BUYER', 'SHARED']} /><TextInput name="actionDueDate" label="Action due date" type="date" /></>;
  if (actionKey === 'meeting-action-complete') return <><SelectInput name="recordId" label="Meeting action" records={openMeetingActions} empty="No open meeting action" required /><TextArea name="response" label="Completion response" required /><TextArea name="note" label="Evidence note" /></>;
  if (actionKey === 'meeting-action-verify') return <><SelectInput name="recordId" label="Meeting action" records={openMeetingActions.length ? openMeetingActions : meetingActions} empty="No meeting action" required /><SelectStatic name="meetingActionDecision" label="Decision" values={['verify', 'close']} /><TextArea name="verificationNote" label="Verification note" /></>;
  if (actionKey === 'security') return <><TextInput name="securityType" label="Security type" defaultValue="PERFORMANCE_SECURITY" required /><TextInput name="issuingInstitution" label="Issuing institution" /><TextInput name="referenceNumber" label="Reference number" /><NumberInput name="amount" label="Amount" /><SelectStatic name="verificationStatus" label="Verification status" values={['APPROVED', 'PENDING', 'REJECTED', 'WAIVED']} /></>;
  if (actionKey === 'security-review') return <><SelectInput name="recordId" label="Security or guarantee" records={securities} empty="No security record" required /><SelectStatic name="securityAction" label="Decision" values={['review', 'extend', 'release', 'claim', 'waive']} /><SelectStatic name="verificationStatus" label="Verification status" values={['VERIFIED', 'APPROVED', 'PENDING', 'REJECTED', 'RELEASED', 'WAIVED']} /><SelectStatic name="claimStatus" label="Claim status" values={['NONE', 'CLAIMED', 'CLOSED']} /><TextInput name="expiryDate" label="New expiry date" type="date" /><TextArea name="note" label="Decision note" /><TextArea name="privateNote" label="Buyer private note" /></>;
  if (actionKey === 'required-document') return <><TextInput name="documentType" label="Document type" required /><TextInput name="title" label="Document title" required /><SelectStatic name="ownerRole" label="Owner role" values={['SUPPLIER', 'BUYER']} /><SelectStatic name="status" label="Status" values={['OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED']} /><TextInput name="dueDate" label="Due date" type="date" /></>;
  if (actionKey === 'warranty') return <><TextInput name="title" label="Warranty item" required /><TextInput name="defectReference" label="Defect reference" /><TextInput name="startDate" label="Start date" type="date" /><TextInput name="endDate" label="End date" type="date" /><TextArea name="note" label="Resolution note" /></>;
  if (actionKey === 'warranty-response') return <><SelectInput name="recordId" label="Warranty item" records={openWarranties} empty="No open warranty" required /><TextArea name="response" label="Repair, replacement, or correction evidence" required /><TextArea name="note" label="Supplier note" /></>;
  if (actionKey === 'warranty-verify') return <><SelectInput name="recordId" label="Warranty item" records={openWarranties.length ? openWarranties : warranties} empty="No warranty item" required /><SelectStatic name="warrantyAction" label="Decision" values={['verify', 'close']} /><SelectStatic name="status" label="Status" values={['APPROVED', 'CLOSED', 'REJECTED', 'IN_PROGRESS']} /><TextArea name="note" label="Verification note" /><TextArea name="privateNote" label="Buyer private note" /></>;
  if (actionKey === 'urgent-actions-recalculate') return <><TextArea name="note" label="Refresh note" /></>;
  if (actionKey === 'closeout-step') return <><SelectStatic name="stepId" label="Closeout step" values={workspace.closeoutReadiness.steps.map((step) => step.id)} /><SelectStatic name="status" label="Step status" values={['APPROVED', 'CLOSED']} /><TextArea name="note" label="Step evidence note" /><TextArea name="privateNote" label="Buyer private note" /></>;
  if (actionKey === 'performance') return <><NumberInput name="overallScore" label="Overall score" /><NumberInput name="timeScore" label="Time score" /><NumberInput name="qualityScore" label="Quality score" /><NumberInput name="costScore" label="Cost score" /><NumberInput name="complianceScore" label="Compliance score" /><TextArea name="note" label="Performance note" /></>;
  return (
    <>
      <label className="post-award-check"><input name="completionCertificate" type="checkbox" /> Completion certificate issued</label>
      <label className="post-award-check"><input name="finalAccountApproved" type="checkbox" /> Final account approved</label>
      <TextArea name="lessonsLearned" label="Lessons learned" />
      <TextInput name="signatureKeyphrase" label="Digital signature keyphrase" type="password" required />
    </>
  );
}

function TextInput({ name, label, required, defaultValue = '', type = 'text' }: { name: string; label: string; required?: boolean; defaultValue?: string; type?: string }) {
  return <label><span>{label}</span><input className="form-input" name={name} type={type} required={required} defaultValue={defaultValue} /></label>;
}

function NumberInput({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return <label><span>{label}</span><input className="form-input" name={name} type="number" min="0" step="0.01" required={required} /></label>;
}

function TextArea({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return <label><span>{label}</span><textarea className="form-input" name={name} rows={3} required={required} /></label>;
}

function SelectInput({ name, label, records, required, empty = 'Select record' }: { name: string; label: string; records: PostAwardRecord[]; required?: boolean; empty?: string }) {
  return (
    <label>
      <span>{label}</span>
      <select className="form-input" name={name} required={required}>
        <option value="">{empty}</option>
        {records.map((record) => <option value={record.id} key={record.id}>{record.title}</option>)}
      </select>
    </label>
  );
}

function SelectStatic({ name, label, values }: { name: string; label: string; values: string[] }) {
  return (
    <label>
      <span>{label}</span>
      <select className="form-input" name={name}>
        {values.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}
      </select>
    </label>
  );
}

function SelectInvoiceable({ workspace }: { workspace: PostAwardWorkspace }) {
  return (
    <label>
      <span>Accepted execution item</span>
      <select className="form-input" name="executionReference" required>
        <option value="">Select accepted work</option>
        {workspace.financialEligibility.invoiceableRecords.map((record) => (
          <option value={`${record.executionReferenceType || record.type}::${record.executionReferenceId || record.id}`} disabled={record.blockingReasons.length > 0} key={`${record.type}-${record.id}`}>
            {record.title} / {record.remainingInvoiceableAmount === null ? 'value open' : `${record.currency} ${record.remainingInvoiceableAmount} left`}
          </option>
        ))}
      </select>
    </label>
  );
}

function field(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function numberField(form: FormData, name: string) {
  const value = field(form, name);
  return value ? Number(value) : undefined;
}

function payloadFor(actionKey: string, form: FormData, workspace: PostAwardWorkspace) {
  const buyerPrivateFinance = ['payment-approval', 'invoice-verify', 'payment-recommendation', 'payment-approval-review', 'payment-initiate', 'payment-complete', 'finance-deduction-review', 'finance-retention', 'finance-advance-recovery', 'finance-liquidated-damages'].includes(actionKey);
  const base = { payload: { source: 'post-award-workspace', visibilityScope: buyerPrivateFinance ? 'BUYER_PRIVATE' : 'SHARED' } };
  const text = (name: string) => field(form, name);
  const num = (name: string) => numberField(form, name);
  const datetime = (name: string) => text(name) ? new Date(text(name)).toISOString() : undefined;
  const paymentAmounts = (fallbackGross?: number) => {
    const gross = num('grossAmount') ?? fallbackGross;
    const retention = num('retentionAmount') ?? 0;
    const advance = num('advanceRecovery') ?? 0;
    const damages = num('liquidatedDamages') ?? 0;
    const tax = num('taxWithholding') ?? 0;
    return {
      grossAmount: gross,
      retentionAmount: retention,
      advanceRecovery: advance,
      liquidatedDamages: damages,
      taxWithholding: tax,
      netAmount: num('netAmount') ?? (gross !== undefined ? Math.max(gross - retention - advance - damages - tax, 0) : undefined)
    };
  };
  if (actionKey === 'management-plan') return { ...base, objectives: text('objectives'), monitoringPlan: text('monitoringPlan'), reportingPlan: text('reportingPlan'), communicationPlan: text('communicationPlan') };
  if (actionKey === 'management-plan-draft') return { overwrite: form.get('overwrite') === 'on', payload: { ...base.payload, note: text('note') } };
  if (actionKey === 'activation-submit') return { itemId: text('itemId'), note: text('note'), payload: base.payload };
  if (actionKey === 'activation-review') return { itemId: text('itemId'), status: text('status'), note: text('note'), payload: base.payload };
  if (actionKey === 'goods-delivery-schedule') return { ...base, description: text('description'), plannedQuantity: num('plannedQuantity'), unit: text('unit'), deliveryLocation: text('deliveryLocation'), plannedDeliveryDate: text('plannedDeliveryDate') || undefined, status: 'OPEN' };
  if (actionKey === 'dispatch-notice') return { ...base, scheduleId: text('scheduleId') || undefined, dispatchReference: text('dispatchReference'), carrier: text('carrier'), trackingReference: text('trackingReference'), dispatchedQuantity: num('dispatchedQuantity'), expectedArrivalDate: text('expectedArrivalDate') || undefined };
  if (actionKey === 'goods-receipt') return { ...base, dispatchNoticeId: text('dispatchNoticeId') || undefined, receiptReference: text('receiptReference'), receivedAt: isoNow(), status: 'APPROVED', note: text('note'), lines: [{ scheduleId: text('scheduleId') || undefined, description: text('lineDescription'), receivedQuantity: num('receivedQuantity'), acceptedQuantity: num('acceptedQuantity'), rejectedQuantity: num('rejectedQuantity'), payload: {} }] };
  if (actionKey === 'goods-inspection') return { ...base, goodsReceiptId: text('goodsReceiptId') || undefined, goodsDescription: text('goodsDescription'), quantityOrdered: num('quantityOrdered'), quantityReceived: num('quantityReceived'), quantityAccepted: num('quantityAccepted'), quantityRejected: num('quantityRejected'), result: text('result') || 'APPROVED', inspectedAt: isoNow(), note: text('note'), payload: { ...base.payload, goodsReceiptId: text('goodsReceiptId') || undefined } };
  if (actionKey === 'acceptance') return { ...base, goodsReceiptId: text('goodsReceiptId') || undefined, goodsInspectionId: text('goodsInspectionId') || undefined, certificateNo: text('certificateNo'), status: text('status') || 'APPROVED', acceptedValue: num('acceptedValue'), currency: workspace.contract.currency, acceptedAt: isoNow(), note: text('note') };
  if (actionKey === 'site-handover') return { ...base, handoverReference: text('handoverReference'), location: text('location'), handedOverBy: text('handedOverBy'), receivedBy: text('receivedBy'), handoverDate: text('handoverDate') || undefined, constraints: text('constraints') };
  if (actionKey === 'works-progress') return { ...base, reportReference: text('reportReference'), programmeReference: text('programmeReference'), periodStart: text('periodStart') || undefined, periodEnd: text('periodEnd') || undefined, progressPercent: num('progressPercent'), narrative: text('narrative'), payload: { ...base.payload, resources: text('resources'), delays: text('delays') } };
  if (actionKey === 'works-progress-review') return { reportId: text('reportId'), status: text('status') || 'APPROVED', progressPercent: num('progressPercent'), note: text('note'), payload: base.payload };
  if (actionKey === 'boq-measurement') return { ...base, reportId: text('reportId') || undefined, measurementReference: text('measurementReference'), boqItemReference: text('boqItemReference'), description: text('description'), previousQuantity: num('previousQuantity'), currentQuantity: num('currentQuantity'), cumulativeQuantity: num('cumulativeQuantity'), unitRate: num('unitRate'), amount: num('amount'), certifiedQuantity: num('certifiedQuantity'), certifiedAmount: num('certifiedAmount'), status: text('status') || 'MEASURED' };
  if (actionKey === 'boq-measurement-review') return { measurementId: text('measurementId'), status: text('status') || 'APPROVED', certifiedQuantity: num('certifiedQuantity'), certifiedAmount: num('certifiedAmount'), note: text('note'), payload: base.payload };
  if (actionKey === 'interim-payment-certificate') {
    const gross = num('grossAmount');
    const retention = num('retentionAmount') ?? 0;
    const advance = num('advanceRecoveryAmount') ?? 0;
    const damages = num('liquidatedDamagesAmount') ?? 0;
    const tax = num('taxWithholdingAmount') ?? 0;
    const other = num('otherDeductionsAmount') ?? 0;
    return { ...base, measurementId: text('measurementId') || undefined, certificateNumber: text('certificateNumber'), certificateType: text('certificateType') || 'INTERIM', periodStart: text('periodStart') || undefined, periodEnd: text('periodEnd') || undefined, grossAmount: gross, retentionAmount: retention, advanceRecoveryAmount: advance, liquidatedDamagesAmount: damages, taxWithholdingAmount: tax, otherDeductionsAmount: other, deductionsAmount: retention + advance + damages + tax + other, netAmount: num('netAmount') ?? (gross !== undefined ? Math.max(gross - retention - advance - damages - tax - other, 0) : undefined), currency: workspace.contract.currency, status: text('status') || 'DRAFT', approvedAt: ['CERTIFIED', 'APPROVED'].includes(text('status')) ? isoNow() : undefined };
  }
  if (actionKey === 'ipc-certify') {
    const gross = num('grossAmount');
    const retention = num('retentionAmount') ?? 0;
    const advance = num('advanceRecoveryAmount') ?? 0;
    const damages = num('liquidatedDamagesAmount') ?? 0;
    const tax = num('taxWithholdingAmount') ?? 0;
    const other = num('otherDeductionsAmount') ?? 0;
    return { certificateId: text('certificateId'), status: text('status') || 'CERTIFIED', grossAmount: gross, retentionAmount: retention, advanceRecoveryAmount: advance, liquidatedDamagesAmount: damages, taxWithholdingAmount: tax, otherDeductionsAmount: other, deductionsAmount: retention + advance + damages + tax + other, netAmount: num('netAmount') ?? (gross !== undefined ? Math.max(gross - retention - advance - damages - tax - other, 0) : undefined), note: text('note'), payload: base.payload };
  }
  if (actionKey === 'contract-defect') return { ...base, defectReference: text('defectReference'), title: text('title'), description: text('description'), severity: text('severity') || 'MINOR', dueDate: text('dueDate') || undefined, sourceRecordType: text('sourceRecordType'), sourceRecordId: text('sourceRecordId') || undefined, responsibleRole: 'SUPPLIER', responseDueDate: text('responseDueDate') || undefined, status: 'OPEN' };
  if (actionKey === 'defect-response') return { defectId: text('defectId'), status: 'SUBMITTED', response: text('response'), evidence: text('evidenceNote') ? [{ note: text('evidenceNote'), recordedAt: isoNow() }] : [], payload: base.payload };
  if (actionKey === 'defect-verify') return { defectId: text('defectId'), status: text('status') || 'CLOSED', verifiedNote: text('verifiedNote'), closureNote: text('verifiedNote'), payload: base.payload };
  if (actionKey === 'works-completion-certificate') return { ...base, certificateNumber: text('certificateNumber'), certificateType: text('certificateType') || 'PRACTICAL_COMPLETION', status: text('status') || 'ISSUED', progressReportId: text('progressReportId') || undefined, ipcId: text('ipcId') || undefined, completionDate: text('completionDate') || undefined, defectsSummary: text('defectsSummary'), outstandingWorks: text('outstandingWorks'), finalAccountAmount: num('finalAccountAmount'), retentionReleaseAmount: num('retentionReleaseAmount'), currency: workspace.contract.currency, note: text('note') };
  if (actionKey === 'service-level') return { ...base, metricKey: text('metricKey'), title: text('title'), targetValue: text('targetValue'), measurementUnit: text('measurementUnit'), creditRule: text('creditRule') };
  if (actionKey === 'service-period') return { ...base, periodKey: text('periodKey'), startDate: text('startDate'), endDate: text('endDate') };
  if (actionKey === 'service-report') return { ...base, periodId: text('periodId') || undefined, reportReference: text('reportReference'), submittedAt: isoNow(), summary: text('summary'), status: 'SUBMITTED', payload: { ...base.payload, slaEvidence: text('slaEvidence'), breachExplanation: text('breachExplanation'), correctiveAction: text('correctiveAction') } };
  if (actionKey === 'service-report-review') return { reportId: text('reportId'), status: text('status') || 'APPROVED', verifiedSlaResult: text('verifiedSlaResult'), acceptedAmount: num('acceptedAmount'), correctionDueDate: text('correctionDueDate') || undefined, note: text('note'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'service-incident') return { ...base, incidentReference: text('incidentReference'), incidentType: text('incidentType') || 'INCIDENT', title: text('title'), description: text('description'), severity: text('severity') || 'MINOR', serviceLevelId: text('serviceLevelId') || undefined, periodId: text('periodId') || undefined, serviceReportId: text('serviceReportId') || undefined, dueDate: text('dueDate') || undefined, responsibleRole: 'SUPPLIER', responseDueDate: text('responseDueDate') || undefined, status: 'OPEN' };
  if (actionKey === 'service-incident-response') return { incidentId: text('incidentId'), status: 'SUBMITTED', response: text('response'), evidence: text('evidenceNote') ? [{ note: text('evidenceNote'), recordedAt: isoNow() }] : [], payload: base.payload };
  if (actionKey === 'service-incident-verify') return { incidentId: text('incidentId'), status: text('status') || 'CLOSED', verifiedNote: text('verifiedNote'), closureNote: text('verifiedNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'service-credit') return { ...base, serviceLevelId: text('serviceLevelId') || undefined, periodId: text('periodId') || undefined, serviceReportId: text('serviceReportId') || undefined, creditType: text('creditType') || 'SERVICE_CREDIT', amount: num('amount'), invoiceImpactAmount: num('invoiceImpactAmount'), currency: workspace.contract.currency, reason: text('reason'), status: 'DRAFT', payload: { ...base.payload, paymentEligible: text('creditType') === 'PAYABLE_ADJUSTMENT' } };
  if (actionKey === 'service-credit-review') return { creditId: text('creditId'), status: text('status') || 'APPROVED', decision: text('status') || 'APPROVED', amount: num('amount'), invoiceImpactAmount: num('invoiceImpactAmount'), reason: text('reason'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'consultancy-deliverable') return { ...base, deliverableCode: text('deliverableCode'), title: text('title'), dueDate: text('dueDate') || undefined, description: text('description'), acceptedAmount: num('acceptedAmount'), paymentEligible: form.get('paymentEligible') === 'on', isFinalReport: form.get('isFinalReport') === 'on', status: 'OPEN' };
  if (actionKey === 'consultancy-deliverable-review') return { deliverableId: text('deliverableId'), status: text('status') || 'APPROVED', acceptedAmount: num('acceptedAmount'), paymentEligible: form.get('paymentEligible') === 'on', note: text('note'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'deliverable-version') return { ...base, deliverableId: text('deliverableId') || undefined, previousVersionId: text('previousVersionId') || undefined, versionNo: num('versionNo'), submittedAt: isoNow(), note: text('note'), revisionReason: text('revisionReason'), status: 'SUBMITTED' };
  if (actionKey === 'deliverable-review') return { versionId: text('versionId') || undefined, decision: text('decision'), reviewedAt: isoNow(), comments: text('comments'), commentSummary: text('comments'), buyerPrivateNotes: text('buyerPrivateNotes'), acceptedAmount: num('acceptedAmount'), revisionDueDate: text('revisionDueDate') || undefined, paymentEligible: form.get('paymentEligible') === 'on', payload: { ...base.payload, visibilityScope: text('buyerPrivateNotes') ? 'BUYER_PRIVATE' : 'SHARED' } };
  if (actionKey === 'deliverable-payment-eligibility') return { reviewId: text('reviewId'), decision: text('decision') || 'APPROVED', acceptedAmount: num('acceptedAmount'), paymentEligible: form.get('paymentEligible') === 'on', note: text('note'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'consultancy-final-report') return { ...base, reportReference: text('reportReference'), deliverableId: text('deliverableId') || undefined, versionId: text('versionId') || undefined, submittedAt: isoNow(), summary: text('summary'), status: 'SUBMITTED' };
  if (actionKey === 'consultancy-final-report-review') return { reportId: text('reportId'), status: text('status') || 'APPROVED', acceptedAmount: num('acceptedAmount'), paymentEligible: form.get('paymentEligible') === 'on', note: text('note'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'invoice') {
    const [executionReferenceType = '', executionReferenceId = ''] = text('executionReference').split('::');
    return { ...base, reference: text('reference'), executionReferenceType, executionReferenceId, amount: Number(text('amount')), currency: text('currency') || workspace.contract.currency, status: 'SUBMITTED' };
  }
  if (actionKey === 'three-way-match') return { ...base, invoiceId: text('invoiceId'), acceptanceId: text('acceptanceId') || undefined, goodsReceiptId: text('goodsReceiptId') || undefined, goodsInspectionId: text('goodsInspectionId') || undefined, scheduleId: text('scheduleId') || undefined, poMatched: form.get('poMatched') === 'on', receiptMatched: form.get('receiptMatched') === 'on', invoiceMatched: form.get('invoiceMatched') === 'on', varianceAmount: num('varianceAmount'), mismatchType: text('mismatchType'), currency: workspace.contract.currency, note: text('note') };
  if (actionKey === 'invoice-correction') return { ...base, invoiceId: text('invoiceId'), note: text('note'), status: 'SUBMITTED' };
  if (actionKey === 'invoice-verify') return { ...base, invoiceId: text('invoiceId'), financeAction: text('financeAction') || 'verify', note: text('note'), privateNote: text('privateNote'), decision: text('financeAction') || 'verify' };
  if (actionKey === 'payment-recommendation') return { ...base, invoiceId: text('invoiceId'), amountApproved: num('amountApproved'), currency: workspace.contract.currency, note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, ...paymentAmounts(num('amountApproved')) } };
  if (actionKey === 'payment-approval-review') return { ...base, approvalId: text('approvalId'), approvalAction: text('approvalAction') || 'approve', amountApproved: num('amountApproved'), currency: workspace.contract.currency, note: text('note'), privateNote: text('privateNote'), signatureKeyphrase: text('signatureKeyphrase') };
  if (actionKey === 'payment-initiate') return { ...base, invoiceId: text('invoiceId'), currency: workspace.contract.currency, reference: text('reference'), note: text('note'), status: 'REVIEW', ...paymentAmounts() };
  if (actionKey === 'payment-complete') return { ...base, paymentId: text('paymentId'), currency: workspace.contract.currency, reference: text('reference'), paidAt: datetime('paidAt'), note: text('note'), status: 'PAID', ...paymentAmounts() };
  if (actionKey === 'payment-confirmation') return { ...base, paymentId: text('paymentId'), paidAmount: num('paidAmount'), currency: workspace.contract.currency, confirmationReference: text('confirmationReference') || undefined, paidAt: datetime('paidAt'), note: text('note') };
  if (actionKey === 'finance-deduction-review') return { ...base, invoiceId: text('invoiceId') || undefined, amount: num('amount'), currency: workspace.contract.currency, status: text('status') || 'DRAFT', note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, penaltyType: text('deductionType') || 'FINANCE_DEDUCTION' } };
  if (actionKey === 'finance-retention') return { ...base, amount: num('amount'), currency: workspace.contract.currency, status: text('status') || 'DRAFT', note: text('note'), privateNote: text('privateNote') };
  if (actionKey === 'finance-advance-recovery') return { ...base, amount: num('amount'), currency: workspace.contract.currency, status: text('status') || 'DRAFT', note: text('note'), privateNote: text('privateNote') };
  if (actionKey === 'finance-liquidated-damages') return { ...base, invoiceId: text('invoiceId') || undefined, amount: num('amount'), currency: workspace.contract.currency, status: text('status') || 'DRAFT', note: text('note'), privateNote: text('privateNote') };
  if (actionKey === 'payment-approval') return { ...base, invoiceId: text('invoiceId'), stepKey: 'payment-approval', role: 'BUYER', amountApproved: num('amountApproved'), currency: workspace.contract.currency, note: text('note'), signatureKeyphrase: text('signatureKeyphrase'), status: 'MATCHED' };
  if (actionKey === 'issue') return { ...base, title: text('title'), category: text('category') || 'execution', description: text('description'), note: text('note'), status: 'OPEN' };
  if (actionKey === 'non-conformance') return { ...base, category: text('category'), title: text('title'), severity: text('severity'), correctiveAction: text('correctiveAction'), correctiveActionDeadline: text('correctiveActionDeadline') || undefined, status: 'OPEN' };
  if (actionKey === 'change-request') return { ...base, changeType: text('changeType'), title: text('title'), reason: text('reason'), technicalReview: text('technicalReview'), financialReview: text('financialReview'), status: 'RAISED' };
  if (actionKey === 'claim') return { ...base, title: text('title'), claimType: text('claimType'), description: text('description'), amount: num('amount'), currency: workspace.contract.currency, raisedByRole: workspace.contract.viewerRole, submittedAt: isoNow(), status: 'OPEN' };
  if (actionKey === 'change-request-respond') return { recordId: text('recordId'), response: text('response'), note: text('note'), payload: base.payload };
  if (actionKey === 'change-request-review' || actionKey === 'variation-review' || actionKey === 'extension-review') return { recordId: text('recordId'), controlAction: text('controlAction') || 'review', amendmentId: text('amendmentId') || undefined, note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'claim-response') return { recordId: text('recordId'), controlAction: text('controlAction') || 'respond', amountApproved: num('amountApproved'), response: text('response'), note: text('response'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: text('privateNote') ? 'BUYER_PRIVATE' : 'SHARED' } };
  if (actionKey === 'ncr-response') return { recordId: text('recordId'), response: text('response'), note: text('note'), payload: base.payload };
  if (actionKey === 'ncr-verify') return { recordId: text('recordId'), status: text('status') || 'APPROVED', decision: text('status') || 'APPROVED', note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'risk-mitigate') return { recordId: text('recordId'), controlAction: text('controlAction') || 'mitigate', dueDate: text('dueDate') || undefined, note: text('note'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'issue-resolve') return { recordId: text('recordId'), response: text('response'), note: text('response'), payload: base.payload };
  if (actionKey === 'issue-close') return { recordId: text('recordId'), note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'dispute') return { ...base, title: text('title'), category: text('category') || 'DISPUTE_BOARD', description: text('description'), note: text('note'), status: 'OPEN', payload: { ...base.payload, route: text('category') || 'DISPUTE_BOARD' } };
  if (actionKey === 'dispute-response') return { recordId: text('recordId'), response: text('response'), payload: base.payload };
  if (actionKey === 'dispute-resolve') return { recordId: text('recordId'), controlAction: text('controlAction') || 'resolve', decision: text('decision'), note: text('decision'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'termination') return { ...base, terminationType: text('terminationType') || 'SUPPLIER_DEFAULT', reason: text('reason'), contractClause: text('contractClause'), faultParty: text('faultParty'), cureDeadline: text('cureDeadline') || undefined };
  if (actionKey === 'termination-response') return { recordId: text('recordId'), response: text('response'), supplierResponse: text('response'), payload: base.payload };
  if (actionKey === 'termination-decision') return { recordId: text('recordId'), controlAction: text('controlAction') || 'decide', decision: text('decision'), note: text('decision'), settlementAmount: num('settlementAmount'), signatureKeyphrase: text('signatureKeyphrase'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'notice') return { ...base, noticeType: text('noticeType') || 'FORMAL_NOTICE', title: text('title'), body: text('body'), senderRole: workspace.contract.viewerRole, recipientRole: text('recipientRole') || 'SUPPLIER', status: 'SENT', sentAt: isoNow(), dueDate: text('dueDate') || undefined, note: text('note') };
  if (actionKey === 'notice-acknowledge') return { recordId: text('recordId'), status: 'ACKNOWLEDGED', acknowledgedAt: isoNow(), note: text('note'), payload: base.payload };
  if (actionKey === 'notice-respond') return { recordId: text('recordId'), status: 'RESPONDED', respondedAt: isoNow(), response: text('response'), note: text('note'), payload: base.payload };
  if (actionKey === 'notice-close') return { recordId: text('recordId'), status: 'CLOSED', closedAt: isoNow(), note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'meeting') {
    const actionTitle = text('actionTitle');
    return { ...base, meetingType: text('meetingType') || 'PROGRESS_MEETING', title: text('title'), meetingDate: datetime('meetingDate'), agenda: text('agenda'), minutes: text('minutes'), decisions: text('decisions'), actions: actionTitle ? [{ title: actionTitle, ownerRole: text('actionOwnerRole') || 'SHARED', dueDate: text('actionDueDate') || undefined, payload: base.payload }] : [] };
  }
  if (actionKey === 'meeting-action-complete') return { recordId: text('recordId'), status: 'SUBMITTED', response: text('response'), note: text('note'), payload: base.payload };
  if (actionKey === 'meeting-action-verify') return { recordId: text('recordId'), meetingActionDecision: text('meetingActionDecision') || 'verify', status: text('meetingActionDecision') === 'close' ? 'CLOSED' : 'APPROVED', verificationNote: text('verificationNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'security') return { ...base, securityType: text('securityType'), issuingInstitution: text('issuingInstitution'), referenceNumber: text('referenceNumber'), amount: num('amount'), currency: workspace.contract.currency, verificationStatus: text('verificationStatus') };
  if (actionKey === 'security-review') return { recordId: text('recordId'), securityAction: text('securityAction') || 'review', verificationStatus: text('verificationStatus') || undefined, claimStatus: text('claimStatus') || undefined, expiryDate: text('expiryDate') || undefined, releasedAt: text('securityAction') === 'release' ? isoNow() : undefined, note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'required-document') return { ...base, documentType: text('documentType'), title: text('title'), ownerRole: text('ownerRole'), status: text('status'), dueDate: text('dueDate') || undefined };
  if (actionKey === 'warranty') return { ...base, title: text('title'), defectReference: text('defectReference'), startDate: text('startDate') || undefined, endDate: text('endDate') || undefined, responsibleRole: 'BUYER', status: 'OPEN', note: text('note') };
  if (actionKey === 'warranty-response') return { recordId: text('recordId'), status: 'SUBMITTED', response: text('response'), note: text('note'), payload: base.payload };
  if (actionKey === 'warranty-verify') return { recordId: text('recordId'), warrantyAction: text('warrantyAction') || 'verify', status: text('status') || 'APPROVED', decision: text('status') || 'APPROVED', note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'urgent-actions-recalculate') return { note: text('note'), payload: base.payload };
  if (actionKey === 'closeout-step') return { stepId: text('stepId'), status: text('status') || 'APPROVED', note: text('note'), privateNote: text('privateNote'), payload: { ...base.payload, visibilityScope: 'BUYER_PRIVATE' } };
  if (actionKey === 'performance') return { ...base, overallScore: num('overallScore'), timeScore: num('timeScore'), qualityScore: num('qualityScore'), costScore: num('costScore'), complianceScore: num('complianceScore'), note: text('note') };
  return { ...base, completionCertificate: form.get('completionCertificate') === 'on', finalAccountApproved: form.get('finalAccountApproved') === 'on', lessonsLearned: text('lessonsLearned'), status: 'CLOSED', signatureKeyphrase: text('signatureKeyphrase') };
}

async function saveAction(actionKey: string, contractId: string, payload: Record<string, unknown>, workspace: PostAwardWorkspace) {
  if (actionKey === 'management-plan') return postAwardApi.upsertManagementPlan(contractId, payload);
  if (actionKey === 'management-plan-draft') return postAwardApi.generateManagementPlanDraft(contractId, payload);
  if (actionKey === 'activation-submit') return postAwardApi.submitActivationItem(contractId, String(payload.itemId), payload);
  if (actionKey === 'activation-review') return postAwardApi.reviewActivationItem(contractId, String(payload.itemId), payload);
  if (actionKey === 'goods-delivery-schedule') return postAwardApi.createDeliverySchedule(contractId, payload);
  if (actionKey === 'dispatch-notice') return postAwardApi.createDispatchNotice(contractId, payload);
  if (actionKey === 'goods-receipt') return postAwardApi.createGoodsReceipt(contractId, payload);
  if (actionKey === 'goods-inspection') return postAwardApi.createGoodsInspection(contractId, payload);
  if (actionKey === 'acceptance') return postAwardApi.createAcceptance(contractId, payload);
  if (actionKey === 'site-handover') return postAwardApi.createSiteHandover(contractId, payload);
  if (actionKey === 'works-progress') return postAwardApi.createWorksProgressReport(contractId, payload);
  if (actionKey === 'works-progress-review') {
    const { reportId, ...body } = payload;
    return postAwardApi.reviewWorksProgressReport(contractId, String(reportId), body);
  }
  if (actionKey === 'boq-measurement') return postAwardApi.createBoqMeasurement(contractId, payload);
  if (actionKey === 'boq-measurement-review') {
    const { measurementId, ...body } = payload;
    return postAwardApi.reviewBoqMeasurement(contractId, String(measurementId), body);
  }
  if (actionKey === 'interim-payment-certificate') return postAwardApi.createInterimPaymentCertificate(contractId, payload);
  if (actionKey === 'ipc-certify') {
    const { certificateId, ...body } = payload;
    return postAwardApi.certifyInterimPaymentCertificate(contractId, String(certificateId), body);
  }
  if (actionKey === 'works-completion-certificate') return postAwardApi.createWorksCompletionCertificate(contractId, payload);
  if (actionKey === 'contract-defect') return postAwardApi.createContractDefect(contractId, payload);
  if (actionKey === 'defect-response') {
    const { defectId, ...body } = payload;
    return postAwardApi.respondToContractDefect(contractId, String(defectId), body);
  }
  if (actionKey === 'defect-verify') {
    const { defectId, ...body } = payload;
    if (String(body.status ?? '').toUpperCase() === 'CLOSED') return postAwardApi.closeContractDefect(contractId, String(defectId), body);
    return postAwardApi.verifyContractDefect(contractId, String(defectId), body);
  }
  if (actionKey === 'service-level') return postAwardApi.createServiceLevel(contractId, payload);
  if (actionKey === 'service-period') return postAwardApi.createServicePeriod(contractId, payload);
  if (actionKey === 'service-report') return postAwardApi.createServiceReport(contractId, payload);
  if (actionKey === 'service-report-review') {
    const { reportId, ...body } = payload;
    return postAwardApi.reviewServiceReport(contractId, String(reportId), body);
  }
  if (actionKey === 'service-incident') return postAwardApi.createServiceIncident(contractId, payload);
  if (actionKey === 'service-incident-response') {
    const { incidentId, ...body } = payload;
    return postAwardApi.respondToServiceIncident(contractId, String(incidentId), body);
  }
  if (actionKey === 'service-incident-verify') {
    const { incidentId, ...body } = payload;
    if (String(body.status ?? '').toUpperCase() === 'CLOSED') return postAwardApi.closeServiceIncident(contractId, String(incidentId), body);
    return postAwardApi.verifyServiceIncident(contractId, String(incidentId), body);
  }
  if (actionKey === 'service-credit') return postAwardApi.createServiceCredit(contractId, payload);
  if (actionKey === 'service-credit-review') {
    const { creditId, ...body } = payload;
    return postAwardApi.reviewServiceCredit(contractId, String(creditId), body);
  }
  if (actionKey === 'consultancy-deliverable') return postAwardApi.createConsultancyDeliverable(contractId, payload);
  if (actionKey === 'consultancy-deliverable-review') {
    const { deliverableId, ...body } = payload;
    return postAwardApi.reviewConsultancyDeliverable(contractId, String(deliverableId), body);
  }
  if (actionKey === 'deliverable-version') return postAwardApi.createDeliverableVersion(contractId, payload);
  if (actionKey === 'deliverable-review') {
    const { versionId, ...body } = payload;
    return postAwardApi.reviewDeliverableVersion(contractId, String(versionId), body);
  }
  if (actionKey === 'deliverable-payment-eligibility') {
    const { reviewId, ...body } = payload;
    return postAwardApi.confirmDeliverableReviewPaymentEligibility(contractId, String(reviewId), body);
  }
  if (actionKey === 'consultancy-final-report') return postAwardApi.upsertConsultancyFinalReport(contractId, payload);
  if (actionKey === 'consultancy-final-report-review') {
    const { reportId, ...body } = payload;
    return postAwardApi.reviewConsultancyFinalReport(contractId, String(reportId), body);
  }
  if (actionKey === 'invoice') return postAwardApi.createInvoice(contractId, payload);
  if (actionKey === 'three-way-match') return postAwardApi.upsertThreeWayMatch(contractId, payload);
  if (actionKey === 'invoice-correction') {
    const { invoiceId, ...body } = payload;
    return postAwardApi.correctInvoiceFinance(contractId, String(invoiceId), body);
  }
  if (actionKey === 'invoice-verify') {
    const { invoiceId, financeAction, ...body } = payload;
    const action = String(financeAction || 'verify');
    if (action === 'return') return postAwardApi.returnInvoiceFinance(contractId, String(invoiceId), body);
    if (action === 'reject') return postAwardApi.rejectInvoiceFinance(contractId, String(invoiceId), body);
    return postAwardApi.verifyInvoiceFinance(contractId, String(invoiceId), body);
  }
  if (actionKey === 'payment-recommendation') return postAwardApi.createPaymentRecommendation(contractId, payload);
  if (actionKey === 'payment-approval-review') {
    const { approvalId, approvalAction, ...body } = payload;
    return postAwardApi.reviewPaymentApproval(contractId, String(approvalId), String(approvalAction || 'approve'), body);
  }
  if (actionKey === 'payment-initiate') return postAwardApi.createPayment(contractId, payload);
  if (actionKey === 'payment-complete') {
    const { paymentId, ...body } = payload;
    return postAwardApi.controlPayment(contractId, String(paymentId), 'complete', body);
  }
  if (actionKey === 'payment-confirmation') return postAwardApi.createPostAwardPaymentConfirmation(contractId, payload);
  if (actionKey === 'finance-deduction-review') return postAwardApi.createFinanceDeduction(contractId, payload);
  if (actionKey === 'finance-retention') return postAwardApi.createFinanceRetention(contractId, payload);
  if (actionKey === 'finance-advance-recovery') return postAwardApi.createFinanceAdvanceRecovery(contractId, payload);
  if (actionKey === 'finance-liquidated-damages') return postAwardApi.createFinanceLiquidatedDamages(contractId, payload);
  if (actionKey === 'payment-approval') return postAwardApi.createPaymentApproval(contractId, payload);
  if (actionKey === 'issue') return postAwardApi.createIssue(contractId, payload);
  if (actionKey === 'non-conformance') return postAwardApi.createNonConformance(contractId, payload);
  if (actionKey === 'change-request') return postAwardApi.createContractChangeRequest(contractId, payload);
  if (actionKey === 'claim') return postAwardApi.createClaim(contractId, payload);
  if (actionKey === 'change-request-respond') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlChangeRequest(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'change-request-review') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlChangeRequest(contractId, String(recordId), String(controlAction || 'review'), body);
  }
  if (actionKey === 'variation-review') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlVariation(contractId, String(recordId), String(controlAction || 'review'), body);
  }
  if (actionKey === 'extension-review') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlExtensionRequest(contractId, String(recordId), String(controlAction || 'review'), body);
  }
  if (actionKey === 'claim-response') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlClaim(contractId, String(recordId), String(controlAction || 'respond'), body);
  }
  if (actionKey === 'ncr-response') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlNonConformance(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'ncr-verify') {
    const { recordId, status, ...body } = payload;
    const action = String(status ?? '').toUpperCase() === 'CLOSED' ? 'close' : 'verify';
    return postAwardApi.controlNonConformance(contractId, String(recordId), action, { ...body, status });
  }
  if (actionKey === 'risk-mitigate') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlRisk(contractId, String(recordId), String(controlAction || 'mitigate'), body);
  }
  if (actionKey === 'issue-resolve') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlIssue(contractId, String(recordId), 'resolve', body);
  }
  if (actionKey === 'issue-close') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlIssue(contractId, String(recordId), 'close', body);
  }
  if (actionKey === 'dispute') return postAwardApi.createDispute(contractId, payload);
  if (actionKey === 'dispute-response') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlDispute(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'dispute-resolve') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlDispute(contractId, String(recordId), String(controlAction || 'resolve'), body);
  }
  if (actionKey === 'termination') return postAwardApi.createTermination(contractId, payload);
  if (actionKey === 'termination-response') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlTermination(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'termination-decision') {
    const { recordId, controlAction, ...body } = payload;
    return postAwardApi.controlTermination(contractId, String(recordId), String(controlAction || 'decide'), body);
  }
  if (actionKey === 'notice') return postAwardApi.createContractNotice(contractId, payload);
  if (actionKey === 'notice-acknowledge') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlContractNotice(contractId, String(recordId), 'acknowledge', body);
  }
  if (actionKey === 'notice-respond') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlContractNotice(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'notice-close') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlContractNotice(contractId, String(recordId), 'close', body);
  }
  if (actionKey === 'meeting') return postAwardApi.createContractMeeting(contractId, payload);
  if (actionKey === 'meeting-action-complete') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlContractMeetingAction(contractId, String(recordId), 'complete', body);
  }
  if (actionKey === 'meeting-action-verify') {
    const { recordId, meetingActionDecision, ...body } = payload;
    return postAwardApi.controlContractMeetingAction(contractId, String(recordId), String(meetingActionDecision || 'verify'), body);
  }
  if (actionKey === 'security') return postAwardApi.createContractSecurity(contractId, payload);
  if (actionKey === 'security-review') {
    const { recordId, securityAction, ...body } = payload;
    return postAwardApi.controlContractSecurity(contractId, String(recordId), String(securityAction || 'review'), body);
  }
  if (actionKey === 'required-document') return postAwardApi.upsertRequiredDocument(contractId, payload);
  if (actionKey === 'warranty') return postAwardApi.upsertWarranty(contractId, payload);
  if (actionKey === 'warranty-response') {
    const { recordId, ...body } = payload;
    return postAwardApi.controlWarranty(contractId, String(recordId), 'respond', body);
  }
  if (actionKey === 'warranty-verify') {
    const { recordId, warrantyAction, ...body } = payload;
    return postAwardApi.controlWarranty(contractId, String(recordId), String(warrantyAction || 'verify'), body);
  }
  if (actionKey === 'urgent-actions-recalculate') return postAwardApi.recalculateUrgentActions(contractId);
  if (actionKey === 'closeout-step') {
    const { stepId, ...body } = payload;
    return postAwardApi.updateCloseoutStep(contractId, String(stepId), body);
  }
  if (actionKey === 'performance') return postAwardApi.upsertSupplierPerformance(contractId, payload);
  if (workspace.contract.status === 'CLOSED') return postAwardApi.workspace(contractId);
  return postAwardApi.upsertCloseout(contractId, payload);
}
