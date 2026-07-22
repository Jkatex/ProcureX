/* Renders the evaluation Bid Evaluation ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { Fragment, type ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { evaluationApi } from '@/features/evaluation/api';
import { SignatureKeyphraseModal } from '@/shared/components/SignatureKeyphraseModal';
import { apiErrorMessage, isKeyphraseApiError } from '@/shared/api/errors';
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
type EvaluationStageId = 'opening' | 'preliminary' | 'technical' | 'financial' | 'verification' | 'ranking' | 'report';
type SectionDraftMap = Record<string, unknown>;
type SectionDecision = { decision?: string; remark?: string };
type SectionDefinition = { id: string; label: string; description: string; source?: string; keywords?: string[]; mandatory?: boolean };
type CustomCriterionDetails = {
  description: string;
  evaluationType: string;
  evidenceRequired: string[];
  mandatory: boolean;
  passFailGate: boolean;
  subcriteria: string[];
};
type CommercialReviewRow = {
  id: string;
  label: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number | null;
  source: string;
};
type CompletionState = {
  complete: number;
  total: number;
  percent: number;
  canComplete: boolean;
  blockingReasons: string[];
  firstBlockingStageId: EvaluationStageId;
};

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
  const [sectionDraft, setSectionDraft] = useState<SectionDraftMap>({});
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [showCompletionSignature, setShowCompletionSignature] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const reportPreviewRequestedRef = useRef(false);

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
        setSectionDraft({});
        setWorkspaceError('');
        return;
      }

      setWorkspaceLoading(true);
      setWorkspaceError('');

      try {
        const data = await evaluationApi.getWorkspace(selectedTenderId);
        if (!mounted) return;
        const workspaceStages = stagesForWorkspace(data);
        const restoredStageId = restoreStageId(data.summary.activeStageId, workspaceStages);
        const restoredBidId = data.summary.selectedBidId && data.bids.some((bid) => bid.id === data.summary.selectedBidId)
          ? data.summary.selectedBidId
          : data.bids[0]?.id ?? '';
        setWorkspace(data);
        setSelectedBidId(restoredBidId);
        setExpandedBidId('');
        setScoreDrafts(createScoreDrafts(data));
        setDecisionDrafts(createDecisionDrafts(data));
        setSectionDraft(data.sectionDraft ?? {});
        setActiveStageId(restoredStageId);
      } catch {
        if (!mounted) return;
        setWorkspace(null);
        setScoreDrafts({});
        setDecisionDrafts({});
        setSectionDraft({});
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
  const activeStages = workspace ? stagesForWorkspace(workspace) : stagesForType('GOODS');
  const normalizedStageId = activeStages.some((stage) => stage.id === activeStageId) ? activeStageId : activeStages[0].id;
  const rankings = useMemo(() => buildRankings(scoredBids), [scoredBids]);
  const completion = useMemo(() => completionState(workspace, scoredBids, sectionDraft), [scoredBids, sectionDraft, workspace]);

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
    setWorkspaceError('');
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
    setWorkspaceError('');
    setDecisionDrafts((current) => ({
      ...current,
      [bidId]: {
        ...(current[bidId] ?? { status: 'PENDING', comment: '' }),
        ...patch
      }
    }));
  }

  function updateSectionDraft(path: string[], patch: Record<string, unknown>) {
    setWorkspaceError('');
    setSectionDraft((current) => patchSectionDraft(current, path, patch));
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

  async function saveWorkspace(complete = false, signatureKeyphrase?: string) {
    if (!workspace?.tender || workspaceSaving) return;
    const nextCompletion = completionState(workspace, scoredBids, sectionDraft);
    const validation = complete ? validateWorkspaceDrafts(workspace, scoreDrafts, sectionDraft) : validateScoreDrafts(workspace, scoreDrafts);
    if (validation) {
      setWorkspaceError(validation);
      const firstInvalid = firstMissingScoreStage(workspace, scoreDrafts);
      setActiveStageId(firstInvalid);
      return;
    }
    if (complete && !signatureKeyphrase) {
      setSignatureError('');
      setShowCompletionSignature(true);
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
            const comment = criterion ? scoreCommentWithDecision(draft) : draft.comment;
            return [{ bidId, criterionId, score: Number(draft.score), comment }];
          }),
        decisions: Object.entries(decisionDrafts).map(([bidId, draft]) => ({
          bidId,
          status: draft.status,
          comment: draft.comment
        })),
        activeStageId: normalizedStageId,
        selectedBidId: selectedBidId || undefined,
        sectionDraft: {
          ...sectionDraft,
          completion: nextCompletion
        },
        complete,
        ...(complete && signatureKeyphrase ? { signatureKeyphrase } : {})
      });
      setShowCompletionSignature(false);
      setSignatureError('');
      setWorkspace(saved);
      setScoreDrafts(createScoreDrafts(saved));
      setDecisionDrafts(createDecisionDrafts(saved));
      setSectionDraft(saved.sectionDraft ?? {});
      await refreshLists();
      notifySuccess(complete ? 'Evaluation completed' : 'Evaluation saved', complete ? 'Evaluation workspace completed.' : 'Evaluation workspace saved.', {
        reason: complete ? 'Scores, decisions, ranking, and recommendation data were saved.' : 'Your current evaluation entries were saved as progress.'
      });
    } catch (error) {
      const message = evaluationSaveErrorMessage(error, t('evaluationApp.p5.errors.save'));
      setSignatureError(isKeyphraseApiError(error) ? message : '');
      setWorkspaceError(message);
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function previewReport() {
    reportPreviewRequestedRef.current = true;
    setActiveStageId('report');
    window.setTimeout(focusEvaluationReportPanel, 80);
  }

  useEffect(() => {
    if (activeStageId !== 'report' || !reportPreviewRequestedRef.current) return;
    reportPreviewRequestedRef.current = false;
    window.setTimeout(focusEvaluationReportPanel, 80);
  }, [activeStageId, workspace?.tender?.id]);

  return (
    <>
      <SignatureKeyphraseModal
        open={showCompletionSignature}
        title="Complete evaluation"
        actionLabel="Complete evaluation"
        isSubmitting={workspaceSaving}
        error={signatureError}
        onCancel={() => {
          setShowCompletionSignature(false);
          setSignatureError('');
        }}
        onConfirm={(signatureKeyphrase) => void saveWorkspace(true, signatureKeyphrase)}
      />
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
              onPreviewReport={previewReport}
              onSave={(complete) => void saveWorkspace(complete)}
              onScoreChange={updateScoreDraft}
              onSectionDraftChange={updateSectionDraft}
              onSelectBid={setSelectedBidId}
              onStageChange={setActiveStageId}
              onToggleBid={(bidId) => setExpandedBidId((current) => current === bidId ? '' : bidId)}
              rankings={rankings}
              saving={workspaceSaving}
              sectionDraft={sectionDraft}
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
  onSectionDraftChange,
  onSelectBid,
  onStageChange,
  onToggleBid,
  rankings,
  saving,
  sectionDraft,
  selectedBid,
  selectedBidId,
  stages,
  workspace,
  workspaceError,
  workspaceLoading
}: {
  activeStageId: EvaluationStageId;
  bids: EditableEvaluationBid[];
  completion: CompletionState;
  expandedBidId: string;
  formatDate: (value: string | null) => string;
  formatMoney: (value: number | null, currency: string) => string;
  onBack: () => void;
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
  onPreviewReport: () => void;
  onSave: (complete: boolean) => void;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  onSectionDraftChange: (path: string[], patch: Record<string, unknown>) => void;
  onSelectBid: (bidId: string) => void;
  onStageChange: (stageId: EvaluationStageId) => void;
  onToggleBid: (bidId: string) => void;
  rankings: ReturnType<typeof buildRankings>;
  saving: boolean;
  sectionDraft: SectionDraftMap;
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
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.id === activeStageId));
  const previousStage = stages[Math.max(0, activeIndex - 1)]?.id ?? activeStageId;
  const nextStage = stages[Math.min(stages.length - 1, activeIndex + 1)]?.id ?? activeStageId;
  const canMovePrevious = activeIndex > 0;
  const canMoveNext = activeIndex < stages.length - 1;

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

        {isBidderSpecificStage(activeStageId) ? <BidderTabs bids={bids} selectedBidId={selectedBidId} onSelectBid={onSelectBid} /> : null}
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
            onSectionDraftChange={onSectionDraftChange}
            onToggleBid={onToggleBid}
            rankings={rankings}
            sectionDraft={sectionDraft}
            selectedBid={selectedBid}
            workspace={workspace}
          />
        </div>

        <div className="evaluation-finish-panel">
          <div className="evaluation-finish-content">
            <span className="section-kicker">Complete {typeLabel(tender.procurementType).toLowerCase()} evaluation</span>
            <h3>{completion.canComplete ? 'Ready for buyer completion' : 'Complete all evaluation scores and recommendation'}</h3>
            <p>{completion.complete} of {completion.total} required checks are complete. Ranking and award recommendation remain manual buyer decisions.</p>
            {!completion.canComplete && completion.blockingReasons.length ? (
              <div className="evaluation-blocking-summary" aria-live="polite">
                <strong>Still needed</strong>
                <ul>
                  {completion.blockingReasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
          <div className="inline-actions">
            <button className="btn btn-secondary" type="button" disabled={saving || workspaceLoading} onClick={() => onSave(false)}>
              <SaveRoundedIcon fontSize="small" aria-hidden="true" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button className="btn btn-secondary" type="button" disabled={!canMovePrevious || saving || workspaceLoading} onClick={() => onStageChange(previousStage)}>Previous</button>
            <button className="btn btn-secondary" type="button" disabled={saving || workspaceLoading} onClick={() => {
              onSave(false);
              if (canMoveNext) onStageChange(nextStage);
            }}>Save and Continue</button>
            <button className="btn btn-secondary" type="button" disabled={!canMoveNext || saving || workspaceLoading} onClick={() => onStageChange(nextStage)}>Next</button>
            <button className="btn btn-secondary" type="button" onClick={onPreviewReport}>Preview Report</button>
            <button className="btn btn-secondary" type="button" onClick={() => window.print()}>Download Report</button>
            {!completion.canComplete ? (
              <button className="btn btn-secondary" type="button" disabled={saving || workspaceLoading} onClick={() => onStageChange(completion.firstBlockingStageId)}>Review missing checks</button>
            ) : null}
            <button className="btn btn-primary" type="button" disabled={!completion.canComplete || saving || workspaceLoading} onClick={() => onSave(true)}>Submit Evaluation</button>
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
  onSectionDraftChange,
  onToggleBid,
  rankings,
  sectionDraft,
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
  onSectionDraftChange: (path: string[], patch: Record<string, unknown>) => void;
  onToggleBid: (bidId: string) => void;
  rankings: ReturnType<typeof buildRankings>;
  sectionDraft: SectionDraftMap;
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
        <div className="evaluation-top-summary">
          <div><span>Total submitted bids</span><strong>{bids.length}</strong></div>
          <div><span>Opened bids</span><strong>{bids.filter((bid) => !isWithdrawnBid(bid) && !isLateBid(bid)).length}</strong></div>
          <div><span>Rejected at opening</span><strong>{bids.filter(isOpeningRejectedBid).length}</strong></div>
          <div><span>Withdrawn bids</span><strong>{bids.filter(isWithdrawnBid).length}</strong></div>
          <div><span>Late submissions</span><strong>{bids.filter(isLateBid).length}</strong></div>
        </div>
        <div className="evaluation-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Submitted</th>
                <th>Receipt number</th>
                <th>Original bid amount</th>
                <th>Discount</th>
                <th>Bid security</th>
                <th>Opening status</th>
                <th>Withdrawal / late status</th>
                <th>Opening remarks</th>
                <th>Submission</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <Fragment key={bid.id}>
                  <tr>
                    <td><strong>{bid.supplierName}</strong><span>{bid.reference}</span></td>
                    <td>{formatDate(bid.submittedAt)}</td>
                    <td>{bid.receiptRef || bid.receiptHash || '-'}</td>
                    <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                    <td>{bidResponseText(bid, /discount/i) || '-'}</td>
                    <td>{bidResponseText(bid, /bid.*security|security/i) || '-'}</td>
                    <td><span className={isOpeningRejectedBid(bid) ? 'badge badge-error' : 'badge badge-success'}>{isOpeningRejectedBid(bid) ? 'Rejected at opening' : 'Opened'}</span></td>
                    <td>{isWithdrawnBid(bid) ? 'Withdrawn' : isLateBid(bid) ? 'Late submission' : 'On time'}</td>
                    <td>{bidResponseText(bid, /opening.*remark|remark/i) || '-'}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onToggleBid(bid.id)}>
                        <OpenInNewRoundedIcon fontSize="small" aria-hidden="true" />
                        <span>{expandedBidId === bid.id ? 'Hide submission' : 'Open submission'}</span>
                      </button>
                    </td>
                  </tr>
                  {expandedBidId === bid.id ? (
                    <tr>
                      <td colSpan={10}><BidSubmissionDetail bid={bid} formatMoney={formatMoney} /></td>
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

  if (activeStageId === 'preliminary') {
    return (
      <ManualSectionReviewPanel
        bid={selectedBid}
        definitions={sectionDefinitionsForStage(workspace, 'preliminary')}
        sectionId="preliminary"
        sectionDraft={sectionDraft}
        title="Administrative & Eligibility Evaluation"
        onSectionDraftChange={onSectionDraftChange}
      />
    );
  }

  if (activeStageId === 'technical') {
    return (
      <TechnicalEvaluationPanel
        onScoreChange={onScoreChange}
        selectedBid={selectedBid}
        workspace={workspace}
      />
    );
  }

  if (activeStageId === 'financial') {
    return (
      <CommercialReviewPanel
        activeStageId={activeStageId}
        bids={bids}
        formatMoney={formatMoney}
        onSectionDraftChange={onSectionDraftChange}
        sectionDraft={sectionDraft}
        selectedBid={selectedBid}
        workspace={workspace}
        title="Financial Review"
      />
    );
  }

  if (activeStageId === 'verification') {
    const title = workspace.tender?.procurementType === 'CONSULTANCY' ? 'Due Diligence & Negotiation' : 'Verification / Post-Qualification';
    return (
      <ManualSectionReviewPanel
        bid={selectedBid}
        definitions={sectionDefinitionsForStage(workspace, activeStageId)}
        sectionId={activeStageId}
        sectionDraft={sectionDraft}
        title={title}
        onSectionDraftChange={onSectionDraftChange}
      />
    );
  }

  if (activeStageId === 'ranking') {
    return <RankingPanel bids={bids} onDecisionChange={onDecisionChange} rankings={rankings} sectionDraft={sectionDraft} workspace={workspace} />;
  }

  return <ReportPanel bids={bids} rankings={rankings} workspace={workspace} formatDate={formatDate} formatMoney={formatMoney} />;
}

function SupplierScoringPanel({
  bid,
  criteria,
  emptyMessage,
  workspace,
  onScoreChange
}: {
  bid: EditableEvaluationBid | null;
  criteria: EvaluationWorkspaceCriterion[];
  emptyMessage: string;
  workspace: EvaluationWorkspace;
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
}) {
  if (!bid) return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected." />;
  if (!criteria.length) return <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message={emptyMessage} />;

  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Criteria source: published tender</span>
          <h2>Custom Evaluation Criteria</h2>
          <p>These are the exact custom criteria configured for the tender. The system only displays evidence and totals; the buyer records the score or pass/fail decision.</p>
        </div>
        <span className="badge badge-info">{criteria.length} criteria</span>
      </div>
      <div className="evaluation-notice warning">The system does not create new criteria or decide the winner. Scores and decisions below are manual buyer entries.</div>
      <div className="goods-evaluation-card-list">
        {criteria.map((criterion, index) => {
          const score = bid.scoreDrafts?.[criterion.id] ?? { score: '', comment: '' };
          const details = customCriterionDetails(workspace, criterion);
          const isGate = isCustomCriterionGate(criterion, details);
          const evidence = matchingCriterionEvidence(bid, criterion, details);
          return (
            <article className="goods-evaluation-card" key={criterion.id}>
              <div>
                <span className="section-kicker">Criterion {index + 1} / {formatEvaluationType(details.evaluationType, isGate)}</span>
                <h3>{criterion.name}</h3>
                <p>{details.description || 'Buyer-defined criterion.'}</p>
                <div className="goods-criterion-meta">
                  <span>Weight: {criterion.weight ?? 0}</span>
                  <span>Max score: {criterion.maxScore}</span>
                  {details.mandatory ? <span>Mandatory</span> : null}
                  {details.passFailGate || isGate ? <span>Gate</span> : null}
                </div>
                {details.evidenceRequired.length ? <p>Evidence expected: {details.evidenceRequired.join(', ')}</p> : null}
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
                  <p>No matching submitted evidence was found. Review the full bid package before deciding.</p>
                )}
              </aside>
              <div className="evaluation-decision-panel">
                <label>
                  Buyer Decision
                  <select
                    className="form-input"
                    value={score.decision ?? ''}
                    onChange={(event) => {
                      const decision = event.target.value;
                      onScoreChange(bid.id, criterion.id, {
                        decision,
                        ...(isGate ? { score: decisionScore(decision, criterion) } : {})
                      });
                    }}
                  >
                    {criterionDecisionOptions(isGate).map((option) => (
                      <option key={option} value={option}>{option || 'Select decision'}</option>
                    ))}
                  </select>
                </label>
                {!isGate ? (
                  <label>
                    Buyer Score / {criterion.maxScore}
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      max={criterion.maxScore}
                      step="0.5"
                      value={score.score}
                      onChange={(event) => onScoreChange(bid.id, criterion.id, { score: event.target.value })}
                    />
                  </label>
                ) : null}
                <label className="wide">
                  Buyer comment
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

function TechnicalEvaluationPanel({
  onScoreChange,
  selectedBid,
  workspace
}: {
  onScoreChange: (bidId: string, criterionId: string, patch: Partial<ScoreDraft>) => void;
  selectedBid: EditableEvaluationBid | null;
  workspace: EvaluationWorkspace;
}) {
  const criteria = customEvaluationCriteria(workspace.criteria);
  if (!criteria.length) {
    return <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message="No custom evaluation criteria were configured for this tender." />;
  }

  return (
    <SupplierScoringPanel
      bid={selectedBid}
      criteria={criteria}
      emptyMessage="No buyer-defined evaluation criteria were configured for this tender."
      workspace={workspace}
      onScoreChange={onScoreChange}
    />
  );
}

function ManualSectionReviewPanel({
  bid,
  definitions,
  onSectionDraftChange,
  sectionDraft,
  sectionId,
  title
}: {
  bid: EditableEvaluationBid | null;
  definitions: SectionDefinition[];
  onSectionDraftChange: (path: string[], patch: Record<string, unknown>) => void;
  sectionDraft: SectionDraftMap;
  sectionId: EvaluationStageId;
  title: string;
}) {
  if (!bid) return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected." />;
  if (!definitions.length) return <EvaluationEmptyMessage icon={<RuleRoundedIcon fontSize="small" aria-hidden="true" />} message={emptyManualSectionMessage(sectionId, title)} />;

  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">{title}</span>
          <h2>{bid.supplierName}</h2>
          <p>{manualSectionDescription(sectionId)}</p>
        </div>
        <span className="badge badge-info">Manual review</span>
      </div>
      <div className="goods-evaluation-card-list">
        {definitions.map((definition) => {
          const decision = sectionDecision(sectionDraft, sectionId, bid.id, definition.id);
          const evidence = matchingSectionEvidence(bid, definition);
          return (
            <article className="goods-evaluation-card" key={definition.id}>
              <div>
                <span className="section-kicker">{definition.mandatory === false ? 'Optional' : 'Mandatory'} / {definition.source ?? 'Tender requirement'}</span>
                <h3>{definition.label}</h3>
                <p>{definition.description}</p>
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
                  <p>No matching submitted evidence was found. Review the full bid package before deciding.</p>
                )}
              </aside>
              <div className="evaluation-decision-panel">
                <label>
                  Buyer decision
                  <select
                    className="form-input"
                    value={decision.decision ?? ''}
                    onChange={(event) => onSectionDraftChange([sectionId, bid.id, definition.id], { decision: event.target.value })}
                  >
                    <option value="">Select decision</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Not Applicable">Not Applicable</option>
                    <option value="Clarification Required">Clarification Required</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </label>
                <label>
                  Remark
                  <textarea
                    className="form-input"
                    rows={3}
                    value={decision.remark ?? ''}
                    onChange={(event) => onSectionDraftChange([sectionId, bid.id, definition.id], { remark: event.target.value })}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CommercialReviewPanel({
  activeStageId,
  bids,
  formatMoney,
  onSectionDraftChange,
  sectionDraft,
  selectedBid,
  title,
  workspace
}: {
  activeStageId: EvaluationStageId;
  bids: EditableEvaluationBid[];
  formatMoney: (value: number | null, currency: string) => string;
  onSectionDraftChange: (path: string[], patch: Record<string, unknown>) => void;
  sectionDraft: SectionDraftMap;
  selectedBid: EditableEvaluationBid | null;
  title: string;
  workspace: EvaluationWorkspace;
}) {
  if (!selectedBid) {
    return <EvaluationEmptyMessage icon={<FolderOpenRoundedIcon fontSize="small" aria-hidden="true" />} message="No submitted supplier bid is selected for financial review." />;
  }

  const rows = commercialReviewRows(workspace, selectedBid);
  const calculation = financialCalculation(selectedBid);
  const financialScores = localFinancialScores(bids);
  const financialDocuments = financialEvidenceDocuments(selectedBid);
  const type = workspace.tender?.procurementType ?? 'GOODS';
  const pricingStatus = bidResponseText(selectedBid, /pricing.*status|financial.*status|boq.*status|commercial.*status/i) || 'Pending line review';

  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Financial review, not automatic scoring</span>
          <h2>{financialReviewHeading(type)}</h2>
          <p>{financialReviewCopy(type)}</p>
        </div>
        <span className="badge badge-info">{formatMoney(calculation.evaluatedPrice, selectedBid.currency)}</span>
      </div>

      <div className="evaluation-financial-review">
        <div><span>Read-out price</span><strong>{formatMoney(calculation.original, selectedBid.currency)}</strong></div>
        <div><span>Corrected / evaluated price</span><strong>{formatMoney(calculation.evaluatedPrice, selectedBid.currency)}</strong></div>
        <div><span>Discount</span><strong>{calculation.discounts ? formatMoney(calculation.discounts, selectedBid.currency) : 'None recorded'}</strong></div>
        <div><span>Pricing status</span><strong>{pricingStatus}</strong></div>
      </div>

      <details className="evaluation-bid-document-review" open>
        <summary>Financial evidence</summary>
        {financialDocuments.length ? (
          <div className="goods-evaluation-card-list">
            {financialDocuments.map((document) => (
              <article className="goods-evidence-panel" key={document.id}>
                <strong>{document.documentType || 'Financial document'}</strong>
                <p>{document.name}</p>
                <div className="evaluation-document-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => openEvidenceMetadata(document)}>View</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => downloadEvidenceMetadata(document)}>Download</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>No submitted financial documents matched the financial review keywords. Review the full bid package before deciding.</p>
        )}
      </details>

      <div className="evaluation-table-scroll">
        <table className={`${commercialTableClass(type)} goods-evaluation-table`}>
          <thead>
            <tr>
              <th>{commercialLineLabel(type)}</th>
              <th>Requirement / description</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Supplier rate</th>
              <th>Total</th>
              <th>Buyer check</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const decision = sectionDecision(sectionDraft, activeStageId, selectedBid.id, row.id);
              return (
                <tr key={row.id}>
                  <td><strong>{row.label}</strong><span>{row.source}</span></td>
                  <td>{row.description}</td>
                  <td>{row.quantity ?? '-'}</td>
                  <td>{row.unit ?? '-'}</td>
                  <td>{row.rate === null ? '-' : formatMoney(row.rate, selectedBid.currency)}</td>
                  <td>{row.total === null ? '-' : formatMoney(row.total, selectedBid.currency)}</td>
                  <td>
                    <select
                      className="form-input"
                      value={decision.decision ?? ''}
                      onChange={(event) => onSectionDraftChange([activeStageId, selectedBid.id, row.id], { decision: event.target.value })}
                    >
                      <option value="">Select check</option>
                      {financialLineCheckOptions(type).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      value={decision.remark ?? ''}
                      onChange={(event) => onSectionDraftChange([activeStageId, selectedBid.id, row.id], { remark: event.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="evaluation-boq-comparison">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">{title}</span>
            <h2>Bidder price comparison</h2>
            <p>Evaluated bid price uses original price plus corrections, minus discounts, plus evaluation adjustments.</p>
          </div>
          <span className="badge badge-info">{bids.length} opened bids</span>
        </div>
        <div className="evaluation-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Original bid price</th>
                <th>Corrections</th>
                <th>Discounts</th>
                <th>Adjustments</th>
                <th>Evaluated bid price</th>
                <th>Financial score</th>
                <th>Technical score</th>
                <th>Combined / total score</th>
                <th>Financial status</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => {
                const bidCalculation = financialCalculation(bid);
                const bidScore = financialScores.get(bid.id) ?? bid.financialScore;
                return (
                  <tr key={bid.id}>
                    <td><strong>{bid.supplierName}</strong></td>
                    <td>{formatMoney(bid.financialAmount, bid.currency)}</td>
                    <td>{formatMoney(bidCalculation.corrections, bid.currency)}</td>
                    <td>{formatMoney(bidCalculation.discounts, bid.currency)}</td>
                    <td>{formatMoney(bidCalculation.adjustments, bid.currency)}</td>
                    <td>{formatMoney(bidCalculation.evaluatedPrice, bid.currency)}</td>
                    <td>{bidScore === null || bidScore === undefined ? '-' : `${bidScore}%`}</td>
                    <td>{bid.technicalScore === null ? '-' : `${bid.technicalScore}%`}</td>
                    <td>{bid.totalScore === null ? '-' : `${bid.totalScore}%`}</td>
                    <td><span className={isFinanciallyEligible(workspace, sectionDraft, bid) ? 'badge badge-success' : 'badge badge-warning'}>{isFinanciallyEligible(workspace, sectionDraft, bid) ? 'Eligible' : 'Held'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function RankingPanel({
  bids,
  onDecisionChange,
  rankings,
  sectionDraft,
  workspace
}: {
  bids: EditableEvaluationBid[];
  onDecisionChange: (bidId: string, patch: Partial<DecisionDraft>) => void;
  rankings: ReturnType<typeof buildRankings>;
  sectionDraft: SectionDraftMap;
  workspace: EvaluationWorkspace;
}) {
  return (
    <section className="evaluation-section-workspace">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Ranking & Recommendation</span>
          <h2>Consolidated supplier comparison</h2>
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
                <th>Preliminary result</th>
                <th>Technical score</th>
                <th>Evaluated price</th>
                <th>Financial score</th>
                <th>Total score</th>
                <th>Post-qualification result</th>
                <th>Decision</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row) => {
                const bid = bids.find((item) => item.id === row.bidId);
                const calculation = bid ? financialCalculation(bid) : null;
                return (
                  <tr key={row.bidId}>
                    <td>{row.rank}</td>
                    <td><strong>{row.bidderName}</strong></td>
                    <td>{bid ? stageResultLabel(sectionDraft, 'preliminary', bid.id) : '-'}</td>
                    <td>{row.technicalScore === null ? '-' : `${row.technicalScore}%`}</td>
                    <td>{bid && calculation ? `${bid.currency} ${calculation.evaluatedPrice.toLocaleString()}` : '-'}</td>
                    <td>{row.financialScore === null ? '-' : `${row.financialScore}%`}</td>
                    <td>{row.totalScore}%</td>
                    <td>{bid ? stageResultLabel(sectionDraft, 'verification', bid.id) : '-'}</td>
                    <td><span className="badge badge-info">{decisionLabel(row.decisionStatus)}</span></td>
                    <td>{row.commentSummary || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <EvaluationEmptyMessage icon={<LeaderboardRoundedIcon fontSize="small" aria-hidden="true" />} message="No evaluated bidders yet. Ranking will appear after scores are entered." />}
      <div className="evaluation-requirement-list">
        {bids.map((bid) => {
          const blockedReason = recommendationBlockReason(workspace, sectionDraft, bid);
          return (
            <article className="evaluation-requirement-row" key={bid.id}>
              <div className="evaluation-requirement-main">
                <span className="section-kicker">Final buyer decision</span>
                <h3>{bid.supplierName}</h3>
                <p>{blockedReason || (bid.totalScore === null ? 'Complete scoring and section checks before recommendation.' : `${bid.totalScore}% current total score`)}</p>
              </div>
              <div className="evaluation-evidence-panel">
                <strong>Ranking context</strong>
                <div className="evaluation-evidence-item">
                  <span>{bid.reference}</span>
                  <p>{bid.financialAmount === null ? 'No financial offer amount captured' : `${bid.currency} ${bid.financialAmount.toLocaleString()}`}</p>
                </div>
              </div>
              <div className="evaluation-decision-panel">
                <label>
                  Decision
                  <select className="form-input" value={bid.decisionStatus} onChange={(event) => onDecisionChange(bid.id, { status: event.target.value as EvaluationDecisionStatus })}>
                    {decisionOptions.map((option) => (
                      <option key={option} value={option} disabled={option === 'RECOMMENDED' && Boolean(blockedReason)}>{decisionLabel(option)}</option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Recommendation reason
                  <textarea className="form-input evaluation-p5-comment" value={bid.decisionComment} onChange={(event) => onDecisionChange(bid.id, { comment: event.target.value })} />
                </label>
              </div>
            </article>
          );
        })}
      </div>
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
    <section className="evaluation-section-workspace" data-evaluation-report-panel tabIndex={-1}>
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
      const parsedComment = parseScoreComment(existing?.comment ?? '');
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
      const parsedComment = parseScoreComment(draft?.comment ?? '');
      return {
        criterionId: criterion.id,
        score: Number.isFinite(parsedScore) ? parsedScore : null,
        comment: parsedComment.remark,
        evaluatorName: bid.scores.find((score) => score.criterionId === criterion.id)?.evaluatorName ?? null,
        evaluatedAt: bid.scores.find((score) => score.criterionId === criterion.id)?.evaluatedAt ?? null
      };
    });
    const technical = localTechnicalScore(technicalCriteria(workspace.criteria), scores);
    const financialScore = financial.get(bid.id) ?? bid.financialScore;
    const decision = decisionDrafts[bid.id] ?? { status: bid.decisionStatus, comment: bid.decisionComment };
    const commentSummary = decision.comment || scores.find((score) => score.comment)?.comment || '';
    return {
      ...bid,
      scores,
      scoreDrafts: Object.fromEntries(workspace.criteria.map((criterion) => [criterion.id, scoreDrafts[draftKey(bid.id, criterion.id)] ?? { score: '', comment: '' }])),
      technicalScore: technical,
      financialScore,
      totalScore: localTotalScore(workspace, technical, financialScore),
      evaluated: technical !== null || financialScore !== null,
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
    .map((bid) => ({ bidId: bid.id, amount: financialCalculation(bid).evaluatedPrice }))
    .filter((row): row is { bidId: string; amount: number } => typeof row.amount === 'number' && row.amount > 0);
  const lowest = Math.min(...amounts.map((row) => row.amount));
  const scores = new Map<string, number>();
  if (!Number.isFinite(lowest)) return scores;
  for (const row of amounts) scores.set(row.bidId, roundScore((lowest / row.amount) * 100));
  return scores;
}

function localTotalScore(workspace: EvaluationWorkspace, technical: number | null, financial: number | null) {
  const technicalWeight = workspace.evaluationConfiguration?.technicalWeight ?? null;
  const financialWeight = workspace.evaluationConfiguration?.financialWeight ?? null;
  if (technical !== null && financial !== null && technicalWeight !== null && financialWeight !== null && technicalWeight + financialWeight > 0) {
    return roundScore((technical * technicalWeight + financial * financialWeight) / (technicalWeight + financialWeight));
  }
  if (technical !== null && financial !== null && workspace.tender?.procurementType === 'CONSULTANCY') {
    return roundScore((technical * 0.8) + (financial * 0.2));
  }
  return technical ?? financial;
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

function completionState(workspace: EvaluationWorkspace | null, bids: EditableEvaluationBid[], sectionDraft: SectionDraftMap): CompletionState {
  if (!workspace) {
    return {
      complete: 0,
      total: 0,
      percent: 0,
      canComplete: false,
      blockingReasons: ['Open an evaluation workspace before submitting.'],
      firstBlockingStageId: 'opening'
    };
  }
  const scoreCriteria = scoreCriteriaForCompletion(workspace);
  const scoreTotal = scoreCriteria.length * bids.length;
  const scoreComplete = bids.reduce(
    (sum, bid) => sum + scoreCriteria.filter((criterion) => {
      if (workspace.tender?.procurementType === 'GOODS' && isAdministrativeCriterion(criterion)) {
        return isGoodsAdministrativeDraftComplete(bid.scoreDrafts?.[criterion.id]);
      }
      const score = bid.scores.find((item) => item.criterionId === criterion.id)?.score;
      return score !== null && score !== undefined && score <= criterion.maxScore;
    }).length,
    0
  );
  const manualSections = requiredManualStages(workspace);
  const manualDefinitions = manualSections.flatMap((stageId) => sectionDefinitionsForStage(workspace, stageId).map((definition) => ({ stageId, definition })));
  const manualTotal = manualDefinitions.length * bids.length;
  const manualComplete = bids.reduce(
    (sum, bid) => sum + manualDefinitions.filter(({ stageId, definition }) => isSectionDecisionComplete(sectionDecision(sectionDraft, stageId, bid.id, definition.id))).length,
    0
  );
  const rankingTotal = bids.length;
  const rankingComplete = bids.filter((bid) => isFinalDecisionComplete(bid)).length;
  const total = scoreTotal + manualTotal + rankingTotal;
  const complete = scoreComplete + manualComplete + rankingComplete;
  const percent = total > 0 ? Math.round((complete / total) * 100) : 0;
  const hasRecommendation = bids.some((bid) => bid.decisionStatus === 'RECOMMENDED' && !recommendationBlockReason(workspace, sectionDraft, bid));
  const allRejected = bids.length > 0 && bids.every((bid) => bid.decisionStatus === 'FAILED' && bid.decisionComment.trim());
  const blockers = completionBlockers(workspace, bids, sectionDraft, scoreCriteria, manualDefinitions, {
    scoreComplete,
    scoreTotal,
    manualComplete,
    manualTotal,
    rankingComplete,
    rankingTotal,
    hasRecommendation,
    allRejected
  });
  return {
    complete,
    total,
    percent,
    canComplete: total > 0 && complete === total && (hasRecommendation || allRejected),
    blockingReasons: blockers.reasons,
    firstBlockingStageId: blockers.firstStageId
  };
}

function completionBlockers(
  workspace: EvaluationWorkspace,
  bids: EditableEvaluationBid[],
  sectionDraft: SectionDraftMap,
  scoreCriteria: EvaluationWorkspaceCriterion[],
  manualDefinitions: Array<{ stageId: EvaluationStageId; definition: SectionDefinition }>,
  state: {
    scoreComplete: number;
    scoreTotal: number;
    manualComplete: number;
    manualTotal: number;
    rankingComplete: number;
    rankingTotal: number;
    hasRecommendation: boolean;
    allRejected: boolean;
  }
) {
  const reasons: string[] = [];
  let firstStageId: EvaluationStageId = 'ranking';

  if (state.scoreComplete < state.scoreTotal) {
    const missing = firstMissingScoreCriterion(workspace, bids, scoreCriteria);
    firstStageId = missing?.stageId ?? 'technical';
    reasons.push(missing?.reason ?? 'Enter all custom evaluation scores for every bidder.');
  }

  if (state.manualComplete < state.manualTotal) {
    const missing = firstMissingManualDecision(workspace, bids, sectionDraft, manualDefinitions);
    if (!reasons.length) firstStageId = missing?.stageId ?? 'preliminary';
    reasons.push(missing?.reason ?? 'Complete all manual section decisions and required remarks.');
  }

  if (state.rankingComplete < state.rankingTotal) {
    if (!reasons.length) firstStageId = 'ranking';
    reasons.push('Add final decision reasons for any recommended, failed, or clarification-required bidders.');
  }

  const recommendedBid = bids.find((bid) => bid.decisionStatus === 'RECOMMENDED');
  const recommendedBlockReason = recommendedBid ? recommendationBlockReason(workspace, sectionDraft, recommendedBid) : '';
  if (recommendedBlockReason) {
    if (!reasons.length) firstStageId = 'ranking';
    reasons.push(`Recommended bidder is blocked: ${recommendedBlockReason}`);
  }

  if (!state.hasRecommendation && !state.allRejected) {
    if (!reasons.length) firstStageId = 'ranking';
    reasons.push('In Ranking & Recommendation, mark one bidder as Recommended with a reason, or mark all bidders Failed with reasons.');
  }

  return { reasons: uniqueReasons(reasons), firstStageId };
}

function firstMissingScoreCriterion(workspace: EvaluationWorkspace, bids: EditableEvaluationBid[], criteria: EvaluationWorkspaceCriterion[]) {
  for (const bid of bids) {
    for (const criterion of criteria) {
      const score = bid.scores.find((item) => item.criterionId === criterion.id)?.score;
      if (score === null || score === undefined || score > criterion.maxScore) {
        return {
          stageId: 'technical' as EvaluationStageId,
          reason: `Enter a valid score for ${bid.supplierName} on ${criterion.name}.`
        };
      }
      const draft = bid.scoreDrafts?.[criterion.id];
      if (draft?.decision && isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) {
        return {
          stageId: 'technical' as EvaluationStageId,
          reason: `Add a buyer comment for ${bid.supplierName} on ${criterion.name}.`
        };
      }
    }
  }
  void workspace;
  return null;
}

function firstMissingManualDecision(
  workspace: EvaluationWorkspace,
  bids: EditableEvaluationBid[],
  sectionDraft: SectionDraftMap,
  manualDefinitions: Array<{ stageId: EvaluationStageId; definition: SectionDefinition }>
) {
  for (const bid of bids) {
    for (const { stageId, definition } of manualDefinitions) {
      const decision = sectionDecision(sectionDraft, stageId, bid.id, definition.id);
      if (!decision.decision) {
        return {
          stageId,
          reason: `Complete ${stageLabel(stageId)} for ${bid.supplierName}: ${definition.label}.`
        };
      }
      if (isNegativeSectionDecision(decision.decision) && !String(decision.remark ?? '').trim()) {
        return {
          stageId,
          reason: `Add a remark for ${bid.supplierName}: ${definition.label}.`
        };
      }
    }
  }
  void workspace;
  return null;
}

function uniqueReasons(reasons: string[]) {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function validateWorkspaceDrafts(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap, sectionDraft: SectionDraftMap) {
  const scoreValidation = validateScoreDrafts(workspace, scoreDrafts);
  if (scoreValidation) return scoreValidation;
  for (const bid of workspace.bids) {
    for (const stageId of requiredManualStages(workspace)) {
      for (const definition of sectionDefinitionsForStage(workspace, stageId)) {
        const decision = sectionDecision(sectionDraft, stageId, bid.id, definition.id);
        if (isNegativeSectionDecision(decision.decision) && !String(decision.remark ?? '').trim()) {
          return `Add a remark for ${definition.label} when the decision is failed, rejected, or clarification required.`;
        }
      }
    }
  }
  return '';
}

function validateScoreDrafts(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap) {
  for (const bid of workspace.bids) {
    for (const criterion of scoreCriteriaForCompletion(workspace)) {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      if (workspace.tender?.procurementType === 'GOODS' && isAdministrativeCriterion(criterion)) {
        if (!draft?.decision && draft?.score) return 'Select a buyer decision for every goods administrative check with a score.';
        if (draft?.decision && isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) {
          return 'Add a remark for failed or clarification-required administrative checks.';
        }
      }
      if (draft?.decision && isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) {
        return 'Add a buyer comment for failed, non-responsive, or clarification-required custom criteria.';
      }
      if (!draft || draft.score === '') continue;
      const score = Number(draft.score);
      if (!Number.isFinite(score) || score < 0) return 'Scores must be valid positive numbers.';
      if (score > criterion.maxScore) return 'Score cannot exceed the criterion maximum score.';
    }
  }
  return '';
}

function evaluationSaveErrorMessage(error: unknown, fallback: string) {
  const sharedMessage = apiErrorMessage(error, '');
  if (sharedMessage) return sharedMessage;
  const response = (error as { response?: { data?: { message?: unknown; error?: unknown } }; message?: unknown }).response;
  const serverMessage = response?.data?.message ?? response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage.trim();
  const clientMessage = (error as { message?: unknown }).message;
  if (typeof clientMessage === 'string' && clientMessage.trim()) return clientMessage.trim();
  return fallback;
}

function firstMissingScoreStage(workspace: EvaluationWorkspace, scoreDrafts: ScoreDraftMap): EvaluationStageId {
  const missing = scoreCriteriaForCompletion(workspace).find((criterion) =>
    workspace.bids.some((bid) => {
      const draft = scoreDrafts[draftKey(bid.id, criterion.id)];
      return !draft || draft.score === '';
    })
  );
  if (!missing) return 'technical';
  return 'technical';
}

function focusEvaluationReportPanel() {
  const panel = document.querySelector<HTMLElement>('[data-evaluation-report-panel]');
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.focus({ preventScroll: true });
}

function scoreCriteriaForCompletion(workspace: EvaluationWorkspace) {
  return workspace.criteria.filter((criterion) => !isAdministrativeCriterion(criterion));
}

function requiredManualStages(workspace: EvaluationWorkspace): EvaluationStageId[] {
  void workspace;
  return ['preliminary', 'financial', 'verification'];
}

function sectionDefinitionsForStage(workspace: EvaluationWorkspace, stageId: EvaluationStageId): SectionDefinition[] {
  const sectionIds = legacyStageAliases(stageId);
  const items = workspace.evaluationConfiguration?.sections
    .filter((item) => sectionIds.includes(item.id))
    .flatMap((section) => section.items) ?? [];
  return items
    .filter((item) => !((stageId === 'technical' || stageId === 'financial') && item.source === 'evaluation criteria'))
    .map((item) => ({
    id: item.id,
    label: item.title,
    description: item.description || item.category,
    source: item.source,
    keywords: wordsFrom(`${item.title} ${item.description} ${item.category} ${item.evidenceRequired.join(' ')}`),
    mandatory: item.mandatory
  }));
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function wordsFrom(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
}

function legacyStageAliases(stageId: EvaluationStageId) {
  const aliases: Record<EvaluationStageId, string[]> = {
    opening: ['opening'],
    preliminary: ['preliminary', 'administrative'],
    technical: ['technical', 'criteria', 'tor'],
    financial: ['financial', 'boq', 'pricing'],
    verification: ['verification', 'postqual', 'sla'],
    ranking: ['ranking'],
    report: ['report']
  };
  return aliases[stageId];
}

function sectionDecision(sectionDraft: SectionDraftMap, sectionId: EvaluationStageId, bidId: string, itemId: string): SectionDecision {
  let row: Record<string, unknown> = {};
  for (const candidateId of legacyStageAliases(sectionId)) {
    const section = objectValue(sectionDraft[candidateId]);
    const bid = objectValue(section[bidId]);
    row = objectValue(bid[itemId]);
    if (row.decision || row.remark) break;
  }
  return {
    decision: typeof row.decision === 'string' ? row.decision : '',
    remark: typeof row.remark === 'string' ? row.remark : ''
  };
}

function patchSectionDraft(current: SectionDraftMap, path: string[], patch: Record<string, unknown>): SectionDraftMap {
  const [sectionId, bidId, itemId] = path;
  if (!sectionId || !bidId || !itemId) return current;
  const section = objectValue(current[sectionId]);
  const bid = objectValue(section[bidId]);
  const row = objectValue(bid[itemId]);
  return {
    ...current,
    [sectionId]: {
      ...section,
      [bidId]: {
        ...bid,
        [itemId]: {
          ...row,
          ...patch
        }
      }
    }
  };
}

function matchingSectionEvidence(bid: EditableEvaluationBid, definition: SectionDefinition) {
  const keywords = definition.keywords?.length ? definition.keywords : wordsFrom(`${definition.label} ${definition.description}`);
  return bid.documents.filter((document) => {
    const haystack = `${document.name} ${document.documentType}`.toLowerCase();
    return keywords.some((word) => haystack.includes(word));
  }).slice(0, 2);
}

function emptyManualSectionMessage(sectionId: EvaluationStageId, title: string) {
  if (sectionId === 'preliminary') return 'No preliminary or eligibility requirements were configured for this tender.';
  if (sectionId === 'financial') return 'No financial or commercial review lines were configured for this tender.';
  if (sectionId === 'verification') return 'No verification or post-qualification requirements were configured for this tender.';
  return `No ${title.toLowerCase()} checks were configured for this tender.`;
}

function manualSectionDescription(sectionId: EvaluationStageId) {
  if (sectionId === 'preliminary') return 'Pass/fail review of mandatory eligibility, regulatory, document, and declaration checks.';
  return 'Record the buyer committee decision for each required check. Failed, rejected, and clarification-required outcomes need a remark.';
}

function matchingCriterionEvidence(bid: EditableEvaluationBid, criterion: EvaluationWorkspaceCriterion, details: CustomCriterionDetails) {
  const keywords = wordsFrom(`${criterion.name} ${criterion.category} ${details.description} ${details.subcriteria.join(' ')} ${details.evidenceRequired.join(' ')}`);
  return bid.documents.filter((document) => {
    const haystack = `${document.name} ${document.documentType}`.toLowerCase();
    return keywords.some((word) => haystack.includes(word));
  }).slice(0, 3);
}

function isSectionDecisionComplete(decision: SectionDecision) {
  if (!decision.decision) return false;
  if (isNegativeSectionDecision(decision.decision) && !String(decision.remark ?? '').trim()) return false;
  return true;
}

function isNegativeSectionDecision(decision = '') {
  return /fail|clarification|required|rejected|non-responsive|not qualified|non-compliant/i.test(decision);
}

function isFinalDecisionComplete(bid: EditableEvaluationBid) {
  if (bid.decisionStatus === 'PENDING') return false;
  if ((bid.decisionStatus === 'FAILED' || bid.decisionStatus === 'NEEDS_CLARIFICATION' || bid.decisionStatus === 'RECOMMENDED') && !bid.decisionComment.trim()) return false;
  return true;
}

function customEvaluationCriteria(criteria: EvaluationWorkspaceCriterion[]) {
  return criteria.filter((criterion) => !isAdministrativeCriterion(criterion));
}

function technicalCriteria(criteria: EvaluationWorkspaceCriterion[]) {
  return criteria.filter((criterion) => !isAdministrativeCriterion(criterion) && !isFinancialCriterion(criterion));
}

function customCriterionDetails(workspace: EvaluationWorkspace, criterion: EvaluationWorkspaceCriterion): CustomCriterionDetails {
  const config = workspace.evaluationConfiguration?.evaluationCriteria.find((item) => item.id === `criterion-${criterion.id}`);
  const payload = objectValue(config?.payload);
  const evaluationType = textFromUnknown(payload.evaluationType, payload.type, payload.scoringType) || (criterion.maxScore <= 1 ? 'pass_fail' : 'scored');
  const subcriteria = textListFromUnknown(payload.subcriteria);
  return {
    description: config?.description && config.description !== criterion.category ? config.description : textFromUnknown(payload.description, payload.scoringGuide, payload.requirement),
    evaluationType,
    evidenceRequired: config?.evidenceRequired?.length ? config.evidenceRequired : textListFromUnknown(payload.evidenceRequired),
    mandatory: Boolean(config?.mandatory || payload.mandatory === true),
    passFailGate: Boolean(payload.passFailGate === true || payload.gate === true || /pass.?fail|document_check|mandatory/i.test(evaluationType)),
    subcriteria
  };
}

function isCustomCriterionGate(criterion: EvaluationWorkspaceCriterion, details: CustomCriterionDetails) {
  return details.passFailGate || criterion.maxScore <= 1;
}

function formatEvaluationType(value: string, isGate: boolean) {
  if (isGate) return 'Pass / fail';
  return value ? humanizeEnum(value) : 'Scored';
}

function criterionDecisionOptions(isGate: boolean) {
  return isGate
    ? ['', 'Pass', 'Fail', 'Not Applicable', 'Clarification Required']
    : ['', 'Pass', 'Fail', 'Responsive', 'Non-responsive', 'Clarification Required', 'Not Applicable'];
}

function decisionScore(decision: string, criterion: EvaluationWorkspaceCriterion) {
  if (/^pass$|responsive|not applicable/i.test(decision)) return String(criterion.maxScore);
  if (/fail|non-responsive/i.test(decision)) return '0';
  return '';
}

function textFromUnknown(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      const text = value.map((item) => textFromUnknown(item)).filter(Boolean).join(', ');
      if (text) return text;
    }
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      const text = textFromUnknown(object.title, object.label, object.name, object.description, object.value, object.requirement);
      if (text) return text;
    }
  }
  return '';
}

function textListFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => textFromUnknown(item)).filter(Boolean);
  const text = textFromUnknown(value);
  return text ? text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) : [];
}

function isAdministrativeCriterion(criterion: EvaluationWorkspaceCriterion) {
  return criterion.stage === 'ELIGIBILITY' || /administrative|eligibility|mandatory document|required document|preliminary/i.test(`${criterion.name} ${criterion.category}`);
}

function scoreCommentWithDecision(draft: ScoreDraft) {
  const decision = draft.decision?.trim();
  const remark = draft.comment.trim();
  return decision ? `[Decision: ${decision}]${remark ? `\n${remark}` : ''}` : remark;
}

function parseScoreComment(comment = '') {
  const match = comment.match(/^\[Decision:\s*([^\]]+)\]\s*/i);
  if (!match) return { decision: '', remark: comment };
  return {
    decision: match[1].trim(),
    remark: comment.slice(match[0].length)
  };
}

