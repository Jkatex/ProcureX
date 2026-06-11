import { Fragment, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import DraftsRoundedIcon from '@mui/icons-material/DraftsRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PriceCheckRoundedIcon from '@mui/icons-material/PriceCheckRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { evaluationApi } from '@/features/evaluation/api';
import { useNotifications } from '@/features/notifications/hooks';
import { NotificationCard } from '@/shared/components/NotificationCard';
import type {
  EvaluationDashboard,
  EvaluationDecisionStatus,
  EvaluationDraft,
  EvaluationRecord,
  EvaluationStatusFilter,
  EvaluationWorkspace,
  EvaluationWorkspaceBid,
  ProcurementTypeFilter,
  ReadyEvaluationTender
} from '@/features/evaluation/types';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

export function BidEvaluationProcurexPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const { notifySuccess } = useNotifications();
  const [dashboard, setDashboard] = useState<EvaluationDashboard>(emptyDashboard);
  const [records, setRecords] = useState<EvaluationRecord[]>([]);
  const [drafts, setDrafts] = useState<EvaluationDraft[]>([]);
  const [readyTenders, setReadyTenders] = useState<ReadyEvaluationTender[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EvaluationStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<ProcurementTypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [workspace, setWorkspace] = useState<EvaluationWorkspace | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<EvaluationWorkspaceTab>('overview');
  const [selectedBidId, setSelectedBidId] = useState('');
  const [expandedBidId, setExpandedBidId] = useState('');
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDraftMap>({});
  const [decisionDrafts, setDecisionDrafts] = useState<DecisionDraftMap>({});
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [markComplete, setMarkComplete] = useState(false);

  useBodyPageMetadata('bid-evaluation');

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language === 'sw' ? 'sw-TZ' : 'en-TZ', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      }),
    [i18n.language]
  );

  const stats = useMemo(
    () => [
      {
        label: t('evaluationApp.stats.publishedTenders'),
        value: dashboard.publishedTenders,
        icon: <FactCheckRoundedIcon fontSize="small" aria-hidden="true" />
      },
      {
        label: t('evaluationApp.stats.readyToEvaluate'),
        value: dashboard.readyToEvaluate,
        icon: <AssignmentTurnedInRoundedIcon fontSize="small" aria-hidden="true" />
      },
      {
        label: t('evaluationApp.stats.draftedEvaluations'),
        value: dashboard.draftedEvaluations,
        icon: <DraftsRoundedIcon fontSize="small" aria-hidden="true" />
      },
      {
        label: t('evaluationApp.stats.lockedUntilClosing'),
        value: dashboard.lockedUntilClosing,
        icon: <LockClockRoundedIcon fontSize="small" aria-hidden="true" />
      }
    ],
    [dashboard, t]
  );

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      setLoading(true);
      setLoadError('');

      try {
        const [dashboardData, draftData, readyData] = await Promise.all([
          evaluationApi.getDashboard(),
          evaluationApi.listDrafts(),
          evaluationApi.listReady()
        ]);

        if (!mounted) return;
        setDashboard(dashboardData);
        setDrafts(draftData.drafts);
        setReadyTenders(readyData.tenders);
      } catch {
        if (!mounted) return;
        setDashboard(emptyDashboard);
        setDrafts([]);
        setReadyTenders([]);
        setLoadError(t('evaluationApp.errors.load'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadOverview();

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      async function loadRecords() {
        setRecordsLoading(true);
        setLoadError('');

        try {
          const data = await evaluationApi.listRecords({
            search,
            status: statusFilter,
            type: typeFilter
          });

          if (!mounted) return;
          setRecords(data.records);
          setTotalRecords(data.totalRecords);
        } catch {
          if (!mounted) return;
          setRecords([]);
          setTotalRecords(0);
          setLoadError(t('evaluationApp.errors.load'));
        } finally {
          if (mounted) setRecordsLoading(false);
        }
      }

      void loadRecords();
    }, 180);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [search, statusFilter, t, typeFilter]);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace() {
      if (!selectedTenderId) {
        setWorkspace(null);
        setSelectedBidId('');
        setExpandedBidId('');
        setScoreDrafts({});
        setDecisionDrafts({});
        setWorkspaceError('');
        return;
      }

      setWorkspaceLoading(true);
      setWorkspaceError('');

      try {
        const data = await evaluationApi.getWorkspace(selectedTenderId);
        if (!mounted) return;
        setWorkspace(data);
        setSelectedBidId((current) => current && data.bids.some((bid) => bid.id === current) ? current : data.bids[0]?.id ?? '');
        setExpandedBidId((current) => current && data.bids.some((bid) => bid.id === current) ? current : '');
        setScoreDrafts(createScoreDrafts(data));
        setDecisionDrafts(createDecisionDrafts(data));
        setMarkComplete(false);
      } catch {
        if (!mounted) return;
        setWorkspace(null);
        setScoreDrafts({});
        setDecisionDrafts({});
        setWorkspaceError(t('evaluationApp.p5.errors.load'));
      } finally {
        if (mounted) setWorkspaceLoading(false);
      }
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [selectedTenderId, t]);

  const scoredBids = useMemo(
    () => (workspace ? buildScoredBids(workspace, scoreDrafts, decisionDrafts) : []),
    [decisionDrafts, scoreDrafts, workspace]
  );

  const selectedBid = scoredBids.find((bid) => bid.id === selectedBidId) ?? scoredBids[0] ?? null;
  const rankings = useMemo(() => buildRankings(scoredBids), [scoredBids]);
  const recommendedBid = scoredBids.find((bid) => bid.decisionStatus === 'RECOMMENDED') ?? null;
  const evaluatedBidCount = scoredBids.filter((bid) => bid.evaluated).length;
  const pendingEvaluationCount = Math.max(0, scoredBids.length - evaluatedBidCount);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey as AppRouteKey] ?? '/dashboard');
  }

  function formatDate(value: string | null) {
    if (!value) return t('evaluationApp.labels.notScheduled');
    return dateFormatter.format(new Date(value));
  }

  function statusLabel(value: string | null) {
    if (!value) return t('evaluationApp.status.NOT_STARTED');
    return t(`evaluationApp.status.${value}`, { defaultValue: humanizeEnum(value) });
  }

  function typeLabel(value: string) {
    return t(`evaluationApp.types.${value}`, { defaultValue: humanizeEnum(value) });
  }

  function stageLabel(value: string | null) {
    if (!value) return t('evaluationApp.labels.notStarted');
    return t(`evaluationApp.stages.${value}`, { defaultValue: humanizeEnum(value) });
  }

  function openWorkspace(tenderId: string) {
    setSelectedTenderId(tenderId);
    setWorkspaceTab('overview');
    window.setTimeout(() => {
      document.querySelector('[data-evaluation-p5-workspace]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function updateScoreDraft(bidId: string, criterionId: string, patch: Partial<ScoreDraft>) {
    setScoreDrafts((current) => ({
      ...current,
      [draftKey(bidId, criterionId)]: {
        ...(current[draftKey(bidId, criterionId)] ?? { score: '', comment: '' }),
        ...patch
      }
    }));
  }

  function updateDecisionDraft(bidId: string, patch: Partial<DecisionDraft>) {
    setDecisionDrafts((current) => ({
      ...current,
      [bidId]: {
        ...(current[bidId] ?? { status: 'PENDING', comment: '' }),
        ...patch
      }
    }));
  }

  async function saveWorkspace() {
    if (!workspace?.tender || workspaceSaving) return;
    const validation = validateScoreDrafts(workspace, scoreDrafts);
    if (validation) {
      setWorkspaceError(validation);
      setWorkspaceTab('technical');
      return;
    }

    setWorkspaceSaving(true);
    setWorkspaceError('');

    try {
      const saved = await evaluationApi.saveWorkspace(workspace.tender.id, {
        scores: Object.entries(scoreDrafts)
          .flatMap(([key, draft]) => {
            const [bidId, criterionId] = key.split(':');
            if (!bidId || !criterionId || draft.score === '') return [];
            return [{ bidId, criterionId, score: Number(draft.score), comment: draft.comment }];
          }),
        decisions: Object.entries(decisionDrafts).map(([bidId, draft]) => ({
          bidId,
          status: draft.status,
          comment: draft.comment
        })),
        complete: markComplete
      });
      setWorkspace(saved);
      setScoreDrafts(createScoreDrafts(saved));
      setDecisionDrafts(createDecisionDrafts(saved));
      setMarkComplete(false);

      const [dashboardData, draftData, readyData, recordData] = await Promise.all([
        evaluationApi.getDashboard(),
        evaluationApi.listDrafts(),
        evaluationApi.listReady(),
        evaluationApi.listRecords({ search, status: statusFilter, type: typeFilter })
      ]);
      setDashboard(dashboardData);
      setDrafts(draftData.drafts);
      setReadyTenders(readyData.tenders);
      setRecords(recordData.records);
      setTotalRecords(recordData.totalRecords);
      notifySuccess(t('evaluationApp.p5.save'), 'Evaluation workspace saved.', {
        reason: markComplete ? 'Scores and decisions were saved and the evaluation was marked complete.' : 'Scores and decisions were saved as evaluation progress.'
      });
    } catch {
      setWorkspaceError(t('evaluationApp.p5.errors.save'));
    } finally {
      setWorkspaceSaving(false);
    }
  }

  return (
    <>
      <PlanningTopBar title={t('evaluationApp.shell.title')} onNavigate={navigateToPage} />
      <div className="main-layout dashboard-command-center evaluation-empty-app">
        <aside className="sidebar dashboard-sidebar evaluation-empty-sidebar">
          <div className="sidebar-heading">
            <h3>{t('evaluationApp.shell.sidebarTitle')}</h3>
            <div>{t('evaluationApp.shell.sidebarNote')}</div>
          </div>
          <ul className="sidebar-nav">
            {appNavItems.map((item) => (
              <li key={item.page}>
                <button
                  type="button"
                  className={item.page === 'bid-evaluation' ? 'active' : ''}
                  onClick={() => navigateToPage(item.page)}
                >
                  {t(item.labelKey)}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          <div className="workspace-home evaluation-empty-workspace">
            <section className="evaluation-empty-hero evaluation-hero-panel">
              <div className="evaluation-empty-hero-copy">
                <span className="section-kicker">{t('evaluationApp.hero.kicker')}</span>
                <h1>{t('evaluationApp.hero.title')}</h1>
                <p>{t('evaluationApp.hero.subtitle')}</p>
                <div className="inline-actions evaluation-empty-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigateToPage('create-tender')}>
                    <AddRoundedIcon fontSize="small" aria-hidden="true" />
                    <span>{t('evaluationApp.actions.createTender')}</span>
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigateToPage('tender-planning')}>
                    <EventNoteRoundedIcon fontSize="small" aria-hidden="true" />
                    <span>{t('evaluationApp.actions.viewTenderPlanning')}</span>
                  </button>
                </div>
              </div>

              <div className="evaluation-empty-stat-grid" aria-label={t('evaluationApp.stats.ariaLabel')}>
                {stats.map((stat) => (
                  <article className="evaluation-empty-stat-card" key={stat.label}>
                    <span className="evaluation-empty-stat-icon">{stat.icon}</span>
                    <strong>{loading ? '0' : stat.value.toLocaleString()}</strong>
                    <span>{stat.label}</span>
                  </article>
                ))}
              </div>
            </section>

            {loadError ? (
              <NotificationCard notification={{ tone: 'error', title: 'Evaluation data could not load', message: loadError, reason: 'The dashboard could not retrieve the evaluation records needed for this view.', action: { label: 'Try again' }, dismissible: false }} />
            ) : null}

            {selectedTenderId || (!loading && readyTenders.length === 0 && records.length === 0 && drafts.length === 0) ? (
              <section className="evaluation-panel evaluation-empty-panel evaluation-p5-workspace" data-evaluation-p5-workspace>
                {workspace && workspace.tender ? (
                  <>
                    <div className="panel-heading evaluation-empty-heading evaluation-p5-heading">
                      <div>
                        <span className="section-kicker">{t('evaluationApp.p5.kicker')}</span>
                        <h2>{workspace.tender.title}</h2>
                        <p>{workspace.tender.reference} / {workspace.tender.buyerName}</p>
                      </div>
                      <div className="inline-actions evaluation-p5-actions">
                        <label className="evaluation-p5-complete">
                          <input type="checkbox" checked={markComplete} onChange={(event) => setMarkComplete(event.target.checked)} />
                          <span>{t('evaluationApp.p5.markComplete')}</span>
                        </label>
                        <button className="btn btn-primary" type="button" disabled={workspaceSaving || workspaceLoading} onClick={() => void saveWorkspace()}>
                          <SaveRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{workspaceSaving ? t('evaluationApp.p5.saving') : t('evaluationApp.p5.save')}</span>
                        </button>
                        <button className="btn btn-secondary" type="button" onClick={() => setSelectedTenderId('')}>
                          {t('evaluationApp.p5.close')}
                        </button>
                      </div>
                    </div>

                    {workspaceError ? (
                      <NotificationCard notification={{ tone: 'error', title: 'Evaluation workspace issue', message: workspaceError, reason: 'Review the current evaluation data and retry the save or load action.', action: { label: 'Try again' }, dismissible: false }} />
                    ) : null}
                    {!workspace.availability.isReady ? <div className="evaluation-p5-note">{workspace.availability.reason}</div> : null}

                    <section className="evaluation-empty-stat-grid evaluation-p5-stat-grid" aria-label={t('evaluationApp.p5.summary')}>
                      <article className="evaluation-empty-stat-card">
                        <span className="evaluation-empty-stat-icon"><FactCheckRoundedIcon fontSize="small" aria-hidden="true" /></span>
                        <strong>{scoredBids.length}</strong>
                        <span>{t('evaluationApp.p5.totalSubmitted')}</span>
                      </article>
                      <article className="evaluation-empty-stat-card">
                        <span className="evaluation-empty-stat-icon"><RuleRoundedIcon fontSize="small" aria-hidden="true" /></span>
                        <strong>{statusLabel(workspace.summary.evaluationStatus)}</strong>
                        <span>{t('evaluationApp.p5.evaluationStatus')}</span>
                      </article>
                      <article className="evaluation-empty-stat-card">
                        <span className="evaluation-empty-stat-icon"><AssignmentTurnedInRoundedIcon fontSize="small" aria-hidden="true" /></span>
                        <strong>{evaluatedBidCount}</strong>
                        <span>{t('evaluationApp.p5.evaluatedBids')}</span>
                      </article>
                      <article className="evaluation-empty-stat-card">
                        <span className="evaluation-empty-stat-icon"><LockClockRoundedIcon fontSize="small" aria-hidden="true" /></span>
                        <strong>{pendingEvaluationCount}</strong>
                        <span>{t('evaluationApp.p5.pendingBids')}</span>
                      </article>
                      <article className="evaluation-empty-stat-card">
                        <span className="evaluation-empty-stat-icon"><LeaderboardRoundedIcon fontSize="small" aria-hidden="true" /></span>
                        <strong>{recommendedBid?.supplierName ?? workspace.summary.recommendedBidder?.supplierName ?? t('evaluationApp.labels.notAvailable')}</strong>
                        <span>{t('evaluationApp.p5.recommendedBidder')}</span>
                      </article>
                    </section>

                    <nav className="evaluation-p5-tabs" aria-label={t('evaluationApp.p5.tabs.ariaLabel')}>
                      {workspaceTabs.map((tab) => (
                        <button
                          className={workspaceTab === tab.id ? 'active' : ''}
                          type="button"
                          key={tab.id}
                          onClick={() => setWorkspaceTab(tab.id)}
                        >
                          {t(tab.labelKey)}
                        </button>
                      ))}
                    </nav>

                    <EvaluationWorkspaceTabPanel
                      activeTab={workspaceTab}
                      workspace={workspace}
                      bids={scoredBids}
                      rankings={rankings}
                      selectedBid={selectedBid}
                      selectedBidId={selectedBidId}
                      expandedBidId={expandedBidId}
                      scoreDrafts={scoreDrafts}
                      decisionDrafts={decisionDrafts}
                      formatDate={formatDate}
                      formatMoney={formatMoney}
                      t={t}
                      onSelectBid={setSelectedBidId}
                      onToggleBid={(bidId) => setExpandedBidId((current) => current === bidId ? '' : bidId)}
                      onScoreChange={updateScoreDraft}
                      onDecisionChange={updateDecisionDraft}
                    />
                  </>
                ) : (
                  <EvaluationEmptyMessage
                    icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />}
                    message={workspaceLoading ? t('evaluationApp.p5.loading') : t('evaluationApp.p5.emptySubmittedBids')}
                  />
                )}
              </section>
            ) : null}

            <section className="evaluation-panel evaluation-empty-panel">
              <div className="panel-heading evaluation-empty-heading">
                <div>
                  <span className="section-kicker">{t('evaluationApp.records.kicker')}</span>
                  <h2>{t('evaluationApp.records.title')}</h2>
                </div>
                <span className="badge badge-info">{t('evaluationApp.records.countBadge', { count: totalRecords })}</span>
              </div>

              <div className="evaluation-empty-filter-grid">
                <label className="evaluation-empty-field evaluation-empty-search">
                  <span>{t('evaluationApp.filters.search')}</span>
                  <span className="evaluation-empty-input-shell">
                    <SearchRoundedIcon fontSize="small" aria-hidden="true" />
                    <input
                      className="form-input"
                      type="search"
                      value={search}
                      placeholder={t('evaluationApp.filters.searchPlaceholder')}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </span>
                </label>
                <label className="evaluation-empty-field">
                  <span>{t('evaluationApp.filters.status')}</span>
                  <select
                    className="form-input"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as EvaluationStatusFilter)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="evaluation-empty-field">
                  <span>{t('evaluationApp.filters.type')}</span>
                  <select
                    className="form-input"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as ProcurementTypeFilter)}
                  >
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {records.length > 0 ? (
                <div className="evaluation-table-scroll evaluation-empty-table" aria-busy={recordsLoading}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t('evaluationApp.table.tender')}</th>
                        <th>{t('evaluationApp.table.type')}</th>
                        <th>{t('evaluationApp.table.status')}</th>
                        <th>{t('evaluationApp.table.stage')}</th>
                        <th>{t('evaluationApp.table.progress')}</th>
                        <th>{t('evaluationApp.table.submittedBids')}</th>
                        <th>{t('evaluationApp.table.updated')}</th>
                        <th>{t('evaluationApp.table.action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <strong>{record.title}</strong>
                            <span>{record.reference}</span>
                          </td>
                          <td>{typeLabel(record.procurementType)}</td>
                          <td><span className="badge badge-info">{statusLabel(record.status)}</span></td>
                          <td>{stageLabel(record.currentStage)}</td>
                          <td>{record.progressPercentage}%</td>
                          <td>{record.submittedBidCount}</td>
                          <td>{formatDate(record.updatedAt)}</td>
                          <td>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => openWorkspace(record.tenderId)}>
                              <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                              <span>{t('evaluationApp.p5.open')}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EvaluationEmptyMessage
                  icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />}
                  message={t('evaluationApp.records.empty')}
                />
              )}
            </section>

            <div className="evaluation-empty-section-grid">
              <section className="evaluation-panel evaluation-empty-panel">
                <div className="panel-heading evaluation-empty-heading">
                  <div>
                    <span className="section-kicker">{t('evaluationApp.drafts.kicker')}</span>
                    <h2>{t('evaluationApp.drafts.title')}</h2>
                  </div>
                  <span className="badge badge-info">{drafts.length}</span>
                </div>

                {drafts.length > 0 ? (
                  <div className="evaluation-empty-card-list">
                    {drafts.map((draft) => (
                      <article className="evaluation-ready-card evaluation-draft-card" key={draft.id}>
                        <span className="badge badge-warning">{t('evaluationApp.status.IN_PROGRESS')}</span>
                        <h3>{draft.title}</h3>
                        <p>{draft.reference}</p>
                        <div className="evaluation-progress-track" aria-label={t('evaluationApp.table.progress')}>
                          <span style={{ width: `${Math.min(100, Math.max(0, draft.progressPercentage))}%` }} />
                        </div>
                        <dl className="evaluation-empty-meta">
                          <div>
                            <dt>{t('evaluationApp.table.stage')}</dt>
                            <dd>{stageLabel(draft.currentStage)}</dd>
                          </div>
                          <div>
                            <dt>{t('evaluationApp.table.submittedBids')}</dt>
                            <dd>{draft.submittedBidCount}</dd>
                          </div>
                          <div>
                            <dt>{t('evaluationApp.table.updated')}</dt>
                            <dd>{formatDate(draft.updatedAt)}</dd>
                          </div>
                        </dl>
                        <button className="btn btn-secondary" type="button" onClick={() => openWorkspace(draft.tenderId)}>
                          <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{t('evaluationApp.p5.open')}</span>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EvaluationEmptyMessage
                    icon={<DraftsRoundedIcon fontSize="small" aria-hidden="true" />}
                    message={t('evaluationApp.drafts.empty')}
                  />
                )}
              </section>

              <section className="evaluation-panel evaluation-empty-panel">
                <div className="panel-heading evaluation-empty-heading">
                  <div>
                    <span className="section-kicker">{t('evaluationApp.ready.kicker')}</span>
                    <h2>{t('evaluationApp.ready.title')}</h2>
                  </div>
                  <span className="badge badge-info">{readyTenders.length}</span>
                </div>

                {readyTenders.length > 0 ? (
                  <div className="evaluation-empty-card-list">
                    {readyTenders.map((tender) => (
                      <article className="evaluation-ready-card" key={tender.tenderId}>
                        <span className="badge badge-success">{t('evaluationApp.ready.readyBadge')}</span>
                        <h3>{tender.title}</h3>
                        <p>{tender.reference}</p>
                        <dl className="evaluation-empty-meta">
                          <div>
                            <dt>{t('evaluationApp.table.type')}</dt>
                            <dd>{typeLabel(tender.procurementType)}</dd>
                          </div>
                          <div>
                            <dt>{t('evaluationApp.table.submittedBids')}</dt>
                            <dd>{tender.submittedBidCount}</dd>
                          </div>
                          <div>
                            <dt>{t('evaluationApp.table.closingDate')}</dt>
                            <dd>{formatDate(tender.closingDate || null)}</dd>
                          </div>
                        </dl>
                        <button className="btn btn-primary" type="button" onClick={() => openWorkspace(tender.tenderId)}>
                          <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{t('evaluationApp.p5.open')}</span>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EvaluationEmptyMessage
                    icon={<AssignmentTurnedInRoundedIcon fontSize="small" aria-hidden="true" />}
                    message={t('evaluationApp.ready.empty')}
                  />
                )}
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

type AppRouteKey =
  | 'workspace-dashboard'
  | 'tender-planning'
  | 'marketplace'
  | 'create-tender'
  | 'bidding-workspace'
  | 'bid-evaluation'
  | 'awarding-contracts'
  | 'records-history'
  | 'communication-center';

type EvaluationWorkspaceTab = 'overview' | 'bid-review' | 'technical' | 'financial' | 'ranking' | 'decision';
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type ScoreDraft = { score: string; comment: string };
type ScoreDraftMap = Record<string, ScoreDraft>;
type DecisionDraft = { status: EvaluationDecisionStatus; comment: string };
type DecisionDraftMap = Record<string, DecisionDraft>;
type EditableEvaluationBid = EvaluationWorkspaceBid;

const pageToRoute: Record<AppRouteKey, string> = {
  'workspace-dashboard': '/dashboard',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'create-tender': '/procurement/create-tender',
  'bidding-workspace': '/bidding',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'records-history': '/records',
  'communication-center': '/communication'
};

const appNavItems: Array<{ labelKey: string; page: AppRouteKey }> = [
  { labelKey: 'nav.dashboard', page: 'workspace-dashboard' },
  { labelKey: 'nav.tenderPlanning', page: 'tender-planning' },
  { labelKey: 'nav.procurement', page: 'marketplace' },
  { labelKey: 'evaluationApp.nav.createTender', page: 'create-tender' },
  { labelKey: 'nav.bidding', page: 'bidding-workspace' },
  { labelKey: 'nav.evaluation', page: 'bid-evaluation' },
  { labelKey: 'nav.awards', page: 'awarding-contracts' },
  { labelKey: 'nav.records', page: 'records-history' },
  { labelKey: 'nav.communication', page: 'communication-center' }
];

const emptyDashboard: EvaluationDashboard = {
  publishedTenders: 0,
  readyToEvaluate: 0,
  draftedEvaluations: 0,
  lockedUntilClosing: 0,
  totalRecords: 0
};

const statusOptions: Array<{ value: EvaluationStatusFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'evaluationApp.filters.allStatuses' },
  { value: 'NOT_STARTED', labelKey: 'evaluationApp.status.NOT_STARTED' },
  { value: 'IN_PROGRESS', labelKey: 'evaluationApp.status.IN_PROGRESS' },
  { value: 'LOCKED', labelKey: 'evaluationApp.status.LOCKED' },
  { value: 'COMPLETED', labelKey: 'evaluationApp.status.COMPLETED' },
  { value: 'RETURNED', labelKey: 'evaluationApp.status.RETURNED' }
];

const typeOptions: Array<{ value: ProcurementTypeFilter; labelKey: string }> = [
  { value: 'all', labelKey: 'evaluationApp.filters.allTypes' },
  { value: 'GOODS', labelKey: 'evaluationApp.types.GOODS' },
  { value: 'WORKS', labelKey: 'evaluationApp.types.WORKS' },
  { value: 'SERVICE', labelKey: 'evaluationApp.types.SERVICE' },
  { value: 'CONSULTANCY', labelKey: 'evaluationApp.types.CONSULTANCY' }
];

const workspaceTabs: Array<{ id: EvaluationWorkspaceTab; labelKey: string }> = [
  { id: 'overview', labelKey: 'evaluationApp.p5.tabs.overview' },
  { id: 'bid-review', labelKey: 'evaluationApp.p5.tabs.bidReview' },
  { id: 'technical', labelKey: 'evaluationApp.p5.tabs.technical' },
  { id: 'financial', labelKey: 'evaluationApp.p5.tabs.financial' },
  { id: 'ranking', labelKey: 'evaluationApp.p5.tabs.ranking' },
  { id: 'decision', labelKey: 'evaluationApp.p5.tabs.decision' }
];

const decisionOptions: EvaluationDecisionStatus[] = ['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED'];

function EvaluationEmptyMessage({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="evaluation-empty-state">
      <span>{icon}</span>
      <p>{message}</p>
    </div>
  );
}

function EvaluationWorkspaceTabPanel({
  activeTab,
  workspace,
  bids,
  rankings,
  selectedBid,
  selectedBidId,
  expandedBidId,
  scoreDrafts,
  decisionDrafts,
  formatDate,
  formatMoney,
  t,
  onSelectBid,
  onToggleBid,
  onScoreChange,
  onDecisionChange
}: {
  activeTab: EvaluationWorkspaceTab;
  workspace: EvaluationWorkspace;
  bids: EditableEvaluationBid[];
  rankings: ReturnType<typeof buildRankings>;
  selectedBid: EditableEvaluationBid | null;
  selectedBidId: string;
  expandedBidId: string;
  scoreDrafts: ScoreDraftMap;
  decisionDrafts: DecisionDraftMap;
  formatDate: (value: string | null) => string;
  formatMoney: (value: number | null, currency: string) => string;
  t: TranslateFn;
  onSelectBid: (bidId: string) => void;
  onToggleBid: (bidId: string) => void;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
}) {
  if (activeTab === 'overview') {
    return (
      <div className="evaluation-p5-tab-panel">
        <section className="evaluation-p5-grid two-col">
          <article className="evaluation-p5-card">
            <h3>{t('evaluationApp.p5.criteriaTitle')}</h3>
            {workspace.criteria.length > 0 ? (
              <div className="evaluation-table-scroll evaluation-empty-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t('evaluationApp.p5.criterion')}</th>
                      <th>{t('evaluationApp.p5.category')}</th>
                      <th>{t('evaluationApp.p5.weight')}</th>
                      <th>{t('evaluationApp.p5.maxScore')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.criteria.map((criterion) => (
                      <tr key={criterion.id}>
                        <td><strong>{criterion.name}</strong></td>
                        <td>{criterion.category}</td>
                        <td>{criterion.weight ?? t('evaluationApp.labels.notAvailable')}</td>
                        <td>{criterion.maxScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptyCriteria')} />
            )}
          </article>

          <article className="evaluation-p5-card">
            <h3>{t('evaluationApp.p5.auditTitle')}</h3>
            <dl className="evaluation-empty-meta">
              <div>
                <dt>{t('evaluationApp.p5.evaluatedBy')}</dt>
                <dd>{workspace.audit.evaluatedBy ?? t('evaluationApp.labels.notAvailable')}</dd>
              </div>
              <div>
                <dt>{t('evaluationApp.p5.lastUpdatedBy')}</dt>
                <dd>{workspace.audit.lastUpdatedBy ?? t('evaluationApp.labels.notAvailable')}</dd>
              </div>
              <div>
                <dt>{t('evaluationApp.p5.lastSaved')}</dt>
                <dd>{formatDate(workspace.summary.lastSavedAt)}</dd>
              </div>
            </dl>
            {workspace.audit.events.length > 0 ? (
              <div className="evaluation-p5-audit-list">
                {workspace.audit.events.map((event) => (
                  <div key={`${event.event}-${event.createdAt}`}>
                    <strong>{humanizeEnum(event.event.replace(/\./g, '_'))}</strong>
                    <span>{event.actorName ?? t('evaluationApp.labels.notAvailable')} / {formatDate(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="evaluation-p5-muted">{t('evaluationApp.p5.emptyAudit')}</p>
            )}
          </article>
        </section>
      </div>
    );
  }

  if (activeTab === 'bid-review') {
    return (
      <div className="evaluation-p5-tab-panel">
        {bids.length > 0 ? (
          <div className="evaluation-table-scroll evaluation-empty-table">
            <table>
              <thead>
                <tr>
                  <th>{t('evaluationApp.p5.bidder')}</th>
                  <th>{t('evaluationApp.table.status')}</th>
                  <th>{t('evaluationApp.p5.documents')}</th>
                  <th>{t('evaluationApp.p5.financialAmount')}</th>
                  <th>{t('evaluationApp.p5.eligibility')}</th>
                  <th>{t('evaluationApp.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid) => (
                  <Fragment key={bid.id}>
                    <tr>
                      <td>
                        <strong>{bid.supplierName}</strong>
                        <span>{bid.reference}</span>
                      </td>
                      <td><span className="badge badge-info">{bid.status}</span></td>
                      <td>{bid.documents.length}</td>
                      <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                      <td>{bid.eligibilityStatus}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onToggleBid(bid.id)}>
                          <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{expandedBidId === bid.id ? t('evaluationApp.p5.hideSubmission') : t('evaluationApp.p5.openSubmission')}</span>
                        </button>
                      </td>
                    </tr>
                    {expandedBidId === bid.id ? (
                      <tr key={`${bid.id}-detail`}>
                        <td colSpan={6}>
                          <BidSubmissionDetail bid={bid} formatMoney={formatMoney} t={t} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptySubmittedBids')} />
        )}
      </div>
    );
  }

  if (activeTab === 'technical') {
    return (
      <div className="evaluation-p5-tab-panel">
        {workspace.criteria.length === 0 ? (
          <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptyCriteria')} />
        ) : selectedBid ? (
          <>
            <BidSelector bids={bids} selectedBidId={selectedBidId} onSelectBid={onSelectBid} />
            <div className="evaluation-table-scroll evaluation-empty-table">
              <table>
                <thead>
                  <tr>
                    <th>{t('evaluationApp.p5.criterion')}</th>
                    <th>{t('evaluationApp.p5.category')}</th>
                    <th>{t('evaluationApp.p5.weight')}</th>
                    <th>{t('evaluationApp.p5.maxScore')}</th>
                    <th>{t('evaluationApp.p5.evaluatorScore')}</th>
                    <th>{t('evaluationApp.p5.comment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.criteria.map((criterion) => {
                    const draft = scoreDrafts[draftKey(selectedBid.id, criterion.id)] ?? { score: '', comment: '' };
                    const exceedsMax = draft.score !== '' && Number(draft.score) > criterion.maxScore;
                    return (
                      <tr key={criterion.id}>
                        <td><strong>{criterion.name}</strong></td>
                        <td>{criterion.category}</td>
                        <td>{criterion.weight ?? t('evaluationApp.labels.notAvailable')}</td>
                        <td>{criterion.maxScore}</td>
                        <td>
                          <input
                            className={`form-input ${exceedsMax ? 'is-invalid' : ''}`}
                            type="number"
                            min="0"
                            max={criterion.maxScore}
                            step="0.01"
                            value={draft.score}
                            onChange={(event) => onScoreChange(selectedBid.id, criterion.id, { score: event.target.value })}
                          />
                          {exceedsMax ? <span className="evaluation-p5-field-error">{t('evaluationApp.p5.errors.scoreMax')}</span> : null}
                        </td>
                        <td>
                          <textarea
                            className="form-input evaluation-p5-comment"
                            value={draft.comment}
                            onChange={(event) => onScoreChange(selectedBid.id, criterion.id, { comment: event.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptySubmittedBids')} />
        )}
      </div>
    );
  }

  if (activeTab === 'financial') {
    const hasAmounts = bids.some((bid) => bid.financialAmount !== null);
    return (
      <div className="evaluation-p5-tab-panel">
        {hasAmounts ? (
          <div className="evaluation-table-scroll evaluation-empty-table">
            <table>
              <thead>
                <tr>
                  <th>{t('evaluationApp.p5.bidder')}</th>
                  <th>{t('evaluationApp.p5.financialAmount')}</th>
                  <th>{t('evaluationApp.p5.financialScore')}</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid) => (
                  <tr key={bid.id}>
                    <td><strong>{bid.supplierName}</strong></td>
                    <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                    <td>{bid.financialScore === null ? t('evaluationApp.labels.notAvailable') : `${bid.financialScore}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EvaluationEmptyMessage icon={<PriceCheckRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptyFinancial')} />
        )}
      </div>
    );
  }

  if (activeTab === 'ranking') {
    return (
      <div className="evaluation-p5-tab-panel">
        {rankings.length > 0 ? (
          <div className="evaluation-table-scroll evaluation-empty-table">
            <table>
              <thead>
                <tr>
                  <th>{t('evaluationApp.p5.rank')}</th>
                  <th>{t('evaluationApp.p5.bidder')}</th>
                  <th>{t('evaluationApp.p5.technicalScore')}</th>
                  <th>{t('evaluationApp.p5.financialScore')}</th>
                  <th>{t('evaluationApp.p5.totalScore')}</th>
                  <th>{t('evaluationApp.p5.decision')}</th>
                  <th>{t('evaluationApp.p5.comment')}</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row) => (
                  <tr key={row.bidId}>
                    <td>{row.rank}</td>
                    <td><strong>{row.bidderName}</strong></td>
                    <td>{row.technicalScore === null ? t('evaluationApp.labels.notAvailable') : `${row.technicalScore}%`}</td>
                    <td>{row.financialScore === null ? t('evaluationApp.labels.notAvailable') : `${row.financialScore}%`}</td>
                    <td>{row.totalScore}%</td>
                    <td><span className="badge badge-info">{decisionLabel(row.decisionStatus, t)}</span></td>
                    <td>{row.commentSummary || t('evaluationApp.labels.notAvailable')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EvaluationEmptyMessage icon={<LeaderboardRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptyRanking')} />
        )}
      </div>
    );
  }

  return (
    <div className="evaluation-p5-tab-panel">
      {bids.length > 0 ? (
        <div className="evaluation-table-scroll evaluation-empty-table">
          <table>
            <thead>
              <tr>
                <th>{t('evaluationApp.p5.bidder')}</th>
                <th>{t('evaluationApp.p5.evaluated')}</th>
                <th>{t('evaluationApp.p5.totalScore')}</th>
                <th>{t('evaluationApp.p5.decision')}</th>
                <th>{t('evaluationApp.p5.comment')}</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => {
                const draft = decisionDrafts[bid.id] ?? { status: 'PENDING', comment: '' };
                return (
                  <tr key={bid.id}>
                    <td><strong>{bid.supplierName}</strong></td>
                    <td>{bid.evaluated ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</td>
                    <td>{bid.totalScore === null ? t('evaluationApp.labels.notAvailable') : `${bid.totalScore}%`}</td>
                    <td>
                      <select
                        className="form-input"
                        value={draft.status}
                        onChange={(event) => onDecisionChange(bid.id, { status: event.target.value as EvaluationDecisionStatus })}
                      >
                        {decisionOptions.map((option) => (
                          <option key={option} value={option} disabled={option === 'RECOMMENDED' && !bid.evaluated}>
                            {decisionLabel(option, t)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <textarea
                        className="form-input evaluation-p5-comment"
                        value={draft.comment}
                        onChange={(event) => onDecisionChange(bid.id, { comment: event.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message={t('evaluationApp.p5.emptySubmittedBids')} />
      )}
    </div>
  );
}

function BidSubmissionDetail({ bid, formatMoney, t }: { bid: EditableEvaluationBid; formatMoney: (value: number | null, currency: string) => string; t: TranslateFn }) {
  return (
    <div className="evaluation-p5-submission">
      <div>
        <h4>{t('evaluationApp.p5.submittedDocuments')}</h4>
        {bid.documents.length > 0 ? (
          <ul>
            {bid.documents.map((document) => (
              <li key={document.id}>{document.name} / {document.documentType} / {document.reviewStatus}</li>
            ))}
          </ul>
        ) : (
          <p>{t('evaluationApp.p5.noDocuments')}</p>
        )}
      </div>
      <div>
        <h4>{t('evaluationApp.p5.technicalResponse')}</h4>
        {bid.responses.length > 0 ? (
          <ul>
            {bid.responses.map((response) => (
              <li key={response.requirementKey}>
                <strong>{response.requirementKey}</strong>
                <span>{formatResponse(response.response)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('evaluationApp.p5.noResponses')}</p>
        )}
      </div>
      <div>
        <h4>{t('evaluationApp.p5.financialAmount')}</h4>
        <p>{formatMoney(bid.financialAmount, bid.currency)}</p>
      </div>
    </div>
  );
}

function BidSelector({ bids, selectedBidId, onSelectBid }: { bids: EditableEvaluationBid[]; selectedBidId: string; onSelectBid: (bidId: string) => void }) {
  return (
    <div className="evaluation-p5-bid-selector">
      {bids.map((bid) => (
        <button className={selectedBidId === bid.id ? 'active' : ''} type="button" key={bid.id} onClick={() => onSelectBid(bid.id)}>
          {bid.supplierName}
        </button>
      ))}
    </div>
  );
}

function createScoreDrafts(workspace: EvaluationWorkspace): ScoreDraftMap {
  const drafts: ScoreDraftMap = {};
  for (const bid of workspace.bids) {
    for (const score of bid.scores) {
      drafts[draftKey(bid.id, score.criterionId)] = {
        score: score.score === null ? '' : String(score.score),
        comment: score.comment
      };
    }
  }
  return drafts;
}

function createDecisionDrafts(workspace: EvaluationWorkspace): DecisionDraftMap {
  return Object.fromEntries(
    workspace.bids.map((bid) => [
      bid.id,
      {
        status: bid.decisionStatus,
        comment: bid.decisionComment
      }
    ])
  );
}

function buildScoredBids(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap, decisionDrafts: DecisionDraftMap): EditableEvaluationBid[] {
  const financial = localFinancialScores(workspace.bids);
  return workspace.bids.map((bid) => {
    const scores = workspace.criteria.map((criterion) => {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      const parsedScore = draft?.score === '' || draft?.score === undefined ? null : Number(draft.score);
      return {
        criterionId: criterion.id,
        score: Number.isFinite(parsedScore) ? parsedScore : null,
        comment: draft?.comment ?? '',
        evaluatorName: bid.scores.find((score) => score.criterionId === criterion.id)?.evaluatorName ?? null,
        evaluatedAt: bid.scores.find((score) => score.criterionId === criterion.id)?.evaluatedAt ?? null
      };
    });
    const technical = localTechnicalScore(workspace.criteria, scores);
    const decision = decisionDrafts[bid.id] ?? { status: bid.decisionStatus, comment: bid.decisionComment };
    const commentSummary = decision.comment || scores.find((score) => score.comment)?.comment || '';
    return {
      ...bid,
      scores,
      technicalScore: technical,
      financialScore: financial.get(bid.id) ?? bid.financialScore,
      totalScore: technical,
      evaluated: technical !== null,
      decisionStatus: decision.status,
      decisionComment: decision.comment,
      commentSummary
    };
  });
}

function buildRankings(bids: EditableEvaluationBid[]) {
  return bids
    .filter((bid) => bid.totalScore !== null)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .map((bid, index) => ({
      rank: index + 1,
      bidId: bid.id,
      bidderName: bid.supplierName,
      technicalScore: bid.technicalScore,
      financialScore: bid.financialScore,
      totalScore: bid.totalScore ?? 0,
      decisionStatus: bid.decisionStatus,
      commentSummary: bid.commentSummary
    }));
}

function localTechnicalScore(criteria: EvaluationWorkspace['criteria'], scores: EvaluationWorkspaceBid['scores']) {
  if (criteria.length === 0) return null;
  if (criteria.some((criterion) => {
    const score = scores.find((item) => item.criterionId === criterion.id)?.score;
    return score === null || score === undefined || score > criterion.maxScore;
  })) return null;

  const totalWeight = criteria.reduce((sum, criterion) => sum + (criterion.weight ?? 0), 0);
  if (totalWeight > 0) {
    return roundScore(criteria.reduce((sum, criterion) => {
      const score = scores.find((item) => item.criterionId === criterion.id)?.score ?? 0;
      return sum + (score / criterion.maxScore) * (criterion.weight ?? 0);
    }, 0));
  }

  return roundScore(criteria.reduce((sum, criterion) => {
    const score = scores.find((item) => item.criterionId === criterion.id)?.score ?? 0;
    return sum + (score / criterion.maxScore) * 100;
  }, 0) / criteria.length);
}

function localFinancialScores(bids: EvaluationWorkspace['bids']) {
  const amounts = bids
    .map((bid) => ({ bidId: bid.id, amount: bid.financialAmount }))
    .filter((row): row is { bidId: string; amount: number } => typeof row.amount === 'number' && row.amount > 0);
  const lowest = Math.min(...amounts.map((row) => row.amount));
  const scores = new Map<string, number>();
  if (!Number.isFinite(lowest)) return scores;
  for (const row of amounts) scores.set(row.bidId, roundScore((lowest / row.amount) * 100));
  return scores;
}

function validateScoreDrafts(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap) {
  for (const bid of workspace.bids) {
    for (const criterion of workspace.criteria) {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      if (!draft || draft.score === '') continue;
      const score = Number(draft.score);
      if (!Number.isFinite(score) || score < 0) return 'Scores must be valid positive numbers.';
      if (score > criterion.maxScore) return 'Score cannot exceed the criterion maximum score.';
    }
  }
  return '';
}

function draftKey(bidId: string, criterionId: string) {
  return `${bidId}:${criterionId}`;
}

function decisionLabel(value: EvaluationDecisionStatus, t: TranslateFn) {
  return t(`evaluationApp.p5.decisions.${value}`, { defaultValue: humanizeEnum(value) });
}

function formatResponse(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatMoney(value: number | null, currency: string) {
  if (value === null) return 'Not available';
  return `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
