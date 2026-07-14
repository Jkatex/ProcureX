import { Fragment, type ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { evaluationApi } from '@/features/evaluation/api';
import type {
  EvaluationDashboard,
  EvaluationDecisionStatus,
  EvaluationDraft,
  EvaluationRecord,
  EvaluationStatusFilter,
  EvaluationWorkspace,
  EvaluationWorkspaceBid,
  EvaluationWorkspaceCriterion,
  ProcurementTypeFilter,
  ReadyEvaluationTender
} from '@/features/evaluation/types';
import { useNotifications } from '@/features/notifications/hooks';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { WorkspaceTopBar } from '@/shared/components/procurex/WorkspaceTopBar';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

type ScoreDraft = { score: string; comment: string; decision?: string };
type ScoreDraftMap = Record<string, ScoreDraft>;
type DecisionDraft = { status: EvaluationDecisionStatus; comment: string };
type DecisionDraftMap = Record<string, DecisionDraft>;
type EvaluationStageId = 'opening' | 'administrative' | 'criteria' | 'financial' | 'boq' | 'pricing' | 'sla' | 'postqual' | 'ranking' | 'report';

type TenderQueueRow = {
  tenderId: string;
  reference: string;
  title: string;
  buyerName: string;
  procurementType: Exclude<ProcurementTypeFilter, 'all'>;
  closingDate: string | null;
  submittedBidCount: number;
  bidCount: number;
  requirementCount: number;
  criteriaCount: number;
  ready: boolean;
  readinessReason: string | null;
  status: string;
  tenderStatus: string;
  bidOpeningStatus: string;
  hasClosed: boolean;
  openingStatus: string;
  evaluationStatus: string;
  canStartEvaluation: boolean;
  canContinueEvaluation: boolean;
  lockReason: string | null;
  stage: string | null;
  progress: number;
  updatedAt?: string;
};

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
  const [activeStageId, setActiveStageId] = useState<EvaluationStageId>('opening');
  const [selectedBidId, setSelectedBidId] = useState('');
  const [expandedBidId, setExpandedBidId] = useState('');
  const [scoreDrafts, setScoreDrafts] = useState<ScoreDraftMap>({});
  const [decisionDrafts, setDecisionDrafts] = useState<DecisionDraftMap>({});
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

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

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language === 'sw' ? 'sw-TZ' : 'en-US', {
        maximumFractionDigits: 0
      }),
    [i18n.language]
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
        const workspaceStages = data.tender ? stagesForType(data.tender.procurementType) : stagesForType('GOODS');
        const restoredStageId = restoreStageId(data.summary.activeStageId, workspaceStages);
        const restoredBidId = data.summary.selectedBidId && data.bids.some((bid) => bid.id === data.summary.selectedBidId)
          ? data.summary.selectedBidId
          : data.bids[0]?.id ?? '';
        setWorkspace(data);
        setSelectedBidId(restoredBidId);
        setExpandedBidId('');
        setScoreDrafts(createScoreDrafts(data));
        setDecisionDrafts(createDecisionDrafts(data));
        setActiveStageId(restoredStageId);
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

  const queueRows = useMemo(() => buildQueueRows(readyTenders, records), [readyTenders, records]);
  const filteredQueueRows = useMemo(
    () => queueRows.filter((row) => queueRowMatches(row, search, statusFilter, typeFilter)),
    [queueRows, search, statusFilter, typeFilter]
  );
  const scopedDrafts = useMemo(() => drafts.filter((draft) => draftMatches(draft, search, typeFilter)), [drafts, search, typeFilter]);
  const scoredBids = useMemo(() => (workspace ? buildScoredBids(workspace, scoreDrafts, decisionDrafts) : []), [decisionDrafts, scoreDrafts, workspace]);
  const selectedBid = scoredBids.find((bid) => bid.id === selectedBidId) ?? scoredBids[0] ?? null;
  const activeStages = workspace?.tender ? stagesForType(workspace.tender.procurementType) : stagesForType('GOODS');
  const normalizedStageId = activeStages.some((stage) => stage.id === activeStageId) ? activeStageId : activeStages[0].id;
  const rankings = useMemo(() => buildRankings(scoredBids), [scoredBids]);
  const completion = useMemo(() => completionState(workspace, scoredBids), [scoredBids, workspace]);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey as AppRouteKey] ?? '/dashboard');
  }

  function formatDate(value: string | null) {
    if (!value) return t('evaluationApp.labels.notScheduled');
    return dateFormatter.format(new Date(value));
  }

  function formatMoney(value: number | null, currency: string) {
    if (value === null) return t('evaluationApp.labels.notAvailable');
    return `${currency} ${moneyFormatter.format(value)}`;
  }

  function openWorkspace(tenderId: string) {
    setSelectedTenderId(tenderId);
    window.setTimeout(() => {
      document.querySelector('[data-evaluation-workspace-panel]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function viewTender(tenderId: string) {
    navigate(`/procurement/tender-details?tenderId=${encodeURIComponent(tenderId)}`);
  }

  function updateScoreDraft(bidId: string, criterionId: string, patch: Partial<ScoreDraft>) {
    const key = draftKey(bidId, criterionId);
    setScoreDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? { score: '', comment: '' }),
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

  async function refreshLists() {
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
  }

  useEffect(() => {
    const refresh = () => {
      void refreshLists().catch(() => {
        setLoadError(t('evaluationApp.errors.load'));
      });
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [search, statusFilter, t, typeFilter]);

  async function saveWorkspace(complete = false) {
    if (!workspace?.tender || workspaceSaving) return;
    const validation = validateScoreDrafts(workspace, scoreDrafts);
    if (validation) {
      setWorkspaceError(validation);
      const firstInvalid = firstMissingScoreStage(workspace, scoreDrafts);
      setActiveStageId(firstInvalid);
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
            const criterion = workspace.criteria.find((item) => item.id === criterionId);
            const comment = criterion && workspace.tender?.procurementType === 'GOODS' && isAdministrativeCriterion(criterion)
              ? goodsAdministrativeComment(draft)
              : draft.comment;
            return [{ bidId, criterionId, score: Number(draft.score), comment }];
          }),
        decisions: Object.entries(decisionDrafts).map(([bidId, draft]) => ({
          bidId,
          status: draft.status,
          comment: draft.comment
        })),
        activeStageId: normalizedStageId,
        selectedBidId: selectedBidId || undefined,
        complete
      });
      setWorkspace(saved);
      setScoreDrafts(createScoreDrafts(saved));
      setDecisionDrafts(createDecisionDrafts(saved));
      await refreshLists();
      notifySuccess(complete ? 'Evaluation completed' : 'Evaluation saved', complete ? 'Evaluation workspace completed.' : 'Evaluation workspace saved.', {
        reason: complete ? 'Scores, decisions, ranking, and recommendation data were saved.' : 'Your current evaluation entries were saved as progress.'
      });
    } catch {
      setWorkspaceError(t('evaluationApp.p5.errors.save'));
    } finally {
      setWorkspaceSaving(false);
    }
  }

  return (
    <>
      <WorkspaceTopBar title="Evaluation" onNavigate={navigateToPage} />
      <div className="main-layout procurement-layout evaluation-app-layout">
        <aside className="sidebar evaluation-sidebar">
          <div className="evaluation-sidebar-head">
            <h3>{workspace?.tender ? workspaceLabel(workspace.tender.procurementType) : 'Bid Evaluation'}</h3>
            <span>{workspace?.tender?.reference ?? 'Tender list'}</span>
          </div>
          <ul className="sidebar-nav">
            <li><button type="button" onClick={() => navigate('/dashboard')}>Workspace Dashboard</button></li>
            <li><button type="button" className="active" onClick={() => setSelectedTenderId('')}>Evaluation</button></li>
            <li><button type="button" onClick={() => navigate('/awards-contracts')}>Award Recommendation</button></li>
            <li><button type="button" onClick={() => setSelectedTenderId('')}>Select Tender</button></li>
            <li><button type="button" onClick={() => navigate('/sign-in')}>Logout</button></li>
          </ul>
        </aside>

        <main className="main-content procurement-content evaluation-workspace">
          {loadError ? (
            <NotificationCard notification={{ tone: 'error', title: 'Evaluation data could not load', message: loadError, reason: 'The dashboard could not retrieve evaluation records.', action: { label: 'Try again' }, dismissible: false }} />
          ) : null}

          {workspace && workspace.tender ? (
            <EvaluationWorkspaceView
              activeStageId={normalizedStageId}
              bids={scoredBids}
              completion={completion}
              expandedBidId={expandedBidId}
              formatDate={formatDate}
              formatMoney={formatMoney}
              onBack={() => setSelectedTenderId('')}
              onDecisionChange={updateDecisionDraft}
              onPreviewReport={() => setActiveStageId('report')}
              onSave={(complete) => void saveWorkspace(complete)}
              onScoreChange={updateScoreDraft}
              onSelectBid={setSelectedBidId}
              onStageChange={setActiveStageId}
              onToggleBid={(bidId) => setExpandedBidId((current) => current === bidId ? '' : bidId)}
              rankings={rankings}
              saving={workspaceSaving}
              selectedBid={selectedBid}
              selectedBidId={selectedBid?.id ?? ''}
              stages={activeStages}
              workspace={workspace}
              workspaceError={workspaceError}
              workspaceLoading={workspaceLoading}
            />
          ) : (
            <EvaluationTenderListView
              dashboard={dashboard}
              dateFormatter={dateFormatter}
              drafts={scopedDrafts}
              filteredRows={filteredQueueRows}
              loading={loading}
              onOpenWorkspace={openWorkspace}
              onViewTender={viewTender}
              recordsLoading={recordsLoading}
              search={search}
              setSearch={setSearch}
              setStatusFilter={setStatusFilter}
              setTypeFilter={setTypeFilter}
              statusFilter={statusFilter}
              totalRecords={totalRecords}
              typeFilter={typeFilter}
            />
          )}
        </main>
      </div>
    </>
  );
}

