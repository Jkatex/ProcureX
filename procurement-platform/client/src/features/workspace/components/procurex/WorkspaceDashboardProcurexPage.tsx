import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/features/tenderPlanning/components/procurex/icons';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';

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

export function WorkspaceDashboardProcurexPage() {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const displayName = user?.displayName || 'ProcureX user';
  const organization = user?.organization || 'Your organization';

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

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey] || '/dashboard');
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
                <span className="section-kicker">First run dashboard</span>
                <h1>Welcome, <span>{displayName}</span></h1>
                <p>
                  This dashboard will fill with procurement work, messages, deadlines, and compliance actions as your team
                  starts using ProcureX.
                </p>
                <div className="inline-actions dashboard-welcome-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigateToPage('tender-planning')}>
                    Start Planning
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('communication-center')}>
                    Open Messages
                  </button>
                </div>
              </div>
              <div className="dashboard-reference-visual" aria-label="Account overview">
                <div className="dashboard-reference-avatar" aria-hidden="true">
                  {displayName.trim().charAt(0).toUpperCase()}
                </div>
                <article className="dashboard-reference-profile">
                  <span className="badge badge-info">No activity yet</span>
                  <strong>{organization}</strong>
                  <p>Your procurement activity will appear after you create or receive work.</p>
                </article>
                <div className="dashboard-reference-pills" aria-label="Dashboard totals">
                  <span>0 urgent</span>
                  <span>0 workflows</span>
                  <span>0 unread</span>
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
                {['Draft', 'Published', 'Evaluation', 'Award', 'Contract', 'Completed'].map((stage) => (
                  <button className="dashboard-pipeline-stage" type="button" key={stage}>
                    <strong>0</strong>
                    <span>{stage}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="analytics-grid dashboard-real-metrics">
              {[
                ['My tenders', '0', 'Tenders you create will be counted here.'],
                ['My bids', '0', 'Bid drafts and submissions will appear after activity starts.'],
                ['Recorded value', 'TZS 0', 'Procurement value is calculated from real plan and tender records.'],
                ['Unread messages', '0', 'New platform communication will be surfaced here.']
              ].map(([label, value, note]) => (
                <article className="analytics-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <p>{note}</p>
                </article>
              ))}
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
                    <span className="section-kicker">Upcoming dates</span>
                    <h2>Deadline timeline</h2>
                  </div>
                </div>
                <div className="procurex-empty-guidance compact">
                  <div>
                    <strong>No deadlines yet.</strong>
                    <span>Planning dates, tender closing dates, and contract milestones will appear here once created.</span>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('tender-planning')}>
                    Add Plan Dates
                  </button>
                </div>
              </aside>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">My Active Work</span>
                  <h2>Continue where you left off</h2>
                </div>
              </div>
              <div className="procurex-empty-guidance dashboard-active-empty">
                <div>
                  <span className="section-kicker">No active work yet</span>
                  <h2>Your work queue is ready for real activity.</h2>
                  <p>
                    When you create a plan, submit a tender, receive a message, or move into evaluation, the next action
                    will appear here instead of demo records.
                  </p>
                </div>
                <div className="procurex-empty-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigateToPage('tender-planning')}>
                    Create Plan
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('communication-center')}>
                    Create Message
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
