import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, type AdminApp, type AdminDashboard } from '@/features/admin/api';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import { AdminCommandDrawer, AdminError, AdminShell, AdminUndoBanner } from './AdminShared';
import { adminAppRegistry, badgeClass, compactNumber, displayLabel, formatDate, useAdminCommand } from './AdminSharedUtils';

type AdminQueueItem = AdminDashboard['adminActionQueue'][number];

export function AdminDashboardProcurexPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [apps, setApps] = useState<AdminApp[]>(adminAppRegistry);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState('');
  const [error, setError] = useState<unknown>(null);
  const { command, openCommand, closeCommand, undoAction, setUndoAction } = useAdminCommand();

  useBodyPageMetadata('admin-dashboard');

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResponse, appsResponse] = await Promise.all([adminApi.dashboard(), adminApi.apps()]);
      setDashboard(dashboardResponse);
      setApps(appsResponse.items);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const counts = dashboard?.counts ?? {};
  const metrics = dashboard?.metrics ?? fallbackMetrics(counts);
  const appList = apps.length ? apps : adminAppRegistry;
  const queue = dashboard?.adminActionQueue ?? [];
  const riskEntries = Object.entries(dashboard?.riskSummary ?? {});
  const weeklyActions = dashboard?.weeklyComplianceActions ?? [];
  const evaluationOversight = dashboard?.evaluationOversight ?? [];
  const exceptionLog = dashboard?.exceptionLog ?? [];
  const checklistPreview = dashboard?.checklistPreview ?? [];
  const recentActions = dashboard?.recentActions ?? [];
  const platformRows = platformStatusRows(counts);
  const platformMax = Math.max(1, ...platformRows.map((item) => item.value));
  const riskMax = Math.max(1, ...riskEntries.map(([, value]) => value));
  const weeklyMax = Math.max(1, ...weeklyActions.map((item) => item.count));
  const hasRiskSignals = riskEntries.length > 0 || weeklyActions.length > 0;

  async function recordQueueAction(actionType: string, item: AdminQueueItem, note: string) {
    setSavingAction(`${actionType}:${item.id}`);
    setError(null);
    try {
      const action = await adminApi.recordAction({
        ownerOrgId: item.ownerOrgId,
        actionType,
        entityType: item.entityType,
        entityRef: item.entityRef,
        summary: note || `${displayLabel(actionType)}: ${item.title}`
      });
      await loadDashboard();
      return action;
    } catch (caught) {
      setError(caught);
      throw caught;
    } finally {
      setSavingAction('');
    }
  }

  function openQueueAction(actionType: string, item: AdminQueueItem) {
    openCommand({
      title: `${displayLabel(actionType)} ${item.title}`,
      summary: `${displayLabel(actionType)} updates the target record and writes an audit entry.`,
      confirmLabel: displayLabel(actionType),
      dangerous: actionType === 'HOLD' || actionType === 'FLAG',
      run: (note) => recordQueueAction(actionType, item, note)
    });
  }

  return (
    <AdminShell currentPath="/admin" title="Admin Command Center">
      <div className="dashboard-command-center admin-dashboard-intelligence">
        <div className="workspace-home">
          <section className="dashboard-welcome-card dashboard-reference-welcome dashboard-admin-reference">
            <div className="dashboard-reference-copy">
              <span className="section-kicker">{loading ? 'Loading platform intelligence' : 'Live platform intelligence'}</span>
              <h1>Admin Command Center</h1>
              <p>Monitor account risk, compliance action, evaluation health, audit activity, and platform operations from one clear command surface.</p>
              <div className="inline-actions dashboard-welcome-actions">
                <button className="btn btn-primary" type="button" disabled={loading} onClick={() => void loadDashboard()}>
                  Refresh
                </button>
              </div>
            </div>
            <div className="dashboard-reference-visual" aria-label="Platform admin overview">
              <div className="dashboard-reference-avatar" aria-hidden="true">PX</div>
              <article className="dashboard-reference-profile">
                <span className={queue.length ? 'badge badge-warning' : 'badge badge-success'}>
                  {queue.length ? `${queue.length} admin actions` : 'Queue clear'}
                </span>
                <strong>Platform operations</strong>
                <p>{compactNumber(counts.users ?? 0)} users / {compactNumber(counts.activeTenders ?? counts.tenders ?? 0)} active tenders</p>
              </article>
              <div className="dashboard-reference-pills" aria-label="Admin dashboard totals">
                <span>{compactNumber(counts.pendingReviews ?? 0)} reviews</span>
                <span>{compactNumber(counts.flaggedIssues ?? 0)} flags</span>
                <span>{compactNumber(counts.auditEventsToday ?? 0)} audit today</span>
              </div>
            </div>
          </section>

          {error ? <AdminError error={error} /> : null}
          <AdminUndoBanner action={undoAction} onDismiss={() => setUndoAction(null)} onUndo={async (id) => {
            await adminApi.undoAction(id, { note: 'Undone from command center.' });
            await loadDashboard();
          }} />

          <section className="dashboard-intelligence-strip admin-dashboard-metrics">
            {metrics.map((metric) => (
              <article className="dashboard-intelligence-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.label === 'Compliance Rate' ? `${metric.value}%` : compactNumber(metric.value)}</strong>
                <p>{loading ? 'Loading live platform data.' : metric.detail}</p>
              </article>
            ))}
          </section>

          <section className="dashboard-intelligence-grid">
            <article className={`dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel ${queue.length ? 'dashboard-intelligence-panel-critical' : 'dashboard-intelligence-panel-compact'}`}>
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Action required</span>
                  <h2>Prioritized admin actions</h2>
                </div>
                <span className={queue.length ? 'badge badge-warning' : 'badge badge-success'}>{queue.length} items</span>
              </div>
              <div className="dashboard-action-queue">
                {queue.length ? (
                  queue.map((item) => (
                    <article className={`admin-dashboard-action-card ${item.severity === 'CRITICAL' || item.severity === 'ERROR' ? 'urgent' : ''}`} key={item.id}>
                      <div>
                        <span className={badgeClass(item.severity)}>{displayLabel(item.severity)}</span>
                        <strong>{item.title}</strong>
                        <p>{item.summary}</p>
                        <small>{item.owner} / {displayLabel(item.status)} / {formatDate(item.createdAt)}</small>
                      </div>
                      <div className="admin-table-actions">
                        {(['APPROVE', 'FLAG', 'HOLD', 'RETURN'] as const).map((action) => (
                          <button
                            className={action === 'APPROVE' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            type="button"
                            key={action}
                            disabled={loading || Boolean(savingAction)}
                            onClick={() => openQueueAction(action, item)}
                          >
                            {savingAction === `${action}:${item.id}` ? 'Saving' : displayLabel(action)}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="dashboard-empty-state">
                    <strong>No prioritized actions</strong>
                    <span>The queue is clear. New reviews, flags, holds, and escalations will appear here.</span>
                  </div>
                )}
              </div>
            </article>

            <article className="dashboard-intelligence-panel dashboard-status-overview dashboard-intelligence-panel-wide dashboard-horizontal-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Platform intelligence</span>
                  <h2>Platform Status Overview</h2>
                </div>
              </div>
              <div className="dashboard-status-stack">
                {platformRows.map((item) => (
                  <button className="dashboard-status-line" type="button" key={item.label} onClick={() => navigate(item.route)}>
                    <span>{item.label}</span>
                    <i><b style={{ width: `${Math.max(8, (item.value / platformMax) * 100)}%` }} /></i>
                    <strong>{compactNumber(item.value)}</strong>
                  </button>
                ))}
              </div>
            </article>

            {hasRiskSignals ? (
              <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Risk and compliance</span>
                    <h2>Signal distribution</h2>
                  </div>
                </div>
                <div className="dashboard-status-stack">
                  {riskEntries.map(([level, count]) => (
                    <div className="dashboard-status-line" key={level}>
                      <span>{displayLabel(level)}</span>
                      <i><b style={{ width: `${Math.max(8, (count / riskMax) * 100)}%` }} /></i>
                      <strong>{count}</strong>
                    </div>
                  ))}
                  {weeklyActions.map((item) => (
                    <div className="dashboard-status-line" key={item.label}>
                      <span>{item.label}</span>
                      <i><b style={{ width: `${Math.max(8, (item.count / weeklyMax) * 100)}%` }} /></i>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {evaluationOversight.length ? (
              <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Evaluation</span>
                    <h2>Evaluation oversight</h2>
                  </div>
                  <span className="badge badge-info">{evaluationOversight.length} drafts</span>
                </div>
                <div className="dashboard-activity-feed">
                  {evaluationOversight.map((item) => (
                    <button className="dashboard-activity-item" type="button" key={item.id} onClick={() => navigate('/admin/analytics')}>
                      <div>
                        <strong>{item.reference} / {item.tenderTitle}</strong>
                        <span>{item.buyer} / {displayLabel(item.status)} / {displayLabel(item.stage)}</span>
                      </div>
                      <time>{item.progress}%</time>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {exceptionLog.length ? (
              <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Exceptions</span>
                    <h2>Exception log</h2>
                  </div>
                  <span className="badge badge-info">{exceptionLog.length} flags</span>
                </div>
                <div className="dashboard-activity-feed">
                  {exceptionLog.map((item) => (
                    <button className="dashboard-activity-item" type="button" key={item.id} onClick={() => navigate('/admin/audit')}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.owner} / {item.summary}</span>
                      </div>
                      <span className={badgeClass(item.severity)}>{displayLabel(item.severity)}</span>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            {checklistPreview.length ? (
              <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Controls</span>
                    <h2>Compliance controls</h2>
                  </div>
                  <span className="badge badge-info">{checklistPreview.length} checks</span>
                </div>
                <div className="dashboard-activity-feed">
                  {checklistPreview.map((item) => (
                    <button className="dashboard-activity-item" type="button" key={item.id} onClick={() => navigate('/admin/audit')}>
                      <div>
                        <strong>{item.code}</strong>
                        <span>{item.title}</span>
                      </div>
                      <span className={badgeClass(item.status)}>{displayLabel(item.status)}</span>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}

            <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Admin apps</span>
                  <h2>App health and shortcuts</h2>
                </div>
                <span className="badge badge-info">{appList.length} tools</span>
              </div>
              <div className="dashboard-activity-feed">
                {appList.map((app) => (
                  <button className="dashboard-activity-item" type="button" key={app.route} onClick={() => navigate(app.route)}>
                    <div>
                      <strong>{app.title}</strong>
                      <span>{app.description} / {appBackendHint(app, counts)}</span>
                    </div>
                    <span className={badgeClass(app.backend.status)}>{displayLabel(app.backend.status)}</span>
                  </button>
                ))}
              </div>
            </article>

            {recentActions.length ? (
              <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Activity</span>
                    <h2>Recent admin actions</h2>
                  </div>
                  <span className="badge badge-info">{dashboard ? formatDate(dashboard.generatedAt) : 'Loading'}</span>
                </div>
                <div className="dashboard-activity-feed">
                  {recentActions.map((item) => (
                    <button className="dashboard-activity-item" type="button" key={item.id} onClick={() => navigate('/admin/audit')}>
                      <div>
                        <strong>{displayLabel(item.actionType)} / {displayLabel(item.entityType)}</strong>
                        <span>{item.summary ?? item.actorUser?.displayName ?? 'Recorded admin action'}</span>
                      </div>
                      <time>{formatDate(item.createdAt)}</time>
                    </button>
                  ))}
                </div>
              </article>
            ) : null}
          </section>
        </div>
      </div>
      <AdminCommandDrawer command={command} onClose={closeCommand} onUndoAvailable={setUndoAction} />
    </AdminShell>
  );
}

function fallbackMetrics(counts: Record<string, number>) {
  return [
    { label: 'Active Tenders', value: counts.activeTenders ?? 0, detail: 'Current database count' },
    { label: 'Pending Compliance Reviews', value: counts.pendingReviews ?? 0, detail: 'Current database count' },
    { label: 'Flagged Issues', value: counts.flaggedIssues ?? 0, detail: 'Current database count' },
    { label: 'Compliance Rate', value: counts.complianceRate ?? 0, detail: 'Percent' },
    { label: 'Evaluation Drafts', value: counts.evaluationDrafts ?? 0, detail: 'Current database count' },
    { label: 'Audit Events Today', value: counts.auditEventsToday ?? 0, detail: 'Current database count' }
  ];
}

function platformStatusRows(counts: Record<string, number>) {
  return [
    { label: 'Active tenders', value: counts.activeTenders ?? counts.tenders ?? 0, route: '/admin/tender-review' },
    { label: 'Pending reviews', value: counts.pendingReviews ?? 0, route: '/admin/audit' },
    { label: 'Flagged issues', value: counts.flaggedIssues ?? 0, route: '/admin/audit' },
    { label: 'Evaluation drafts', value: counts.evaluationDrafts ?? 0, route: '/admin/analytics' },
    { label: 'Audit events today', value: counts.auditEventsToday ?? 0, route: '/admin/audit' }
  ];
}

function appBackendHint(app: AdminApp, counts: Record<string, number>) {
  if (app.route === '/admin') return `${compactNumber(counts.openCases ?? 0)} open cases`;
  if (app.route === '/admin/users') return `${compactNumber(counts.users ?? 0)} users`;
  if (app.route === '/admin/analytics') return `${compactNumber(counts.auditEvents ?? 0)} audit events in analytics`;
  if (app.route === '/admin/audit') return `${compactNumber(counts.auditEvents ?? 0)} audit events`;
  return app.backend.endpoint;
}