function EvaluationTenderListView({
  dashboard,
  dateFormatter,
  drafts,
  filteredRows,
  loading,
  onOpenWorkspace,
  onViewTender,
  recordsLoading,
  search,
  setSearch,
  setStatusFilter,
  setTypeFilter,
  statusFilter,
  totalRecords,
  typeFilter
}: {
  dashboard: EvaluationDashboard;
  dateFormatter: Intl.DateTimeFormat;
  drafts: EvaluationDraft[];
  filteredRows: TenderQueueRow[];
  loading: boolean;
  onOpenWorkspace: (tenderId: string) => void;
  onViewTender: (tenderId: string) => void;
  recordsLoading: boolean;
  search: string;
  setSearch: (value: string) => void;
  setStatusFilter: (value: EvaluationStatusFilter) => void;
  setTypeFilter: (value: ProcurementTypeFilter) => void;
  statusFilter: EvaluationStatusFilter;
  totalRecords: number;
  typeFilter: ProcurementTypeFilter;
}) {
  const readyCount = filteredRows.filter((row) => row.ready).length;
  const lockedCount = Math.max(0, dashboard.lockedUntilClosing);

  return (
    <>
      <section className="procurement-hero evaluation-hero-panel evaluation-selection-hero">
        <div>
          <span className="section-kicker">Evaluation app</span>
          <h1>Tenders for Evaluation</h1>
          <p>Open a closed tender after bid opening and evaluate submitted suppliers one supplier at a time against the published requirements and criteria.</p>
        </div>
        <div className="evaluation-hero-stats">
          <div><strong>{loading ? '0' : dashboard.publishedTenders}</strong><span>Published tenders</span></div>
          <div><strong>{loading ? '0' : dashboard.readyToEvaluate}</strong><span>Ready to evaluate</span></div>
          <div><strong>{loading ? '0' : dashboard.draftedEvaluations}</strong><span>Drafted evaluations</span></div>
          <div><strong>{loading ? '0' : lockedCount}</strong><span>Locked until closing</span></div>
        </div>
      </section>

      <section className="procurement-panel evaluation-panel records-filter-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Evaluation records search</span>
          </div>
          <span className="badge badge-info">{recordsLoading ? 'Loading' : `${totalRecords + drafts.length} records`}</span>
        </div>
        <div className="records-filter-grid">
          <label className="sr-only" htmlFor="evaluation-search">Search tender evaluations</label>
          <div className="evaluation-search-control">
            <SearchRoundedIcon fontSize="small" aria-hidden="true" />
            <input
              id="evaluation-search"
              className="form-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tender, buyer, reference..."
            />
          </div>
          <select className="form-input evaluation-filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EvaluationStatusFilter)}>
            <option value="all">All evaluation statuses</option>
            <option value="NOT_STARTED">Ready</option>
            <option value="IN_PROGRESS">Draft</option>
            <option value="COMPLETED">Completed</option>
            <option value="RETURNED">Returned</option>
          </select>
          <select className="form-input evaluation-filter-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ProcurementTypeFilter)}>
            <option value="all">All procurement types</option>
            <option value="GOODS">Goods</option>
            <option value="WORKS">Works</option>
            <option value="SERVICE">Services</option>
            <option value="CONSULTANCY">Consultancy</option>
          </select>
        </div>
      </section>

      <section className="procurement-panel evaluation-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Drafted in evaluation</span>
          </div>
          <span className="badge badge-info">{drafts.length} drafts</span>
        </div>
        <div className="evaluation-tender-list">
          {drafts.length ? drafts.map((draft) => (
            <article className="evaluation-tender-row is-ready is-draft" key={draft.id}>
              <div className="evaluation-tender-row-main">
                <span className="section-kicker">{typeLabel(draft.procurementType)} evaluation draft</span>
                <h3>{draft.title}</h3>
                <p>{draft.reference} / Last saved {dateFormatter.format(new Date(draft.updatedAt))}</p>
              </div>
              <div className="evaluation-tender-row-meta">
                <div><span>Resume at</span><strong>{stageLabel(draft.currentStage)}</strong></div>
                <div><span>Submitted bids</span><strong>{draft.submittedBidCount}</strong></div>
                <div><span>Status</span><strong>Saved as draft</strong></div>
                <div><span>Progress</span><strong>{draft.progressPercentage}%</strong></div>
              </div>
              <div className="evaluation-tender-row-status">
                <span className="badge badge-warning">Draft in evaluation</span>
                <div className="evaluation-progress-track"><span style={{ width: `${clampPercent(draft.progressPercentage)}%` }} /></div>
              </div>
              <div className="evaluation-tender-row-actions">
                <button className="btn btn-secondary" type="button" onClick={() => onViewTender(draft.tenderId)}>View Tender</button>
                <button className="btn btn-primary" type="button" onClick={() => onOpenWorkspace(draft.tenderId)}>Continue Evaluation</button>
              </div>
            </article>
          )) : <div className="scope-empty">No saved evaluation drafts yet. Save an evaluation draft and it will appear here for continuation.</div>}
        </div>
      </section>

      <section className="procurement-panel evaluation-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Published tenders</span>
          </div>
          <span className="badge badge-success">{readyCount} ready</span>
        </div>
        <div className="evaluation-tender-list">
          {filteredRows.length ? filteredRows.map((row) => {
            const action = evaluationAction(row);
            return (
              <article className={`evaluation-tender-row ${row.ready ? 'is-ready' : 'is-locked'}`} key={row.tenderId}>
                <div className="evaluation-tender-row-main">
                  <span className="section-kicker">{typeLabel(row.procurementType)} procurement</span>
                  <h3>{row.title}</h3>
                  <p>{row.reference} / {typeLabel(row.procurementType)} / {row.buyerName}</p>
                </div>
                <div className="evaluation-tender-row-meta">
                  <div><span>Closing date</span><strong>{row.closingDate ? dateFormatter.format(new Date(row.closingDate)) : '-'}</strong></div>
                  <div><span>Requirements</span><strong>{row.requirementCount}</strong></div>
                  <div><span>Criteria</span><strong>{row.criteriaCount}</strong></div>
                  <div><span>Progress</span><strong>{row.progress}%</strong></div>
                </div>
                <div className="evaluation-tender-row-status">
                  <span className="badge badge-warning">{row.bidOpeningStatus || statusLabel(row.tenderStatus)}</span>
                  <span className={row.ready ? 'badge badge-success' : 'badge badge-warning'}>{evaluationAvailabilityLabel(row)}</span>
                  <div className="evaluation-progress-track"><span style={{ width: `${clampPercent(row.progress)}%` }} /></div>
                </div>
                <div className="evaluation-tender-row-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onViewTender(row.tenderId)}>View Tender</button>
                  <button className="btn btn-primary" type="button" disabled={action.disabled} onClick={() => {
                    if (!action.disabled) onOpenWorkspace(row.tenderId);
                  }}>
                    {action.label}
                  </button>
                </div>
              </article>
            );
          }) : <div className="scope-empty">No tenders match the current evaluation filters.</div>}
        </div>
      </section>
    </>
  );
}

