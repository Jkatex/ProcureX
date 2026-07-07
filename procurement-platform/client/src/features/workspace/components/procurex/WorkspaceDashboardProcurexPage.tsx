import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/features/tenderPlanning/components/procurex/icons';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { workspaceDashboardApi } from '@/features/workspace/api';
import type { DashboardPriority, WorkspaceDashboardData } from '@/features/workspace/types';

const pageToRoute: Record<string, string> = {
  'account-profile': '/identity/profile',
  'tender-planning': '/tender-planning',
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
    page: 'tender-planning',
    icon: 'planning',
    title: 'Create your first procurement plan',
    description: 'Set up the annual plan before tenders move into publication.'
  },
  {
    page: 'communication-center',
    icon: 'communication',
    title: 'Send your first platform message',
    description: 'Use the mailbox for procurement questions, clarifications, and notices.'
  },
  {
    page: 'create-tender',
    icon: 'procurement',
    title: 'Prepare a tender workspace',
    description: 'Start a tender when your plan line is ready for drafting.'
  }
] as const;

const otherAppActions = [
  {
    page: 'tender-planning',
    icon: 'planning',
    title: 'Create plan',
    description: 'Build or upload procurement plan lines.'
  },
  {
    page: 'communication-center',
    icon: 'communication',
    title: 'Create message',
    description: 'Open communication, clarifications, and notices.'
  },
  {
    page: 'create-tender',
    icon: 'procurement',
    title: 'Create tender',
    description: 'Prepare a new buyer procurement workspace.'
  },
  {
    page: 'marketplace',
    icon: 'procurement',
    title: 'View marketplace',
    description: 'Browse published procurement opportunities.'
  },
  {
    page: 'bid-evaluation',
    icon: 'evaluation',
    title: 'Evaluate bids',
    description: 'Review supplier submissions and scoring.'
  },
  {
    page: 'records-history',
    icon: 'records',
    title: 'Records and history',
    description: 'Open procurement records and past activity.'
  }
] as const;

export function WorkspaceDashboardProcurexPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [dashboard, setDashboard] = useState<WorkspaceDashboardData>(emptyDashboardData);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const displayName = user?.displayName || 'ProcureX user';
  const organization = user?.organization || 'Your organization';
  const hasActivity = dashboardHasActivity(dashboard);
  const showFirstRunSections = dashboardLoaded && !hasActivity;
  const recentActivity = buildRecentActivity(dashboard).slice(0, 6);
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
      <PlanningTopBar title="Dashboard" onNavigate={navigateToPage} />
      <div className="main-layout dashboard-command-center dashboard-first-run-page">
        <aside className="sidebar dashboard-sidebar">
          <div className="sidebar-heading">
            <h3>Dashboard</h3>
            <div>{organization}</div>
          </div>
          <ul className="sidebar-nav">
            <li><button type="button" className="active" onClick={() => navigateToPage('workspace-dashboard')}>Dashboard</button></li>
            <li><button type="button" onClick={() => navigateToPage('tender-planning')}>Procurement Planning</button></li>
            <li><button type="button" onClick={() => navigateToPage('communication-center')}>Communication Center</button></li>
            <li><button type="button" onClick={() => navigateToPage('create-tender')}>Create Tender</button></li>
            <li><button type="button" onClick={() => navigateToPage('marketplace')}>Marketplace</button></li>
            <li><button type="button" onClick={() => navigateToPage('records-history')}>Records and History</button></li>
          </ul>
        </aside>

        <main className="main-content">
          <div className="workspace-home">
            <section className="dashboard-welcome-card dashboard-reference-welcome dashboard-first-run-hero">
              <div className="dashboard-reference-copy">
                <span className="section-kicker">{!dashboardLoaded ? 'Loading workspace dashboard' : hasActivity ? 'Live workspace dashboard' : 'First run dashboard'}</span>
                <h1>Welcome, <span>{displayName}</span></h1>
                <p>
                  {hasActivity
                    ? 'Your procurement work, messages, deadlines, and compliance actions are summarized from live ProcureX records.'
                    : dashboardLoaded
                      ? 'This dashboard will fill with procurement work, messages, deadlines, and compliance actions as your team starts using ProcureX.'
                      : 'Loading your procurement work, messages, deadlines, and compliance actions from live ProcureX records.'}
                </p>
                <div className="inline-actions dashboard-welcome-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigateToPage('marketplace')}>
                    View marketplace
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('create-tender')}>
                    Create tender
                  </button>
                </div>
              </div>
              <div className="dashboard-reference-visual" aria-label="Account overview">
                <div className="dashboard-reference-avatar" aria-hidden="true">
                  {displayName.trim().charAt(0).toUpperCase()}
                </div>
                <article className="dashboard-reference-profile">
                  <span className={dashboard.summary.urgentCount ? 'badge badge-warning' : 'badge badge-info'}>
                    {dashboard.summary.urgentCount ? `${dashboard.summary.urgentCount} urgent` : 'No urgent activity'}
                  </span>
                  <strong>{organization}</strong>
                  <p>{dashboard.summary.complianceStatus === 'Clear' ? 'Compliance status is clear.' : 'Compliance attention is needed.'}</p>
                </article>
                <div className="dashboard-reference-pills" aria-label="Dashboard totals">
                  <span>{dashboard.summary.urgentCount} urgent</span>
                  <span>{dashboard.summary.workflowCount} workflows</span>
                  <span>{dashboard.summary.unreadMessages} unread</span>
                </div>
              </div>
            </section>

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
                            <strong>{action.title}</strong>
                            <em>{action.description}</em>
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
                    <div className="dashboard-first-run-actions dashboard-first-run-actions-dense">
                      {otherAppActions.map((action) => (
                        <button className="dashboard-first-run-action" type="button" key={action.page} onClick={() => navigateToPage(action.page)}>
                          <AppMenuIcon kind={action.icon} />
                          <span>
                            <strong>{action.title}</strong>
                            <em>{action.description}</em>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                </section>
              </>
            ) : (
              <>
                <section className="dashboard-intelligence-strip">
                  {dashboard.metrics.map((metric) => (
                    <article className="dashboard-intelligence-metric" key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <p>{metric.note}</p>
                    </article>
                  ))}
                </section>

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

                  {recentActivity.length ? (
                    <article className="dashboard-intelligence-panel dashboard-intelligence-panel-wide dashboard-horizontal-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="section-kicker">Recent activity</span>
                          <h2>Latest workspace movement</h2>
                        </div>
                      </div>
                      <div className="dashboard-activity-feed">
                        {recentActivity.map((item) => (
                          <button className="dashboard-activity-item" type="button" key={item.id} onClick={() => navigateToRoute(item.route)}>
                            <div>
                              <strong>{item.title}</strong>
                              <span>{item.subtitle}</span>
                            </div>
                            <time>{item.meta}</time>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : null}

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
                            <time>{formatDate(deadline.date)}</time>
                            <strong>{deadline.title}</strong>
                            <span>{deadline.kind}</span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ) : null}
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

function buildRecentActivity(dashboard: WorkspaceDashboardData) {
  return [
    ...dashboard.actionQueue.map((item) => ({
      id: `action:${item.id}`,
      title: item.title,
      subtitle: `${item.subtitle} / ${item.status}`,
      meta: item.priority,
      route: item.route,
      timestamp: item.createdAt
    })),
    ...dashboard.activeWork.map((item) => ({
      id: `work:${item.id}`,
      title: item.title,
      subtitle: `${item.type} / ${item.nextAction}`,
      meta: item.deadline ? formatDate(item.deadline) : item.priority,
      route: item.route,
      timestamp: item.deadline ?? ''
    })),
    ...dashboard.deadlines.map((item) => ({
      id: `deadline:${item.id}`,
      title: item.title,
      subtitle: item.kind,
      meta: formatDate(item.date),
      route: item.route,
      timestamp: item.date
    }))
  ].sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
