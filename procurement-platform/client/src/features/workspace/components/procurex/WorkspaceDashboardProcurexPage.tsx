/* Renders the workspace Workspace Dashboard ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { workspaceDashboardApi } from '@/features/workspace/api';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat';
import type { DashboardPriority, WorkspaceDashboardData } from '@/features/workspace/types';
import { AppMenuIcon, platformAppItems } from '@/shared/components/procurex/PlatformAppsDrawer';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';

const pageToRoute: Record<string, string> = {
  'account-profile': '/identity/profile',
  marketplace: '/procurement/marketplace',
  'communication-center': '/communication',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'records-history': '/records',
  'create-tender': '/procurement/create-tender',
  'workspace-dashboard': '/dashboard',
  'sign-in': '/sign-in'
};

const emptyDashboardData: WorkspaceDashboardData = {
  summary: {
    urgentCount: 0,
    workflowCount: 0,
    unreadMessages: 0,
    myTenders: 0,
    myBids: 0,
    recordedValue: 0,
    currency: 'TZS',
    complianceStatus: 'Clear'
  },
  executive: {
    transactionValue: 0,
    completedOrders: 0,
    activeOrders: 0,
    orderSuccessRate: 0,
    transactionGrowthRate: 0,
    averageOrderValue: 0,
    currency: 'TZS'
  },
  pipeline: [
    { stage: 'Draft', count: 0, route: '/procurement/create-tender' },
    { stage: 'Published', count: 0, route: '/procurement/marketplace' },
    { stage: 'Evaluation', count: 0, route: '/evaluation' },
    { stage: 'Award', count: 0, route: '/awards-contracts' },
    { stage: 'Contract', count: 0, route: '/awards-contracts/negotiation' },
    { stage: 'Completed', count: 0, route: '/records' }
  ],
  metrics: [
    { label: 'My tenders', value: '0', note: 'Tenders you create will be counted here.' },
    { label: 'My bids', value: '0', note: 'Bid drafts and submissions will appear after activity starts.' },
    { label: 'Recorded value', value: 'TZS 0', note: 'Procurement value is calculated from real plan and tender records.' },
    { label: 'Unread messages', value: '0', note: 'New platform communication will be surfaced here.' }
  ],
  actionQueue: [],
  deadlines: [],
  activeWork: [],
  generatedAt: new Date(0).toISOString()
};

const startActions = [
  {
    page: 'communication-center',
    icon: 'communication',
    titleKey: 'workspaceDashboard.startActions.message.title',
    descriptionKey: 'workspaceDashboard.startActions.message.description'
  },
  {
    page: 'create-tender',
    icon: 'procurement',
    titleKey: 'workspaceDashboard.startActions.tender.title',
    descriptionKey: 'workspaceDashboard.startActions.tender.description'
  }
] as const;

const otherAppActions = [
  {
    page: 'communication-center',
    icon: 'communication',
    titleKey: 'workspaceDashboard.otherActions.createMessage.title',
    descriptionKey: 'workspaceDashboard.otherActions.createMessage.description'
  },
  {
    page: 'create-tender',
    icon: 'procurement',
    titleKey: 'workspaceDashboard.otherActions.createTender.title',
    descriptionKey: 'workspaceDashboard.otherActions.createTender.description'
  },
  {
    page: 'marketplace',
    icon: 'procurement',
    titleKey: 'workspaceDashboard.otherActions.viewMarketplace.title',
    descriptionKey: 'workspaceDashboard.otherActions.viewMarketplace.description'
  },
  {
    page: 'bid-evaluation',
    icon: 'evaluation',
    titleKey: 'workspaceDashboard.otherActions.evaluateBids.title',
    descriptionKey: 'workspaceDashboard.otherActions.evaluateBids.description'
  },
  {
    page: 'records-history',
    icon: 'records',
    titleKey: 'workspaceDashboard.otherActions.records.title',
    descriptionKey: 'workspaceDashboard.otherActions.records.description'
  }
] as const;

export function WorkspaceDashboardProcurexPage() {
  const { t } = useTranslation();
  const format = useLocaleFormat();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [dashboard, setDashboard] = useState<WorkspaceDashboardData>(emptyDashboardData);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const displayName = user?.displayName || 'ProcureX user';
  const organization = user?.organization || 'Your organization';
  const hasActivity = dashboardHasActivity(dashboard);
  const showFirstRunSections = dashboardLoaded && !hasActivity;
  const executiveKpis = buildExecutiveKpis(dashboard);

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = 'workspace-dashboard';
    document.body.dataset.procurexReactPage = 'true';

    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
      delete document.body.dataset.procurexReactPage;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setDashboardLoaded(false);
      try {
        const data = await workspaceDashboardApi.getWorkspaceDashboard({ itemLimit: 8 });
        if (active) setDashboard(data);
      } catch {
        if (active) setDashboard(emptyDashboardData);
      } finally {
        if (active) setDashboardLoaded(true);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey] || '/dashboard');
  }

  function navigateToRoute(route: string) {
    navigate(route || '/dashboard');
  }

  return (
    <>
      <WorkspaceTopBar title={t('pages.dashboard.title')} onNavigate={navigateToPage} />
      <div className="main-layout dashboard-command-center dashboard-first-run-page">
        <aside className="sidebar dashboard-sidebar">
          <div className="sidebar-heading">
            <h3>{t('nav.dashboard')}</h3>
            <div>{organization}</div>
          </div>
          <ul className="sidebar-nav">
            <li><button type="button" className="active" onClick={() => navigateToPage('workspace-dashboard')}>{t('nav.dashboard')}</button></li>
            <li><button type="button" onClick={() => navigateToPage('communication-center')}>{t('nav.communication')}</button></li>
            <li><button type="button" onClick={() => navigateToPage('create-tender')}>{t('pages.createTender.title')}</button></li>
            <li><button type="button" onClick={() => navigateToPage('marketplace')}>{t('nav.marketplace')}</button></li>
            <li><button type="button" onClick={() => navigateToPage('records-history')}>{t('nav.records')}</button></li>
          </ul>
        </aside>

        <main className="main-content">
          <div className="workspace-home">
            <section className="dashboard-welcome-card dashboard-reference-welcome dashboard-first-run-hero">
              <div className="dashboard-reference-copy">
                <span className="section-kicker">{hasActivity ? t('workspaceDashboard.hero.liveKicker') : t('workspaceDashboard.hero.firstRunKicker')}</span>
                <h1>{t('workspaceDashboard.hero.welcome')} <span>{displayName}</span></h1>
                <p>
                  {!dashboardLoaded
                    ? 'Loading your procurement work, messages, deadlines, and compliance actions from live ProcureX records.'
                    : hasActivity
                      ? 'Your procurement work, messages, deadlines, and compliance actions are summarized from live ProcureX records.'
                      : 'This dashboard will fill with procurement work, messages, deadlines, and compliance actions as your team starts using ProcureX.'}
                </p>
                <div className="inline-actions dashboard-welcome-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigateToPage('marketplace')}>
                    {t('workspaceDashboard.actions.viewMarketplace')}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('create-tender')}>
                    {t('workspaceDashboard.actions.createTender')}
                  </button>
                </div>
              </div>
              <div className="dashboard-reference-visual" aria-label={t('workspaceDashboard.accountOverview')}>
                <div className="dashboard-reference-avatar" aria-hidden="true">
                  {displayName.trim().charAt(0).toUpperCase()}
                </div>
                <article className="dashboard-reference-profile">
                  <span className={dashboard.summary.urgentCount ? 'badge badge-warning' : 'badge badge-info'}>
                    {dashboard.summary.urgentCount ? t('workspaceDashboard.counts.urgent', { count: dashboard.summary.urgentCount }) : t('workspaceDashboard.noUrgentActivity')}
                  </span>
                  <strong>{organization}</strong>
                  <p>{dashboard.summary.complianceStatus === 'Clear' ? t('workspaceDashboard.complianceClear') : t('workspaceDashboard.complianceNeeded')}</p>
                </article>
                <div className="dashboard-reference-pills" aria-label={t('workspaceDashboard.dashboardTotals')}>
                  <span>{t('workspaceDashboard.counts.urgent', { count: dashboard.summary.urgentCount })}</span>
                  <span>{t('workspaceDashboard.counts.workflows', { count: dashboard.summary.workflowCount })}</span>
                  <span>{t('workspaceDashboard.counts.unread', { count: dashboard.summary.unreadMessages })}</span>
                </div>
              </div>
            </section>

            {!showFirstRunSections ? (
              <>
                <section className="dashboard-panel dashboard-pipeline-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">{t('workspaceDashboard.pipeline.kicker')}</span>
                      <h2>{t('workspaceDashboard.pipeline.title')}</h2>
                    </div>
                  </div>
                  <div className="dashboard-pipeline">
                    {dashboard.pipeline.map((stage) => (
                      <button className="dashboard-pipeline-stage" type="button" key={stage.stage} onClick={() => navigateToRoute(stage.route)}>
                        <strong>{stage.count}</strong>
                        <span>{translatePipelineStage(stage.stage, t)}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="analytics-grid dashboard-real-metrics">
                  {dashboard.metrics.map((metric) => (
                    <article className="analytics-card" key={metric.label}>
                      <span>{translateMetricLabel(metric.label, t)}</span>
                      <strong>{metric.value}</strong>
                      <p>{translateMetricNote(metric.note, t)}</p>
                    </article>
                  ))}
                </section>
              </>
            ) : null}
            {!dashboardLoaded ? (
              <section className="dashboard-intelligence-grid">
                <div className="dashboard-intelligence-panel dashboard-intelligence-panel-compact dashboard-intelligence-panel-wide">
                  <span className="section-kicker">Loading</span>
                  <h2>Preparing dashboard intelligence</h2>
                  <p>ProcureX is gathering your latest actions, procurement status, messages, and deadlines.</p>
                </div>
              </section>
            ) : showFirstRunSections ? (
              <>
                <section className="dashboard-intelligence-grid dashboard-first-run-grid">
                  <article className="dashboard-intelligence-panel dashboard-first-run-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">Start here</span>
                        <h2>Recommended first actions</h2>
                      </div>
                      <span className="badge badge-info">Guided setup</span>
                    </div>
                    <div className="dashboard-first-run-actions">
                      {startActions.map((action) => (
                        <button className="dashboard-first-run-action" type="button" key={action.page} onClick={() => navigateToPage(action.page)}>
                          <AppMenuIcon kind={action.icon} />
                          <span>
                            <strong>{t(action.titleKey)}</strong>
                            <em>{t(action.descriptionKey)}</em>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="dashboard-intelligence-panel dashboard-first-run-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">More ProcureX apps</span>
                        <h2>Workspace apps</h2>
                      </div>
                    </div>
                    <div className="dashboard-app-grid" aria-label="Workspace app shortcuts">
                      {platformAppItems.map((app) => (
                        <button className="dashboard-app-card" type="button" key={app.page} onClick={() => navigateToPage(app.page)}>
                          <AppMenuIcon kind={app.icon} />
                          <strong>{t(app.titleKey)}</strong>
                          <em>{t(app.descriptionKey)}</em>
                        </button>
                      ))}
                    </div>
                  </article>
                </section>
              </>
            ) : (
              <>
            <section className="dashboard-intelligence-grid">
                  {dashboard.actionQueue.length ? (
                    <article className="dashboard-intelligence-panel dashboard-intelligence-panel-critical dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Action required</span>
                          <h2>Needs your attention</h2>
                        </div>
                        <span className="badge badge-warning">{dashboard.actionQueue.length} active</span>
                      </div>
                      <div className="dashboard-action-queue">
                        {dashboard.actionQueue.map((item) => (
                          <button
                            className={`dashboard-action-row ${priorityClass(item.priority)}`}
                            type="button"
                            key={item.id}
                            onClick={() => navigateToRoute(item.route)}
                          >
                            <span className="dashboard-action-count">{item.priority === 'Urgent' ? '!' : '1'}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <span>{item.subtitle}</span>
                            </div>
                            <em>{item.priority}</em>
                            <b>{item.status}</b>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  <article className="dashboard-intelligence-panel dashboard-status-overview dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">Executive KPIs</span>
                        <h2>Executive KPI Snapshot</h2>
                      </div>
                    </div>
                    <div className="dashboard-executive-kpi-grid">
                      {executiveKpis.map((kpi) => (
                        <article className="dashboard-executive-kpi" key={kpi.label}>
                          <span>{kpi.label}</span>
                          <strong>{kpi.value}</strong>
                          <p>{kpi.note}</p>
                        </article>
                      ))}
                    </div>
                  </article>

                  {dashboard.deadlines.length ? (
                    <article className="dashboard-intelligence-panel dashboard-intelligence-panel-compact dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Upcoming dates</span>
                          <h2>Deadline timeline</h2>
                        </div>
                      </div>
                      <div className="dashboard-deadline-list">
                        {dashboard.deadlines.map((deadline) => (
                          <button
                            className="dashboard-deadline-item"
                            type="button"
                            key={deadline.id}
                            onClick={() => navigateToRoute(deadline.route)}
                          >
                            <time>{format.date(deadline.date)}</time>
                            <strong>{deadline.title}</strong>
                            <span>{deadline.kind}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">{t('workspaceDashboard.activeWork.kicker')}</span>
                  <h2>{t('workspaceDashboard.activeWork.title')}</h2>
                </div>
              </div>
              <div className="dashboard-active-work-table">
                <div className="dashboard-active-work-head">
                  <span>{t('workspaceDashboard.activeWork.type')}</span><span>{t('workspaceDashboard.activeWork.item')}</span><span>{t('common.status')}</span><span>{t('workspaceDashboard.activeWork.nextAction')}</span><span>{t('workspaceDashboard.activeWork.deadline')}</span>
                </div>
                {dashboard.activeWork.length ? (
                  dashboard.activeWork.map((item) => (
                    <button className="dashboard-active-work-row" type="button" key={item.id} onClick={() => navigateToRoute(item.route)}>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <em>{item.status}</em>
                      <small>{item.nextAction}</small>
                      <time>{item.deadline ? format.date(item.deadline) : item.priority}</time>
                    </button>
                  ))
                ) : (
                  <div className="scope-empty">{t('workspaceDashboard.activeWork.empty')}</div>
                )}
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">{t('workspaceDashboard.moreApps')}</span>
                  <h2>{t('workspaceDashboard.allWorkspaceApps')}</h2>
                </div>
              </div>
              <div className="dashboard-first-run-actions">
                {otherAppActions.map((action) => (
                  <button className="dashboard-first-run-action" type="button" key={action.page} onClick={() => navigateToPage(action.page)}>
                    <AppMenuIcon kind={action.icon} />
                    <span>
                      <strong>{t(action.titleKey)}</strong>
                      <em>{t(action.descriptionKey)}</em>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function buildExecutiveKpis(dashboard: WorkspaceDashboardData) {
  const executive = dashboard.executive ?? deriveExecutiveKpis(dashboard);
  return [
    {
      label: 'Transaction value',
      value: formatCurrency(executive.transactionValue, executive.currency),
      note: 'Purchase order value, with recorded procurement value used until orders exist.'
    },
    {
      label: 'Completed orders',
      value: String(executive.completedOrders),
      note: 'Closed tenders and completed contracts.'
    },
    {
      label: 'Order success rate',
      value: formatPercent(executive.orderSuccessRate),
      note: 'Completed orders as a share of tracked order flow.'
    },
    {
      label: 'Transaction growth',
      value: formatSignedPercent(executive.transactionGrowthRate),
      note: 'Current month compared with the previous month.'
    },
    {
      label: 'Average order value',
      value: formatCurrency(executive.averageOrderValue, executive.currency),
      note: 'Average value across tracked orders.'
    },
    {
      label: 'Active orders',
      value: String(executive.activeOrders),
      note: 'Orders, tenders, and contracts still in progress.'
    }
  ];
}

function deriveExecutiveKpis(dashboard: WorkspaceDashboardData) {
  const completedOrders = dashboard.pipeline.find((stage) => stage.stage.toLowerCase() === 'completed')?.count ?? 0;
  const activeOrders = dashboard.pipeline
    .filter((stage) => stage.stage.toLowerCase() !== 'completed')
    .reduce((sum, stage) => sum + stage.count, 0);
  const orderBase = completedOrders + activeOrders;

  return {
    transactionValue: dashboard.summary.recordedValue,
    completedOrders,
    activeOrders,
    orderSuccessRate: orderBase > 0 ? (completedOrders / orderBase) * 100 : 0,
    transactionGrowthRate: 0,
    averageOrderValue: orderBase > 0 ? dashboard.summary.recordedValue / orderBase : 0,
    currency: dashboard.summary.currency
  };
}

function dashboardHasActivity(dashboard: WorkspaceDashboardData) {
  return (
    dashboard.summary.workflowCount > 0 ||
    dashboard.summary.urgentCount > 0 ||
    dashboard.summary.unreadMessages > 0 ||
    dashboard.summary.myTenders > 0 ||
    dashboard.summary.myBids > 0 ||
    dashboard.summary.recordedValue > 0 ||
    dashboard.pipeline.some((stage) => stage.count > 0) ||
    dashboard.actionQueue.length > 0 ||
    dashboard.deadlines.length > 0 ||
    dashboard.activeWork.length > 0
  );
}

function priorityClass(priority: DashboardPriority) {
  return priority.toLowerCase();
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const pipelineStageKeys: Record<string, string> = {
  Draft: 'workspaceDashboard.pipeline.stages.draft',
  Published: 'workspaceDashboard.pipeline.stages.published',
  Evaluation: 'workspaceDashboard.pipeline.stages.evaluation',
  Award: 'workspaceDashboard.pipeline.stages.award',
  Contract: 'workspaceDashboard.pipeline.stages.contract',
  Completed: 'workspaceDashboard.pipeline.stages.completed'
};

const metricLabelKeys: Record<string, string> = {
  'My tenders': 'workspaceDashboard.metrics.myTenders',
  'My bids': 'workspaceDashboard.metrics.myBids',
  'Recorded value': 'workspaceDashboard.metrics.recordedValue',
  'Unread messages': 'workspaceDashboard.metrics.unreadMessages'
};

const metricNoteKeys: Record<string, string> = {
  'Tenders you create will be counted here.': 'workspaceDashboard.metricNotes.myTenders',
  'Bid drafts and submissions will appear after activity starts.': 'workspaceDashboard.metricNotes.myBids',
  'Procurement value is calculated from real plan and tender records.': 'workspaceDashboard.metricNotes.recordedValue',
  'New platform communication will be surfaced here.': 'workspaceDashboard.metricNotes.unreadMessages'
};

function translatePipelineStage(value: string, t: Translate) {
  return pipelineStageKeys[value] ? t(pipelineStageKeys[value]) : value;
}

function translateMetricLabel(value: string, t: Translate) {
  return metricLabelKeys[value] ? t(metricLabelKeys[value]) : value;
}

function translateMetricNote(value: string, t: Translate) {
  return metricNoteKeys[value] ? t(metricNoteKeys[value]) : value;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-US')}`;
  }
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}%`;
  return `${rounded}%`;
}
