import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/store';
import { AppMenuIcon } from '@/features/tenderPlanning/components/procurex/icons';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { workspaceDashboardApi } from '@/features/workspace/api';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat';
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
    titleKey: 'workspaceDashboard.startActions.plan.title',
    descriptionKey: 'workspaceDashboard.startActions.plan.description'
  },
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
    page: 'tender-planning',
    icon: 'planning',
    titleKey: 'workspaceDashboard.otherActions.createPlan.title',
    descriptionKey: 'workspaceDashboard.otherActions.createPlan.description'
  },
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
  const displayName = user?.displayName || t('accountMenu.procurexUser');
  const organization = user?.organization || t('workspaceDashboard.yourOrganization');
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
      <PlanningTopBar title={t('pages.dashboard.title')} onNavigate={navigateToPage} />
      <div className="main-layout dashboard-command-center dashboard-first-run-page">
        <aside className="sidebar dashboard-sidebar">
          <div className="sidebar-heading">
            <h3>{t('nav.dashboard')}</h3>
            <div>{organization}</div>
          </div>
          <ul className="sidebar-nav">
            <li><button type="button" className="active" onClick={() => navigateToPage('workspace-dashboard')}>{t('nav.dashboard')}</button></li>
            <li><button type="button" onClick={() => navigateToPage('tender-planning')}>{t('platformApps.items.tenderPlanning.title')}</button></li>
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
                  {hasActivity
                    ? t('workspaceDashboard.hero.liveBody')
                    : t('workspaceDashboard.hero.firstRunBody')}
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

            <section className="dashboard-grid-main">
              <div className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('workspaceDashboard.queue.kicker')}</span>
                    <h2>{t('workspaceDashboard.queue.title')}</h2>
                  </div>
                  <span className="badge badge-info">{t('workspaceDashboard.counts.active', { count: dashboard.actionQueue.length })}</span>
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
                    <div className="scope-empty">{t('workspaceDashboard.queue.empty')}</div>
                  )}
                </div>
              </div>

              <aside className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('workspaceDashboard.deadlines.kicker')}</span>
                    <h2>{t('workspaceDashboard.deadlines.title')}</h2>
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
                        <time>{format.date(deadline.date)}</time>
                        <strong>{deadline.title}</strong>
                        <span>{deadline.kind}</span>
                      </button>
                    ))
                  ) : (
                    <div className="procurex-empty-guidance compact">
                      <div>
                        <strong>{t('workspaceDashboard.deadlines.emptyTitle')}</strong>
                        <span>{t('workspaceDashboard.deadlines.emptyBody')}</span>
                      </div>
                      <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('tender-planning')}>
                        {t('workspaceDashboard.deadlines.addPlanDates')}
                      </button>
                    </div>
                  )}
                </div>
              </aside>
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

            <section className="dashboard-grid-main">
              <div className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('workspaceDashboard.startHere')}</span>
                    <h2>{t('workspaceDashboard.recommendedFirstActions')}</h2>
                  </div>
                  <span className="badge badge-info">{t('workspaceDashboard.guidedSetup')}</span>
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
              </div>

              <aside className="dashboard-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">{t('workspaceDashboard.moreApps')}</span>
                    <h2>{t('workspaceDashboard.tryOtherApps')}</h2>
                  </div>
                </div>
                <div className="dashboard-first-run-actions">
                  {otherAppActions.slice(0, 3).map((action) => (
                    <button className="dashboard-first-run-action" type="button" key={action.page} onClick={() => navigateToPage(action.page)}>
                      <AppMenuIcon kind={action.icon} />
                      <span>
                        <strong>{t(action.titleKey)}</strong>
                        <em>{t(action.descriptionKey)}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
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
          </div>
        </main>
      </div>
    </>
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