function isGoodsManualDecisionNegative(decision = '') {
  return /fail|clarification|required|rejected|non-responsive|not qualified|non-compliant/i.test(decision);
}

function isGoodsAdministrativeDraftComplete(draft: ScoreDraft | undefined) {
  if (!draft?.decision) return false;
  if (isGoodsManualDecisionNegative(draft.decision) && !draft.comment.trim()) return false;
  return true;
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

function stagesForWorkspace(workspace: EvaluationWorkspace): Array<{ id: EvaluationStageId; label: string }> {
  const configured = workspace.evaluationConfiguration?.stages
    .map((stage) => ({ id: normalizeStageId(stage.id), label: stageLabel(stage.id) }))
    .filter((stage): stage is { id: EvaluationStageId; label: string } => Boolean(stage.id))
    .filter((stage, index, stages) => stages.findIndex((candidate) => candidate.id === stage.id) === index);
  return configured?.length ? configured : workspace.tender ? stagesForType(workspace.tender.procurementType) : stagesForType('GOODS');
}

function isBidderSpecificStage(stageId: EvaluationStageId) {
  return stageId === 'preliminary' || stageId === 'technical' || stageId === 'financial' || stageId === 'verification';
}

function isEvaluationStageId(value: string): value is EvaluationStageId {
  return ['opening', 'preliminary', 'technical', 'financial', 'verification', 'ranking', 'report'].includes(value);
}

function normalizeStageId(value: string | null): EvaluationStageId | null {
  if (!value) return null;
  if (isEvaluationStageId(value)) return value;
  const aliases: Record<string, EvaluationStageId> = {
    OPENING: 'opening',
    administrative: 'preliminary',
    ELIGIBILITY: 'preliminary',
    PRELIMINARY: 'preliminary',
    criteria: 'technical',
    TECHNICAL: 'technical',
    tor: 'technical',
    financial: 'financial',
    boq: 'financial',
    pricing: 'financial',
    FINANCIAL: 'financial',
    postqual: 'verification',
    sla: 'verification',
    verification: 'verification',
    CLARIFICATIONS: 'verification',
    ranking: 'ranking',
    COMPARISON: 'ranking',
    report: 'report',
    REPORT: 'report',
    RECOMMENDATION: 'report'
  };
  return aliases[value] ?? null;
}

function stagesForType(type: Exclude<ProcurementTypeFilter, 'all'>): Array<{ id: EvaluationStageId; label: string }> {
  void type;
  return [
    { id: 'opening', label: 'Opening Register' },
    { id: 'preliminary', label: 'Administrative & Eligibility Evaluation' },
    { id: 'technical', label: 'Custom Evaluation Criteria' },
    { id: 'financial', label: 'Financial Review' },
    { id: 'verification', label: 'Verification / Post-Qualification' },
    { id: 'ranking', label: 'Ranking & Recommendation' },
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
    preliminary: 'Administrative & Eligibility Evaluation',
    administrative: 'Administrative & Eligibility Evaluation',
    ELIGIBILITY: 'Administrative & Eligibility Evaluation',
    PRELIMINARY: 'Administrative & Eligibility Evaluation',
    technical: 'Custom Evaluation Criteria',
    criteria: 'Custom Evaluation Criteria',
    TECHNICAL: 'Custom Evaluation Criteria',
    tor: 'Custom Evaluation Criteria',
    financial: 'Financial Review',
    boq: 'Financial Review',
    pricing: 'Financial Review',
    FINANCIAL: 'Financial Review',
    verification: 'Verification / Post-Qualification',
    sla: 'Verification / Post-Qualification',
    postqual: 'Verification / Post-Qualification',
    CLARIFICATIONS: 'Verification / Post-Qualification',
    ranking: 'Ranking & Recommendation',
    COMPARISON: 'Ranking & Recommendation',
    report: 'Evaluation Report',
    REPORT: 'Evaluation Report',
    RECOMMENDATION: 'Evaluation Report'
  };
  return labels[value] ?? humanizeEnum(value);
}

function restoreStageId(savedStageId: string | null, stages: Array<{ id: EvaluationStageId; label: string }>): EvaluationStageId {
  const normalized = normalizeStageId(savedStageId);
  const saved = stages.find((stage) => stage.id === normalized);
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

function bidResponseText(bid: EvaluationWorkspaceBid, pattern: RegExp) {
  const match = bid.responses.find((response) => pattern.test(`${response.requirementKey} ${formatResponse(response.response)}`));
  return match ? formatResponse(match.response) : '';
}

function numericBidResponse(bid: EvaluationWorkspaceBid, pattern: RegExp) {
  const text = bidResponseText(bid, pattern).replace(/,/g, '');
  const match = text.match(/-?\d+(\.\d+)?/);
  const value = match ? Number(match[0]) : 0;
  return Number.isFinite(value) ? value : 0;
}

function isWithdrawnBid(bid: EvaluationWorkspaceBid) {
  return /withdraw/i.test(`${bid.status} ${bidResponseText(bid, /withdraw/i)}`);
}

function isLateBid(bid: EvaluationWorkspaceBid) {
  return /late/i.test(`${bid.status} ${bidResponseText(bid, /late|submission/i)}`);
}

function isOpeningRejectedBid(bid: EvaluationWorkspaceBid) {
  return /reject|non-responsive|disqualif/i.test(`${bid.status} ${bidResponseText(bid, /opening|status|remark/i)}`) || isLateBid(bid);
}

function financialCalculation(bid: EvaluationWorkspaceBid) {
  const original = bid.financialAmount ?? 0;
  const corrections = numericBidResponse(bid, /arithmetic|correction/i);
  const discounts = numericBidResponse(bid, /discount/i);
  const adjustments = numericBidResponse(bid, /adjustment|provisional|tax|conversion/i);
  return {
    original,
    corrections,
    discounts,
    adjustments,
    evaluatedPrice: Math.max(0, original + corrections - discounts + adjustments)
  };
}

function commercialReviewRows(workspace: EvaluationWorkspace, bid: EvaluationWorkspaceBid): CommercialReviewRow[] {
  const type = workspace.tender?.procurementType ?? 'GOODS';
  const configuredRows = workspace.tender?.commercialItems ?? [];
  const commercialRows = configuredRows.map((item) => ({
      id: `commercial-${item.id}`,
      label: item.itemNo ? `${item.itemNo} - ${item.description}` : item.description,
      description: commercialItemDescription(item),
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      total: item.total,
      source: type === 'WORKS' ? 'Bill of quantities' : type === 'SERVICE' ? 'Price schedule' : type === 'CONSULTANCY' ? 'Financial proposal schedule' : 'Commercial schedule'
  }));
  const configuredFinancialDefinitions = sectionDefinitionsForStage(workspace, 'financial');
  if (configuredFinancialDefinitions.length) {
    return configuredFinancialDefinitions.map((definition) => {
      const commercialRow = commercialRows.find((row) => row.id === definition.id);
      return commercialRow ?? {
        id: definition.id,
        label: definition.label,
        description: definition.description,
        quantity: null,
        unit: null,
        rate: null,
        total: null,
        source: definition.source ?? 'Published financial requirement'
      };
    });
  }

  const calculation = financialCalculation(bid);
  return [{
    id: 'financial-offer-total',
    label: 'Financial offer total',
    description: 'No commercial schedule rows were configured for this tender; review the submitted total financial offer.',
    quantity: 1,
    unit: 'Lot',
    rate: calculation.evaluatedPrice,
    total: calculation.evaluatedPrice,
    source: 'Submitted financial proposal'
  }];
}

function commercialItemDescription(item: NonNullable<EvaluationWorkspace['tender']>['commercialItems'][number]) {
  return [
    item.quantity === null ? '' : `Qty ${item.quantity}`,
    item.unit ?? '',
    item.rate === null ? '' : `Rate ${item.rate}`,
    item.total === null ? '' : `Total ${item.total}`
  ].filter(Boolean).join(' / ') || 'Published commercial requirement';
}

function financialEvidenceDocuments(bid: EvaluationWorkspaceBid): EvaluationEvidenceDocument[] {
  const matches = bid.documents.filter((document) => /financial|price|pricing|commercial|proposal|boq|bill|quantity|schedule|quotation|quote|fee|tax|discount/i.test(`${document.name} ${document.documentType}`));
  return (matches.length ? matches : bid.documents).slice(0, 6);
}

function financialReviewHeading(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'Financial Review';
  if (type === 'SERVICE') return 'Service Pricing Review';
  if (type === 'CONSULTANCY') return 'Financial Proposal Review';
  return 'Quantity schedule and price checks';
}

function financialReviewCopy(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'Check priced works items, BOQ rate breakdowns, totals, arithmetic, taxes, discounts, abnormal rates, and financial documents. Financial scoring stays in custom criteria only.';
  if (type === 'SERVICE') return 'Check service rates, duration, totals, taxes, discounts, completeness, arithmetic, and financial documents. Financial scoring stays in custom criteria only.';
  if (type === 'CONSULTANCY') return 'Review fees, reimbursables, taxes, validity, method-specific ranking inputs, and financial proposal documents for technically qualified consultants.';
  return 'Review prices, taxes, discounts, missing lines, and arithmetic. Apply score only through custom financial criteria.';
}

function financialLineCheckOptions(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'GOODS') return ['Accepted', 'Arithmetic Correction Required', 'Incomplete', 'Clarification Required', 'Abnormally Low Price Review Required'];
  if (type === 'WORKS') return ['Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Abnormally Low/High Rate Review'];
  if (type === 'SERVICE') return ['Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Abnormally Low/High Price Review'];
  return ['Accepted', 'Correction Required', 'Not Priced', 'Clarification Required', 'Negotiation Required'];
}

function commercialLineLabel(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'BOQ item';
  if (type === 'SERVICE') return 'Service line';
  if (type === 'CONSULTANCY') return 'Financial proposal line';
  return 'Item';
}

function commercialTableClass(type: Exclude<ProcurementTypeFilter, 'all'>) {
  if (type === 'WORKS') return 'works-evaluation-table';
  if (type === 'SERVICE') return 'service-evaluation-table';
  if (type === 'CONSULTANCY') return 'consultancy-evaluation-table';
  return 'goods-evaluation-table';
}

function isFinanciallyEligible(workspace: EvaluationWorkspace, sectionDraft: SectionDraftMap, bid: EditableEvaluationBid) {
  if (hasFailedStageDraft(workspace, sectionDraft, 'preliminary', bid.id)) return false;
  if (workspace.tender?.procurementType === 'CONSULTANCY') return !failsTechnicalThreshold(workspace, bid);
  return !hasFailedStageDraft(workspace, sectionDraft, 'preliminary', bid.id);
}

function failsTechnicalThreshold(workspace: EvaluationWorkspace, bid: EditableEvaluationBid) {
  const threshold = workspace.evaluationConfiguration?.minimumPassMark;
  return workspace.tender?.procurementType === 'CONSULTANCY' && threshold !== null && threshold !== undefined && (bid.technicalScore ?? -1) < threshold;
}

function recommendationBlockReason(workspace: EvaluationWorkspace, sectionDraft: SectionDraftMap, bid: EditableEvaluationBid) {
  if (hasFailedStageDraft(workspace, sectionDraft, 'preliminary', bid.id)) return 'Cannot recommend: bidder failed a mandatory preliminary gate.';
  if (failsTechnicalThreshold(workspace, bid)) return 'Cannot recommend: consultancy bidder failed the technical threshold.';
  if (hasFailedStageDraft(workspace, sectionDraft, 'verification', bid.id)) return 'Cannot recommend: bidder failed verification or post-qualification.';
  return '';
}

function hasFailedStageDraft(workspace: EvaluationWorkspace, sectionDraft: SectionDraftMap, stageId: EvaluationStageId, bidId: string) {
  return sectionDefinitionsForStage(workspace, stageId).some((definition) => isNegativeSectionDecision(sectionDecision(sectionDraft, stageId, bidId, definition.id).decision));
}

function stageResultLabel(sectionDraft: SectionDraftMap, stageId: EvaluationStageId, bidId: string) {
  const aliases = legacyStageAliases(stageId);
  const rows = aliases.flatMap((alias) => {
    const section = objectValue(sectionDraft[alias]);
    const bid = objectValue(section[bidId]);
    return Object.values(bid).map(objectValue);
  });
  if (!rows.length) return 'Pending';
  if (rows.some((row) => isNegativeSectionDecision(typeof row.decision === 'string' ? row.decision : ''))) return 'Failed';
  if (rows.some((row) => typeof row.decision === 'string' && row.decision)) return 'Passed';
  return 'Pending';
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