function EvaluationWorkspaceView({
  activeStageId,
  bids,
  completion,
  expandedBidId,
  formatDate,
  formatMoney,
  onBack,
  onDecisionChange,
  onPreviewReport,
  onSave,
  onScoreChange,
  onSelectBid,
  onStageChange,
  onToggleBid,
  rankings,
  saving,
  selectedBid,
  selectedBidId,
  stages,
  workspace,
  workspaceError,
  workspaceLoading
}: {
  activeStageId: EvaluationStageId;
  bids: EditableEvaluationBid[];
  completion: { complete: number; total: number; percent: number; canComplete: boolean };
  expandedBidId: string;
  formatDate: (value: string | null) => string;
  formatMoney: (value: number | null, currency: string) => string;
  onBack: () => void;
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
  onPreviewReport: () => void;
  onSave: (complete: boolean) => void;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  onSelectBid: (bidId: string) => void;
  onStageChange: (stageId: EvaluationStageId) => void;
  onToggleBid: (bidId: string) => void;
  rankings: ReturnType<typeof buildRankings>;
  saving: boolean;
  selectedBid: EditableEvaluationBid | null;
  selectedBidId: string;
  stages: Array<{ id: EvaluationStageId; label: string }>;
  workspace: EvaluationWorkspace;
  workspaceError: string;
  workspaceLoading: boolean;
}) {
  const tender = workspace.tender;
  if (!tender) return null;
  const currentStageLabel = stages.find((stage) => stage.id === activeStageId)?.label ?? stages[0].label;

  return (
    <>
      <section className="procurement-hero evaluation-hero-panel" data-evaluation-workspace-panel>
        <div>
          <span className="section-kicker">{workspaceLabel(tender.procurementType)} Workspace</span>
          <h1>{tender.title}</h1>
          <p>{workspaceHeroCopy(tender.procurementType)}</p>
        </div>
        <div className="evaluation-hero-stats">
          <div><strong>{tender.reference}</strong><span>Tender reference</span></div>
          <div><strong>{typeLabel(tender.procurementType)}</strong><span>Procurement type</span></div>
          <div><strong>{bids.length}</strong><span>Bids opened</span></div>
          <div><strong>{completion.percent}%</strong><span>Evaluation status</span></div>
        </div>
      </section>

      <section className="evaluation-top-summary">
        <div><span>Evaluation mode</span><strong>Manual Buyer Review</strong></div>
        <div><span>Criteria source</span><strong>Published Tender Criteria</strong></div>
        <div><span>Buyer criteria</span><strong>{workspace.criteria.length}</strong></div>
        <div><span>Bids opened</span><strong>{bids.length}</strong></div>
        <div><span>Current stage</span><strong>{currentStageLabel}</strong></div>
      </section>

      <section className={`procurement-panel evaluation-panel ${workspaceClass(tender.procurementType)}`}>
        <div className="evaluation-notice warning">This evaluation uses the criteria configured by the buyer during tender creation. The system organizes bid information and calculates totals only. The buyer makes all evaluation decisions manually.</div>

        {workspaceError ? (
          <NotificationCard notification={{ tone: 'error', title: 'Evaluation workspace issue', message: workspaceError, reason: 'Review the current evaluation entries and retry the save action.', action: { label: 'Try again' }, dismissible: false }} />
        ) : null}
        {!workspace.availability.isReady ? <div className="evaluation-notice warning">{workspace.availability.reason}</div> : null}

        <BidderTabs bids={bids} selectedBidId={selectedBidId} onSelectBid={onSelectBid} />
        <div className="evaluation-progress-track evaluation-workspace-progress"><span style={{ width: `${completion.percent}%` }} /></div>
        <EvaluationStepper stages={stages} activeStageId={activeStageId} onStageChange={onStageChange} />
        <div className="evaluation-review-main">
          <StagePanel
            activeStageId={activeStageId}
            bids={bids}
            expandedBidId={expandedBidId}
            formatDate={formatDate}
            formatMoney={formatMoney}
            onDecisionChange={onDecisionChange}
            onScoreChange={onScoreChange}
            onToggleBid={onToggleBid}
            rankings={rankings}
            selectedBid={selectedBid}
            workspace={workspace}
          />
        </div>

        <div className="evaluation-finish-panel">
          <div>
            <span className="section-kicker">Complete {typeLabel(tender.procurementType).toLowerCase()} evaluation</span>
            <h3>{completion.canComplete ? 'Ready for buyer completion' : 'Complete all evaluation scores and recommendation'}</h3>
            <p>{completion.complete} of {completion.total} required checks are complete. Ranking and award recommendation remain manual buyer decisions.</p>
          </div>
          <div className="inline-actions">
            <button className="btn btn-secondary" type="button" disabled={saving || workspaceLoading} onClick={() => onSave(false)}>
              <SaveRoundedIcon fontSize="small" aria-hidden="true" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button className="btn btn-secondary" type="button" onClick={onPreviewReport}>Preview Report</button>
            <button className="btn btn-secondary" type="button" onClick={() => window.print()}>Download Report</button>
            <button className="btn btn-primary" type="button" disabled={!completion.canComplete || saving || workspaceLoading} onClick={() => onSave(true)}>Complete Evaluation</button>
            <button className="btn btn-secondary" type="button" onClick={onBack}>Back to Tender List</button>
          </div>
        </div>
      </section>
    </>
  );
}

