/* Renders the workspace Dashboard Command Center UI while keeping page-specific presentation near its workflow data. */
import { Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/app/store';
import { StatusBadge } from '@/shared/components';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat';

export function DashboardCommandCenter() {
  const { t } = useTranslation();
  const format = useLocaleFormat();
  const user = useAppSelector((state) => state.auth.user);
  const workItems = useAppSelector((state) => state.workspace.workItems);
  const tenders = useAppSelector((state) => state.procurement.tenders);
  const bids = useAppSelector((state) => state.bidding.bids);
  const messages = useAppSelector((state) => state.communication.messages);
  const unreadCount = messages.filter((message) => message.status !== 'Read').length;

  const pipeline = [
    { stage: 'Draft', count: tenders.filter((tender) => tender.status === 'DRAFT').length, nav: '/procurement/create-tender' },
    { stage: 'Published', count: tenders.filter((tender) => tender.status === 'OPEN' || tender.status === 'PUBLISHED').length, nav: '/procurement/marketplace' },
    { stage: 'Evaluation', count: tenders.filter((tender) => tender.status === 'EVALUATION').length, nav: '/evaluation' },
    { stage: 'Award', count: tenders.filter((tender) => tender.status === 'AWARDED').length, nav: '/awards-contracts' },
    { stage: 'Contract', count: 0, nav: '/awards-contracts/negotiation' },
    { stage: 'Completed', count: tenders.filter((tender) => tender.status === 'CLOSED').length, nav: '/records' }
  ];

  const summary = [
    ['My tenders', String(tenders.filter((tender) => tender.createdByCurrentUser).length), 'Active tenders created by this account'],
    ['My bids', String(bids.length), 'Bid drafts and submitted opportunities'],
    ['Recorded value', format.money(tenders.reduce((sum, tender) => sum + tender.budget, 0)), 'Sum of active tender budgets'],
    ['Compliance status', 'Clear', 'Items awaiting or returned from compliance review']
  ];

  return (
    <div className="dashboard-command-center">
      <div className="workspace-home">
        <section className="dashboard-welcome-card dashboard-reference-welcome">
          <div className="dashboard-reference-copy">
            <span className="section-kicker">User dashboard</span>
            <h1>Good day! <span>{user?.displayName}</span></h1>
            <p>{user?.email}</p>
            <Button component={Link} to="/procurement/marketplace" variant="contained" className="btn btn-primary">
              {t('actions.browse')}
            </Button>
          </div>
          <div className="dashboard-reference-visual" aria-label="Account overview">
            <div className="dashboard-reference-avatar" aria-hidden="true">
              {(user?.displayName ?? 'U').trim().charAt(0).toUpperCase()}
            </div>
            <article className="dashboard-reference-profile">
              <StatusBadge value={user?.verificationStatus ?? 'PENDING'} />
              <strong>{user?.organization}</strong>
              <p>{user?.capabilities.join(' + ') || 'Platform admin'}</p>
            </article>
            <div className="dashboard-reference-pills" aria-label="Dashboard totals">
              <span>{workItems.length} urgent</span>
              <span>{tenders.length + bids.length} workflows</span>
              <span>{unreadCount} unread</span>
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
            {pipeline.map((stage) => (
              <Button component={Link} to={stage.nav} className="dashboard-pipeline-stage" key={stage.stage}>
                <strong>{stage.count}</strong>
                <span>{stage.stage}</span>
              </Button>
            ))}
          </div>
        </section>

        <section className="analytics-grid dashboard-real-metrics">
          {summary.map(([label, value, note]) => (
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
                <span className="section-kicker">Action Queue</span>
                <h2>Items requiring attention</h2>
              </div>
              <span className="badge badge-info">{workItems.length} active</span>
            </div>
            <div className="dashboard-action-queue">
              {workItems.length ? (
                workItems.map((item) => (
                  <Button component={Link} to={item.nav} className={`dashboard-action-row ${(item.priority ?? '').toLowerCase()}`} key={item.id}>
                    <span className="dashboard-action-count">{item.priority === 'Urgent' ? '!' : '1'}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>
                    <em>{item.priority ?? 'Info'}</em>
                    <b>{item.status}</b>
                  </Button>
                ))
              ) : (
                <div className="scope-empty">No action queue yet. Create a tender or send a message to start real work.</div>
              )}
            </div>
          </div>

          <aside className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Deadline timeline</span>
                <h2>Upcoming dates</h2>
              </div>
            </div>
            <div className="dashboard-deadline-list">
              {tenders.length ? (
                tenders.map((tender) => (
                  <Button component={Link} to="/procurement/supplier-tender-detail" className="dashboard-deadline-item" key={tender.id}>
                    <time>{format.date(tender.closingDate)}</time>
                    <strong>{tender.title}</strong>
                  </Button>
                ))
              ) : (
                <div className="scope-empty">No deadlines yet. Tender closing dates and contract milestones will appear here.</div>
              )}
            </div>
          </aside>
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">My Active Work</span>
              <h2>Continue where you left off</h2>
            </div>
            <div className="inline-actions">
              <Button component={Link} to="/procurement/create-tender" variant="outlined" className="btn btn-secondary">Create Tender</Button>
              <Button component={Link} to="/procurement/marketplace" variant="outlined" className="btn btn-secondary">Find Tenders</Button>
            </div>
          </div>
          <div className="dashboard-active-work-table">
            <div className="dashboard-active-work-head">
              <span>Type</span><span>Item</span><span>Status</span><span>Next action</span><span>Deadline</span>
            </div>
            {workItems.length ? (
              workItems.map((item) => (
                <Button component={Link} to={item.nav} className="dashboard-active-work-row" key={item.id}>
                  <span>Workflow</span>
                  <strong>{item.title}</strong>
                  <em>{item.status}</em>
                  <small>{item.subtitle}</small>
                  <time>{item.priority ?? 'Normal'}</time>
                </Button>
              ))
            ) : (
              <div className="scope-empty">No active work yet. Try another app or create a tender to generate workflow rows.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
