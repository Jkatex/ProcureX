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
  const displayName = user?.displayName || 'ProcureX user';
  const organization = user?.organization || 'Your organization';
  const hasActivity =
    dashboard.summary.workflowCount > 0 ||
    dashboard.summary.urgentCount > 0 ||
    dashboard.summary.unreadMessages > 0 ||
    dashboard.activeWork.length > 0;

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
      try {
        const data = await workspaceDashboardApi.getWorkspaceDashboard({ itemLimit: 8 });
        if (active) setDashboard(data);
      } catch {
        if (active) setDashboard(emptyDashboardData);
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
                <span className="section-kicker">{hasActivity ? 'Live workspace dashboard' : 'First run dashboard'}</span>
                <h1>Welcome, <span>{displayName}</span></h1>
                <p>
                  {hasActivity
                    ? 'Your procurement work, messages, deadlines, and compliance actions are summarized from live ProcureX records.'
                    : 'This dashboard will fill with procurement work, messages, deadlines, and compliance actions as your team starts using ProcureX.'}
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

            <section className="dashboard-panel dashboard-pipeline-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Pipeline overview</span>
                  <h2>Procurement lifecycle status</h2>
                </div>
              </div>
              <div className="dashboard-pipeline">
                {dashboard.pipeline.map((stage) => (
                  <button className="dashboard-pipeline-stage" type="button" key={stage.stage} onClick={() => navigateToRoute(stage.route)}>
                    <strong>{stage.count}</strong>
                    <span>{stage.stage}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="analytics-grid dashboard-real-metrics">
              {dashboard.metrics.map((metric) => (
                <article className="analytics-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.note}</p>
                </article>
              ))}
            </section>

            <section className="dashboard-grid-main">
              <div className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Action queue</span>
                    <h2>Items requiring attention</h2>
                  </div>
                  <span className="badge badge-info">{dashboard.actionQueue.length} active</span>
                </div>
                <div className="dashboard-action-queue">
                  {dashboard.actionQueue.length ? (
                    dashboard.actionQueue.map((item) => (
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
                    ))
                  ) : (
                    <div className="scope-empty">No action queue yet. Create a tender or send a message to start real work.</div>
                  )}
                </div>
              </div>

              <aside className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">Upcoming dates</span>
                    <h2>Deadline timeline</h2>
                  </div>
                </div>
                <div className="dashboard-deadline-list">
                  {dashboard.deadlines.length ? (
                    dashboard.deadlines.map((deadline) => (
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
                    ))
                  ) : (
                    <div className="procurex-empty-guidance compact">
                      <div>
                        <strong>No deadlines yet.</strong>
                        <span>Planning dates, tender closing dates, and contract milestones will appear here once created.</span>
                      </div>
                      <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('tender-planning')}>
                        Add Plan Dates
                      </button>
                    </div>
                  )}
                </div>
              </aside>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">My active work</span>
                  <h2>Continue where you left off</h2>
                </div>
              </div>
              <div className="dashboard-active-work-table">
                <div className="dashboard-active-work-head">
                  <span>Type</span><span>Item</span><span>Status</span><span>Next action</span><span>Deadline</span>
                </div>
                {dashboard.activeWork.length ? (
                  dashboard.activeWork.map((item) => (
                    <button className="dashboard-active-work-row" type="button" key={item.id} onClick={() => navigateToRoute(item.route)}>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <em>{item.status}</em>
                      <small>{item.nextAction}</small>
                      <time>{item.deadline ? formatDate(item.deadline) : item.priority}</time>
                    </button>
                  ))
                ) : (
                  <div className="scope-empty">No active work yet. Try another app or create a tender to generate workflow rows.</div>
                )}
              </div>
            </section>

            <section className="dashboard-grid-main">
              <div className="dashboard-panel">
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
              </div>

              <aside className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">More ProcureX apps</span>
                    <h2>Try other apps</h2>
                  </div>
                </div>
                <div className="dashboard-first-run-actions">
                  {otherAppActions.slice(0, 3).map((action) => (
                    <button className="dashboard-first-run-action" type="button" key={action.page} onClick={() => navigateToPage(action.page)}>
                      <AppMenuIcon kind={action.icon} />
                      <span>
                        <strong>{action.title}</strong>
                        <em>{action.description}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">More ProcureX apps</span>
                  <h2>All workspace apps</h2>
                </div>
              </div>
              <div className="dashboard-first-run-actions">
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
            </section>
          </div>
        </main>
      </div>
    </>
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