function EvaluationStepper({
  activeStageId,
  onStageChange,
  stages
}: {
  activeStageId: EvaluationStageId;
  onStageChange: (stageId: EvaluationStageId) => void;
  stages: Array<{ id: EvaluationStageId; label: string }>;
}) {
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.id === activeStageId));

  return (
    <nav className="evaluation-horizontal-stepper evaluation-stage-tabs wizard-step-progress" aria-label="Evaluation sections">
      {stages.map((stage, index) => {
        const stateClass = index < activeIndex ? 'completed' : index === activeIndex ? 'active' : 'upcoming';
        return (
          <button
            className={`evaluation-stage-tab wizard-progress-step ${stateClass}`}
            type="button"
            key={stage.id}
            onClick={() => onStageChange(stage.id)}
          >
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            <span>{stage.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function StagePanel({
  activeStageId,
  bids,
  expandedBidId,
  formatDate,
  formatMoney,
  onDecisionChange,
  onScoreChange,
  onToggleBid,
  rankings,
  selectedBid,
  workspace
}: {
  activeStageId: EvaluationStageId;
  bids: EditableEvaluationBid[];
  expandedBidId: string;
  formatDate: (value: string | null) => string;
  formatMoney: (value: number | null, currency: string) => string;
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  onToggleBid: (bidId: string) => void;
  rankings: ReturnType<typeof buildRankings>;
  selectedBid: EditableEvaluationBid | null;
  workspace: EvaluationWorkspace;
}) {
  if (activeStageId === 'opening') {
    return (
      <section className="evaluation-section-workspace">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">Opening Register</span>
            <h2>Submitted supplier bids</h2>
          </div>
          <span className="badge badge-success">Opened</span>
        </div>
        <div className="evaluation-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Submitted</th>
                <th>Documents</th>
                <th>Offer value</th>
                <th>Opening status</th>
                <th>Submission</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <Fragment key={bid.id}>
                  <tr>
                    <td><strong>{bid.supplierName}</strong><span>{bid.reference}</span></td>
                    <td>{formatDate(bid.submittedAt)}</td>
                    <td>{bid.documents.length}</td>
                    <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                    <td><span className="badge badge-success">Opened</span></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onToggleBid(bid.id)}>
                        <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                        <span>{expandedBidId === bid.id ? 'Hide submission' : 'Open submission'}</span>
                      </button>
                    </td>
                  </tr>
                  {expandedBidId === bid.id ? (
                    <tr>
                      <td colSpan={6}><BidSubmissionDetail bid={bid} formatMoney={formatMoney} /></td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (activeStageId === 'administrative') {
    if (workspace.tender?.procurementType === 'GOODS') {
      return (
        <GoodsAdministrativeReviewPanel
          bid={selectedBid}
          criteria={administrativeCriteria(workspace.criteria)}
          onScoreChange={onScoreChange}
        />
      );
    }

    return (
      <SupplierScoringPanel
        bid={selectedBid}
        criteria={administrativeCriteria(workspace.criteria)}
        emptyMessage="No administrative compliance criterion is available for this tender."
        kicker="Administrative & Eligibility Evaluation"
        onScoreChange={onScoreChange}
      />
    );
  }

  if (activeStageId === 'criteria') {
    return (
      <SupplierScoringPanel
        bid={selectedBid}
        criteria={technicalCriteria(workspace.criteria)}
        emptyMessage="No technical criteria are available for this tender."
        kicker="Custom Evaluation Criteria"
        onScoreChange={onScoreChange}
      />
    );
  }

  if (activeStageId === 'financial' || activeStageId === 'boq' || activeStageId === 'pricing') {
    return (
      <FinancialReviewPanel
        bids={bids}
        criteria={financialCriteria(workspace.criteria)}
        formatMoney={formatMoney}
        onScoreChange={onScoreChange}
        selectedBid={selectedBid}
        title={activeStageId === 'boq' ? 'Financial Review' : activeStageId === 'pricing' ? 'Service Pricing Review' : 'Financial Review'}
      />
    );
  }

  if (activeStageId === 'sla' || activeStageId === 'postqual') {
    return <DecisionPanel bids={bids} selectedBid={selectedBid} onDecisionChange={onDecisionChange} title={activeStageId === 'sla' ? 'SLA / Performance Review' : 'Post-Qualification'} />;
  }

  if (activeStageId === 'ranking') {
    return <RankingPanel rankings={rankings} />;
  }

  return <ReportPanel bids={bids} rankings={rankings} workspace={workspace} formatDate={formatDate} formatMoney={formatMoney} />;
}

function SupplierScoringPanel({
  bid,
  criteria,
  emptyMessage,
  kicker,
  onScoreChange
}: {
  bid: EditableEvaluationBid | null;
  criteria: EvaluationWorkspaceCriterion[];
  emptyMessage: string;
  kicker: string;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
}) {
  if (!bid) return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected." />;
  if (!criteria.length) return <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message={emptyMessage} />;

  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{bid.supplierName}</h2>
        </div>
        <span className="badge badge-info">{bid.evaluated ? 'Evaluated' : 'Pending'}</span>
      </div>
      <div className="evaluation-supplier-profile">
        <div className="evaluation-supplier-info-grid">
          <article><span>Supplier</span><strong>{bid.supplierName}</strong></article>
          <article><span>Submitted</span><strong>{bid.submittedAt ? new Date(bid.submittedAt).toLocaleString() : '-'}</strong></article>
          <article><span>Documents</span><strong>{bid.documents.length}</strong></article>
          <article><span>Status</span><strong>{bid.status}</strong></article>
        </div>
      </div>
      <div className="evaluation-requirement-list">
        {criteria.map((criterion) => {
          const score = bid.scores.find((item) => item.criterionId === criterion.id) ?? { score: null, comment: '' };
          const isPassFail = criterion.maxScore <= 1;
          return (
            <article className="evaluation-requirement-row" key={criterion.id}>
              <div className="evaluation-requirement-main">
                <span className="section-kicker">{criterion.category}</span>
                <h3>{criterion.name}</h3>
                <p>{criterion.weight === null ? 'Pass/fail gate' : `${criterion.weight}% weight / max ${criterion.maxScore}`}</p>
              </div>
              <div className="evaluation-evidence-panel">
                <strong>Evidence</strong>
                {bid.documents.slice(0, 4).map((document) => (
                  <div className="evaluation-evidence-item" key={document.id}>
                    <span>{document.documentType}</span>
                    <p>{document.name}</p>
                  </div>
                ))}
              </div>
              <div className="evaluation-decision-panel">
                <label>
                  Decision / score
                  {isPassFail ? (
                    <select className="form-input" value={score.score === null ? '' : String(score.score)} onChange={(event) => onScoreChange(bid.id, criterion.id, { score: event.target.value })}>
                      <option value="">Select</option>
                      <option value="1">Pass</option>
                      <option value="0">Fail</option>
                    </select>
                  ) : (
                    <input className="form-input" type="number" min="0" max={criterion.maxScore} step="0.01" value={score.score === null ? '' : String(score.score)} onChange={(event) => onScoreChange(bid.id, criterion.id, { score: event.target.value })} />
                  )}
                </label>
                <label className="wide">
                  Evaluator comment
                  <textarea className="form-input evaluation-p5-comment" value={score.comment} onChange={(event) => onScoreChange(bid.id, criterion.id, { comment: event.target.value })} />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GoodsAdministrativeReviewPanel({
  bid,
  criteria,
  onScoreChange
}: {
  bid: EditableEvaluationBid | null;
  criteria: EvaluationWorkspaceCriterion[];
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
}) {
  if (!bid) return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected." />;
  if (!criteria.length) return <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message="No administrative eligibility checks are available for this goods tender." />;

  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Administrative & Eligibility Evaluation</span>
          <h2>{bid.supplierName}</h2>
          <p>Pass/fail review of mandatory eligibility, regulatory, document, and declaration checks.</p>
        </div>
        <span className="badge badge-info">Buyer decision required</span>
      </div>

      <div className="goods-evaluation-card-list">
        {criteria.map((criterion) => {
          const saved = bid.scores.find((item) => item.criterionId === criterion.id) ?? { score: null, comment: '' };
          const scoreDraft = bid.scoreDrafts?.[criterion.id];
          const decision = scoreDraft?.decision ?? goodsAdministrativeDecision(saved.score, saved.comment);
          const evidence = matchingGoodsEvidence(bid, criterion);

          return (
            <article className="goods-evaluation-card" key={criterion.id}>
              <div>
                <span className="section-kicker">{criterion.maxScore <= 1 ? 'Mandatory' : 'Optional'}</span>
                <h3>{criterion.name}</h3>
                <p>{criterion.category || 'Published tender requirement'}</p>
              </div>

              <aside className="goods-evidence-panel">
                <strong>Supplier Evidence</strong>
                {evidence.length ? evidence.map((document) => (
                  <div className="evaluation-evidence-item" key={document.id}>
                    <span>{document.documentType || 'Submitted document'}</span>
                    <p>{document.name}</p>
                    <div className="evaluation-document-actions">
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => openEvidenceMetadata(document)}>View</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => downloadEvidenceMetadata(document)}>Download</button>
                    </div>
                  </div>
                )) : (
                  <p>No matching submitted evidence was found. The buyer must decide manually from the available bid package.</p>
                )}
              </aside>

              <div className="evaluation-decision-panel">
                <label>
                  Buyer decision
                  <select
                    className="form-input"
                    value={decision}
                    onChange={(event) => onScoreChange(bid.id, criterion.id, { decision: event.target.value, score: goodsAdministrativeScore(event.target.value) })}
                  >
                    <option value="">Select decision</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Not Applicable">Not Applicable</option>
                    <option value="Clarification Required">Clarification Required</option>
                  </select>
                </label>
                <label>
                  Remark
                  <textarea className="form-input" rows={3} value={saved.comment} onChange={(event) => onScoreChange(bid.id, criterion.id, { comment: event.target.value })} />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FinancialReviewPanel({
  bids,
  criteria,
  formatMoney,
  onScoreChange,
  selectedBid,
  title
}: {
  bids: EditableEvaluationBid[];
  criteria: EvaluationWorkspaceCriterion[];
  formatMoney: (value: number | null, currency: string) => string;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  selectedBid: EditableEvaluationBid | null;
  title: string;
}) {
  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{title}</span>
          <h2>Financial comparison and scoring</h2>
        </div>
        <span className="badge badge-info">{bids.length} opened bids</span>
      </div>
      <div className="evaluation-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Financial amount</th>
              <th>Calculated price score</th>
              <th>Current total</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr key={bid.id}>
                <td><strong>{bid.supplierName}</strong></td>
                <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                <td>{bid.financialScore === null ? '-' : `${bid.financialScore}%`}</td>
                <td>{bid.totalScore === null ? '-' : `${bid.totalScore}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedBid && criteria.length ? (
        <SupplierScoringPanel bid={selectedBid} criteria={criteria} emptyMessage="No financial criterion is available." kicker="Financial Proposal Scoring" onScoreChange={onScoreChange} />
      ) : null}
    </section>
  );
}

function DecisionPanel({
  bids,
  onDecisionChange,
  selectedBid,
  title
}: {
  bids: EditableEvaluationBid[];
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
  selectedBid: EditableEvaluationBid | null;
  title: string;
}) {
  if (!selectedBid) return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected." />;
  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{title}</span>
          <h2>{selectedBid.supplierName}</h2>
        </div>
        <span className="badge badge-info">{selectedBid.decisionStatus}</span>
      </div>
      <div className="evaluation-requirement-row">
        <div className="evaluation-requirement-main">
          <span className="section-kicker">Buyer decision</span>
          <h3>Manual qualification outcome</h3>
          <p>Use this decision to capture post-evaluation qualification, recommendation, or clarification status.</p>
        </div>
        <div className="evaluation-evidence-panel">
          <strong>Ranking context</strong>
          {bids.map((bid) => (
            <div className="evaluation-evidence-item" key={bid.id}>
              <span>{bid.supplierName}</span>
              <p>{bid.totalScore === null ? 'Not fully evaluated' : `${bid.totalScore}% total score`}</p>
            </div>
          ))}
        </div>
        <div className="evaluation-decision-panel">
          <label>
            Decision
            <select className="form-input" value={selectedBid.decisionStatus} onChange={(event) => onDecisionChange(selectedBid.id, { status: event.target.value as EvaluationDecisionStatus })}>
              {decisionOptions.map((option) => (
                <option key={option} value={option} disabled={option === 'RECOMMENDED' && !selectedBid.evaluated}>{decisionLabel(option)}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            Reason / evaluator note
            <textarea className="form-input evaluation-p5-comment" value={selectedBid.decisionComment} onChange={(event) => onDecisionChange(selectedBid.id, { comment: event.target.value })} />
          </label>
        </div>
      </div>
    </section>
  );
}

function RankingPanel({ rankings }: { rankings: ReturnType<typeof buildRankings> }) {
  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Final Ranking</span>
          <h2>Supplier ranking</h2>
        </div>
        <span className="badge badge-info">{rankings.length} ranked</span>
      </div>
      {rankings.length ? (
        <div className="evaluation-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Bidder</th>
                <th>Technical score</th>
                <th>Financial score</th>
                <th>Total score</th>
                <th>Decision</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row) => (
                <tr key={row.bidId}>
                  <td>{row.rank}</td>
                  <td><strong>{row.bidderName}</strong></td>
                  <td>{row.technicalScore === null ? '-' : `${row.technicalScore}%`}</td>
                  <td>{row.financialScore === null ? '-' : `${row.financialScore}%`}</td>
                  <td>{row.totalScore}%</td>
                  <td><span className="badge badge-info">{decisionLabel(row.decisionStatus)}</span></td>
                  <td>{row.commentSummary || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EvaluationEmptyMessage icon={<LeaderboardRoundedIcon fontSize="small" aria-hidden="true" />} message="No evaluated bidders yet. Ranking will appear after scores are entered." />}
    </section>
  );
}

function ReportPanel({
  bids,
  formatDate,
  formatMoney,
  rankings,
  workspace
}: {
  bids: EditableEvaluationBid[];
  formatDate: (value: string | null) => string;
  formatMoney: (value: number | null, currency: string) => string;
  rankings: ReturnType<typeof buildRankings>;
  workspace: EvaluationWorkspace;
}) {
  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Evaluation Report</span>
          <h2>{workspace.tender?.title}</h2>
        </div>
        <span className="badge badge-info">{workspace.summary.evaluationStatus}</span>
      </div>
      <div className="evaluation-top-summary">
        <div><span>Tender</span><strong>{workspace.tender?.reference}</strong></div>
        <div><span>Buyer</span><strong>{workspace.tender?.buyerName}</strong></div>
        <div><span>Closing</span><strong>{formatDate(workspace.tender?.closingDate ?? null)}</strong></div>
        <div><span>Submitted bids</span><strong>{bids.length}</strong></div>
      </div>
      <div className="evaluation-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Offer</th>
              <th>Total score</th>
              <th>Decision</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => {
              const rank = rankings.find((row) => row.bidId === bid.id);
              return (
                <tr key={bid.id}>
                  <td><strong>{bid.supplierName}</strong></td>
                  <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                  <td>{bid.totalScore === null ? '-' : `${bid.totalScore}%`}</td>
                  <td>{decisionLabel(bid.decisionStatus)}</td>
                  <td>{rank?.rank ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BidderTabs({ bids, selectedBidId, onSelectBid }: { bids: EditableEvaluationBid[]; selectedBidId: string; onSelectBid: (bidId: string) => void }) {
  if (!bids.length) return null;
  return (
    <div className="evaluation-bidder-switcher">
      {bids.map((bid, index) => {
        const isSelected = selectedBidId === bid.id;
        const statusLabel = isSelected ? 'Selected' : decisionLabel(bid.decisionStatus);
        return (
          <button className={isSelected ? 'active' : ''} type="button" key={bid.id} onClick={() => onSelectBid(bid.id)} title={bid.supplierName}>
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            <span className="evaluation-bidder-tab-copy">
              <span className="evaluation-bidder-tab-name">{bid.supplierName}</span>
              <span className="evaluation-bidder-tab-status">{statusLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BidSubmissionDetail({ bid, formatMoney }: { bid: EditableEvaluationBid; formatMoney: (value: number | null, currency: string) => string }) {
  return (
    <div className="evaluation-p5-submission">
      <div>
        <h4>Submitted documents</h4>
        {bid.documents.length > 0 ? (
          <ul>
            {bid.documents.map((document) => (
              <li key={document.id}>{document.name} / {document.documentType} / {document.reviewStatus}</li>
            ))}
          </ul>
        ) : <p>No submitted documents available.</p>}
      </div>
      <div>
        <h4>Bid responses</h4>
        {bid.responses.length > 0 ? (
          <ul>
            {bid.responses.map((response) => (
              <li key={response.requirementKey}>
                <strong>{response.requirementKey}</strong>
                <span>{formatResponse(response.response)}</span>
              </li>
            ))}
          </ul>
        ) : <p>No bid responses available.</p>}
      </div>
      <div>
        <h4>Financial amount</h4>
        <p>{formatMoney(bid.financialAmount, bid.currency)}</p>
      </div>
    </div>
  );
}

function EvaluationEmptyMessage({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="evaluation-empty-message">
      {icon}
      <span>{message}</span>
    </div>
  );
}

function buildQueueRows(readyTenders: ReadyEvaluationTender[], records: EvaluationRecord[]): TenderQueueRow[] {
  const byTender = new Map<string, TenderQueueRow>();
  for (const record of records) {
    byTender.set(record.tenderId, {
      tenderId: record.tenderId,
      reference: record.reference,
      title: record.title,
      buyerName: record.buyerName,
      procurementType: record.procurementType,
      closingDate: record.closingDate,
      submittedBidCount: record.submittedBidCount,
      bidCount: record.submittedBidCount,
      requirementCount: 0,
      criteriaCount: 0,
      ready: record.status !== 'COMPLETED' && record.submittedBidCount > 0,
      readinessReason: null,
      status: record.status,
      tenderStatus: 'EVALUATION',
      bidOpeningStatus: 'Opening Completed',
      hasClosed: true,
      openingStatus: 'COMPLETED',
      evaluationStatus: record.status,
      canStartEvaluation: false,
      canContinueEvaluation: record.status === 'IN_PROGRESS' || record.status === 'RETURNED',
      lockReason: null,
      stage: record.currentStage,
      progress: record.progressPercentage,
      updatedAt: record.updatedAt
    });
  }
  for (const ready of readyTenders) {
    const existing = byTender.get(ready.tenderId);
    byTender.set(ready.tenderId, {
      tenderId: ready.tenderId,
      reference: ready.reference,
      title: ready.title,
      buyerName: ready.buyerName,
      procurementType: ready.procurementType,
      closingDate: ready.closingDate,
      submittedBidCount: ready.submittedBidCount,
      bidCount: ready.bidCount,
      requirementCount: ready.requirementCount,
      criteriaCount: ready.criteriaCount,
      ready: ready.ready,
      readinessReason: ready.lockReason ?? ready.readinessReason,
      status: existing?.status ?? ready.evaluationStatus,
      tenderStatus: ready.tenderStatus,
      bidOpeningStatus: ready.bidOpeningStatus,
      hasClosed: ready.hasClosed,
      openingStatus: ready.openingStatus,
      evaluationStatus: existing?.evaluationStatus ?? ready.evaluationStatus,
      canStartEvaluation: ready.canStartEvaluation,
      canContinueEvaluation: existing?.canContinueEvaluation ?? ready.canContinueEvaluation,
      lockReason: ready.lockReason,
      stage: existing?.stage ?? ready.currentStage ?? 'OPENING',
      progress: existing?.progress ?? ready.progressPercentage,
      updatedAt: existing?.updatedAt
    });
  }
  return [...byTender.values()].sort((left, right) => Number(right.ready) - Number(left.ready) || left.reference.localeCompare(right.reference));
}

function queueRowMatches(row: TenderQueueRow, search: string, status: EvaluationStatusFilter, type: ProcurementTypeFilter) {
  const normalizedSearch = search.trim().toLowerCase();
  if (status !== 'all' && row.status !== status) return false;
  if (type !== 'all' && row.procurementType !== type) return false;
  if (!normalizedSearch) return true;
  return [row.reference, row.title, row.buyerName, row.procurementType, row.status, row.tenderStatus, row.bidOpeningStatus, row.readinessReason ?? ''].join(' ').toLowerCase().includes(normalizedSearch);
}

function draftMatches(draft: EvaluationDraft, search: string, type: ProcurementTypeFilter) {
  if (type !== 'all' && draft.procurementType !== type) return false;
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return [draft.reference, draft.title, draft.procurementType, draft.currentStage ?? ''].join(' ').toLowerCase().includes(normalizedSearch);
}

function evaluationAvailabilityLabel(row: TenderQueueRow) {
  if (row.evaluationStatus === 'COMPLETED') return 'Evaluation completed';
  if (row.canContinueEvaluation) return 'Evaluation in progress';
  if (row.canStartEvaluation) return 'Evaluation open';
  return row.lockReason ?? row.readinessReason ?? 'Evaluation locked';
}

function evaluationAction(row: TenderQueueRow) {
  if (row.evaluationStatus === 'COMPLETED') return { label: 'View Results', disabled: false };
  if (row.canContinueEvaluation) return { label: 'Continue Evaluation', disabled: false };
  if (row.canStartEvaluation) return { label: 'Start Evaluation', disabled: false };
  return { label: 'Locked', disabled: true };
}

function createScoreDrafts(workspace: EvaluationWorkspace): ScoreDraftMap {
  const drafts: ScoreDraftMap = {};
  for (const bid of workspace.bids) {
    for (const criterion of workspace.criteria) {
      const existing = bid.scores.find((score) => score.criterionId === criterion.id);
      const parsedComment = parseGoodsAdministrativeComment(existing?.comment ?? '');
      drafts[draftKey(bid.id, criterion.id)] = {
        score: existing?.score === null || existing?.score === undefined ? '' : String(existing.score),
        comment: parsedComment.remark,
        ...(parsedComment.decision ? { decision: parsedComment.decision } : {})
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

type EditableEvaluationBid = EvaluationWorkspaceBid & {
  commentSummary: string;
  scoreDrafts?: Record<string, ScoreDraft>;
};
type EvaluationEvidenceDocument = EvaluationWorkspaceBid['documents'][number];

function buildScoredBids(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap, decisionDrafts: DecisionDraftMap): EditableEvaluationBid[] {
  const financial = localFinancialScores(workspace.bids);
  return workspace.bids.map((bid) => {
    const scores = workspace.criteria.map((criterion) => {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      const parsedScore = draft?.score === '' || draft?.score === undefined ? null : Number(draft.score);
      const parsedComment = parseGoodsAdministrativeComment(draft?.comment ?? '');
      return {
        criterionId: criterion.id,
        score: Number.isFinite(parsedScore) ? parsedScore : null,
        comment: parsedComment.remark,
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
      scoreDrafts: Object.fromEntries(workspace.criteria.map((criterion) => [criterion.id, scoreDrafts[draftKey(bid.id, criterion.id)] ?? { score: '', comment: '' }])),
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

function completionState(workspace: EvaluationWorkspace | null, bids: EditableEvaluationBid[]) {
  if (!workspace) return { complete: 0, total: 0, percent: 0, canComplete: false };
  const total = workspace.criteria.length * bids.length;
  const complete = bids.reduce(
    (sum, bid) => sum + workspace.criteria.filter((criterion) => {
      if (workspace.tender?.procurementType === 'GOODS' && isAdministrativeCriterion(criterion)) {
        return isGoodsAdministrativeDraftComplete(bid.scoreDrafts?.[criterion.id]);
      }
      const score = bid.scores.find((item) => item.criterionId === criterion.id)?.score;
      return score !== null && score !== undefined && score <= criterion.maxScore;
    }).length,
    0
  );
  const percent = total > 0 ? Math.round((complete / total) * 100) : 0;
  return { complete, total, percent, canComplete: total > 0 && complete === total };
}

function validateScoreDrafts(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap) {
  for (const bid of workspace.bids) {
    for (const criterion of workspace.criteria) {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      if (workspace.tender?.procurementType === 'GOODS' && isAdministrativeCriterion(criterion)) {
        if (!draft?.decision && draft?.score) return 'Select a buyer decision for every goods administrative check with a score.';
        if (draft?.decision && isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) {
          return 'Add a remark for failed or clarification-required administrative checks.';
        }
      }
      if (!draft || draft.score === '') continue;
      const score = Number(draft.score);
      if (!Number.isFinite(score) || score < 0) return 'Scores must be valid positive numbers.';
      if (score > criterion.maxScore) return 'Score cannot exceed the criterion maximum score.';
    }
  }
  return '';
}

function firstMissingScoreStage(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap): EvaluationStageId {
  const missing = workspace.criteria.find((criterion) =>
    workspace.bids.some((bid) => {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      return !draft || draft.score === '';
    })
  );
  if (!missing) return 'criteria';
  if (isAdministrativeCriterion(missing)) return 'administrative';
  if (isFinancialCriterion(missing)) return workspace.tender?.procurementType === 'WORKS' ? 'boq' : workspace.tender?.procurementType === 'SERVICE' ? 'pricing' : 'financial';
  return 'criteria';
}

function administrativeCriteria(criteria: EvaluationWorkspaceCriterion[]) {
  return criteria.filter(isAdministrativeCriterion);
}

function technicalCriteria(criteria: EvaluationWorkspaceCriterion[]) {
  return criteria.filter((criterion) => !isAdministrativeCriterion(criterion) && !isFinancialCriterion(criterion));
}

function financialCriteria(criteria: EvaluationWorkspaceCriterion[]) {
  return criteria.filter(isFinancialCriterion);
}

function isAdministrativeCriterion(criterion: EvaluationWorkspaceCriterion) {
  return criterion.maxScore <= 1 || /administrative|eligibility|compliance/i.test(`${criterion.name} ${criterion.category}`);
}

function goodsAdministrativeDecision(score: number | null, comment = '') {
  const parsed = parseGoodsAdministrativeComment(comment);
  if (parsed.decision) return parsed.decision;
  if (score === null || score === undefined) return '';
  if (/not applicable/i.test(comment)) return 'Not Applicable';
  if (/clarification/i.test(comment)) return 'Clarification Required';
  return Number(score) > 0 ? 'Pass' : 'Fail';
}

function goodsAdministrativeComment(draft: ScoreDraft) {
  const decision = draft.decision?.trim();
  const remark = draft.comment.trim();
  return decision ? `[Decision: ${decision}]${remark ? `\n${remark}` : ''}` : remark;
}

function parseGoodsAdministrativeComment(comment = '') {
  const match = comment.match(/^\[Decision:\s*([^\]]+)\]\s*/i);
  if (!match) return { decision: '', remark: comment };
  return {
    decision: match[1].trim(),
    remark: comment.slice(match[0].length)
  };
}

function goodsAdministrativeScore(decision: string) {
  if (decision === 'Pass' || decision === 'Not Applicable') return '1';
  if (decision === 'Fail' || decision === 'Clarification Required') return '0';
  return '';
}

function isGoodsManualDecisionNegative(decision = '') {
  return /fail|clarification|required|rejected|non-responsive|not qualified|non-compliant/i.test(decision);
}

function isGoodsAdministrativeDraftComplete(draft: ScoreDraft | undefined) {
  if (!draft?.decision) return false;
  if (isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) return false;
  return true;
}

function matchingGoodsEvidence(bid: EditableEvaluationBid, criterion: EvaluationWorkspaceCriterion) {
  const keywords = `${criterion.name} ${criterion.category}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
  const matches = bid.documents.filter((document) => {
    const haystack = `${document.name} ${document.documentType}`.toLowerCase();
    return keywords.some((word) => haystack.includes(word));
  });
  return matches.slice(0, 1);
}

function openEvidenceMetadata(document: EvaluationEvidenceDocument) {
  const previewWindow = window.open('', '_blank', 'noopener');
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(evidenceMetadataHtml(document));
  previewWindow.document.close();
}

function downloadEvidenceMetadata(document: EvaluationEvidenceDocument) {
  const blob = new Blob([evidenceMetadataHtml(document)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(document.name || 'submitted-evidence')}.html`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function evidenceMetadataHtml(document: EvaluationEvidenceDocument) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(document.name)}</title><style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif}main{max-width:760px;margin:32px auto;border:1px solid #cbd5e1;background:#fff;padding:28px}h1{margin:0 0 10px;font-size:24px}dl{display:grid;grid-template-columns:150px 1fr;gap:10px 16px;margin-top:20px}dt{color:#64748b;font-weight:700}dd{margin:0;overflow-wrap:anywhere}</style></head><body><main><h1>${escapeHtml(document.name)}</h1><p>This preview contains the submitted document metadata available to the evaluation workspace.</p><dl><dt>Document type</dt><dd>${escapeHtml(document.documentType || '-')}</dd><dt>Review status</dt><dd>${escapeHtml(document.reviewStatus || '-')}</dd><dt>Document id</dt><dd>${escapeHtml(document.id)}</dd></dl></main></body></html>`;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'submitted-evidence';
}

function isFinancialCriterion(criterion: EvaluationWorkspaceCriterion) {
  return criterion.stage === 'FINANCIAL' || /financial|price|proposal/i.test(`${criterion.name} ${criterion.category}`);
}

function stagesForType(type: Exclude<ProcurementTypeFilter, 'all'>): Array<{ id: EvaluationStageId; label: string }> {
  if (type === 'WORKS') {
    return [
      { id: 'opening', label: 'Opening Register' },
      { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
      { id: 'criteria', label: 'Custom Evaluation Criteria' },
      { id: 'boq', label: 'Financial Review' },
      { id: 'postqual', label: 'Post-Qualification' },
      { id: 'ranking', label: 'Final Ranking' },
      { id: 'report', label: 'Evaluation Report' }
    ];
  }
  if (type === 'SERVICE') {
    return [
      { id: 'opening', label: 'Opening Register' },
      { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
      { id: 'criteria', label: 'Custom Evaluation Criteria' },
      { id: 'pricing', label: 'Service Pricing Review' },
      { id: 'sla', label: 'SLA / Performance Review' },
      { id: 'postqual', label: 'Post-Qualification' },
      { id: 'ranking', label: 'Final Ranking' },
      { id: 'report', label: 'Evaluation Report' }
    ];
  }
  if (type === 'CONSULTANCY') {
    return [
      { id: 'opening', label: 'Opening Register' },
      { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
      { id: 'criteria', label: 'Custom Evaluation Criteria' },
      { id: 'financial', label: 'Financial Proposal Review' },
      { id: 'ranking', label: 'Selection Method / Ranking' },
      { id: 'postqual', label: 'Post-Qualification' },
      { id: 'report', label: 'Evaluation Report' }
    ];
  }
  return [
    { id: 'opening', label: 'Opening Register' },
    { id: 'administrative', label: 'Administrative & Eligibility Evaluation' },
    { id: 'criteria', label: 'Custom Evaluation Criteria' },
    { id: 'financial', label: 'Financial Review' },
    { id: 'postqual', label: 'Post-Qualification' },
    { id: 'ranking', label: 'Final Ranking' },
    { id: 'report', label: 'Evaluation Report' }
  ];
}

function workspaceLabel(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'Works Bid Evaluation';
  if (type === 'GOODS') return 'Goods Bid Evaluation';
  if (type === 'SERVICE') return 'Service Bid Evaluation';
  return 'Consultancy Bid Evaluation';
}

function workspaceHeroCopy(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'Manual evaluation of submitted works bids using published criteria, tender requirements, BOQ, methodology, personnel, and equipment.';
  if (type === 'SERVICE') return 'Manual evaluation of submitted service bids using published criteria, scope of services, personnel requirements, service schedule, SLA, and financial offer.';
  if (type === 'CONSULTANCY') return 'Manual evaluation of technical and financial consultancy proposals using the buyer published terms of reference and selection criteria.';
  return 'Manual evaluation using buyer-defined published criteria. The system organizes supplier submissions and calculates totals; the buyer makes every evaluation decision manually.';
}

function workspaceClass(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'works-evaluation-workspace';
  if (type === 'SERVICE') return 'service-evaluation-workspace';
  if (type === 'CONSULTANCY') return 'consultancy-evaluation-workspace';
  return 'goods-evaluation-workspace';
}

function typeLabel(value: string) {
  return humanizeEnum(value === 'SERVICE' ? 'SERVICES' : value);
}

function statusLabel(value: string | null) {
  if (!value) return 'Not started';
  return humanizeEnum(value);
}

function stageLabel(value: string | null) {
  if (!value) return 'Opening Register';
  const labels: Record<string, string> = {
    opening: 'Opening Register',
    OPENING: 'Opening Register',
    administrative: 'Administrative & Eligibility Evaluation',
    ELIGIBILITY: 'Administrative & Eligibility Evaluation',
    PRELIMINARY: 'Administrative & Eligibility Evaluation',
    criteria: 'Custom Evaluation Criteria',
    TECHNICAL: 'Custom Evaluation Criteria',
    financial: 'Financial Review',
    boq: 'Financial Review',
    pricing: 'Service Pricing Review',
    FINANCIAL: 'Financial Review',
    sla: 'SLA / Performance Review',
    postqual: 'Post-Qualification',
    CLARIFICATIONS: 'Post-Qualification',
    ranking: 'Final Ranking',
    COMPARISON: 'Final Ranking',
    report: 'Evaluation Report',
    REPORT: 'Evaluation Report',
    RECOMMENDATION: 'Evaluation Report'
  };
  return labels[value] ?? humanizeEnum(value);
}

function restoreStageId(savedStageId: string | null, stages: Array<{ id: EvaluationStageId; label: string }>): EvaluationStageId {
  const saved = stages.find((stage) => stage.id === savedStageId);
  return saved?.id ?? stages[0]?.id ?? 'opening';
}

function draftKey(bidId: string, criterionId: string) {
  return `${bidId}:${criterionId}`;
}

function decisionLabel(value: EvaluationDecisionStatus) {
  return humanizeEnum(value);
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

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const emptyDashboard: EvaluationDashboard = {
  publishedTenders: 0,
  readyToEvaluate: 0,
  draftedEvaluations: 0,
  lockedUntilClosing: 0,
  totalRecords: 0
};

const decisionOptions: EvaluationDecisionStatus[] = ['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED'];

const pageToRoute = {
  'create-tender': '/procurement/tenders/new',
  'bid-evaluation': '/evaluation',
  'award-recommendation': '/awards-contracts',
  'workspace-dashboard': '/dashboard',
  'sign-in': '/sign-in'
} as const;

type AppRouteKey = keyof typeof pageToRoute;
