import { useEffect, useMemo, useState } from 'react';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { recordsApi } from '@/features/records/api';
import type {
  ChartPoint,
  ProcurementRecord,
  RecordsCharts,
  RecordsDashboard,
  RecordsFilterValue,
  RecordsInsights,
  RecordsQuery,
  RecordsRecordStatus,
  RecordsRecordType
} from '@/features/records/types';
import { PlanningTopBar } from '@/features/tenderPlanning/components/procurex/PlanningTopBar';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

export function RecordsHistoryProcurexPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'records' | 'charts'>('records');
  const [dashboard, setDashboard] = useState<RecordsDashboard>(emptyDashboard);
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [recordDraft, setRecordDraft] = useState<RecordsQuery>(defaultRecordsQuery);
  const [recordQuery, setRecordQuery] = useState<RecordsQuery>(defaultRecordsQuery);
  const [chartDraft, setChartDraft] = useState<RecordsQuery>(defaultChartsQuery);
  const [chartQuery, setChartQuery] = useState<RecordsQuery>(defaultChartsQuery);
  const [charts, setCharts] = useState<RecordsCharts>(emptyCharts);
  const [insights, setInsights] = useState<RecordsInsights>(emptyInsights);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | ''>('');

  useBodyPageMetadata('records-history');

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
        label: t('recordsApp.stats.tenderRecords'),
        value: dashboard.tenderRecords.toLocaleString()
      },
      {
        label: t('recordsApp.stats.bidRecords'),
        value: dashboard.bidRecords.toLocaleString()
      },
      {
        label: t('recordsApp.stats.contractRecords'),
        value: dashboard.contractRecords.toLocaleString()
      },
      {
        label: t('recordsApp.stats.recordedValue'),
        value: formatMoney(dashboard.recordedValue, dashboard.currency)
      }
    ],
    [dashboard, t]
  );

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);

      try {
        const data = await recordsApi.getDashboard();
        if (!mounted) return;
        setDashboard(data);
      } catch (error) {
        console.error('Failed to load records dashboard.', error);
        if (!mounted) return;
        setDashboard(emptyDashboard);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    let mounted = true;

    async function loadRecords() {
      setRecordsLoading(true);

      try {
        const data = await recordsApi.listRecords(recordQuery);
        if (!mounted) return;
        setRecords(data.records);
        setTotalRecords(data.totalRecords);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.error('Failed to load records list.', error);
        if (!mounted) return;
        setRecords([]);
        setTotalRecords(0);
        setTotalPages(1);
      } finally {
        if (mounted) setRecordsLoading(false);
      }
    }

    void loadRecords();

    return () => {
      mounted = false;
    };
  }, [recordQuery, t]);

  useEffect(() => {
    let mounted = true;

    async function loadCharts() {
      setChartsLoading(true);

      try {
        const [chartData, insightData] = await Promise.all([
          recordsApi.getCharts(chartQuery),
          recordsApi.getInsights(chartQuery)
        ]);
        if (!mounted) return;
        setCharts(chartData);
        setInsights(insightData);
      } catch (error) {
        console.error('Failed to load records charts and insights.', error);
        if (!mounted) return;
        setCharts(emptyCharts);
        setInsights(emptyInsights);
      } finally {
        if (mounted) setChartsLoading(false);
      }
    }

    void loadCharts();

    return () => {
      mounted = false;
    };
  }, [chartQuery, t]);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey as AppRouteKey] ?? '/dashboard');
  }

  function updateRecordDraft(patch: Partial<RecordsQuery>) {
    setRecordDraft((current) => ({ ...current, ...patch }));
  }

  function updateChartDraft(patch: Partial<RecordsQuery>) {
    setChartDraft((current) => ({ ...current, ...patch }));
  }

  function applyRecordFilters() {
    setRecordQuery({ ...recordDraft, page: 1 });
  }

  function resetRecordFilters() {
    setRecordDraft(defaultRecordsQuery);
    setRecordQuery(defaultRecordsQuery);
  }

  function applyChartFilters() {
    setChartQuery({ ...chartDraft, page: 1 });
  }

  function resetChartFilters() {
    setChartDraft(defaultChartsQuery);
    setChartQuery(defaultChartsQuery);
  }

  function sortBy(field: RecordsQuery['sortBy']) {
    const nextDirection: RecordsQuery['sortDirection'] = recordQuery.sortBy === field && recordQuery.sortDirection === 'desc' ? 'asc' : 'desc';
    const nextQuery = { ...recordQuery, sortBy: field, sortDirection: nextDirection, page: 1 };
    setRecordQuery(nextQuery);
    setRecordDraft(nextQuery);
  }

  function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
  }

  async function exportRecords(kind: 'csv' | 'pdf') {
    if (totalRecords === 0 || exporting) return;
    setExporting(kind);

    try {
      const blob = kind === 'csv' ? await recordsApi.exportCsv(recordQuery) : await recordsApi.exportPdf(recordQuery);
      downloadBlob(blob, `procurex-records.${kind}`);
    } finally {
      setExporting('');
    }
  }

  return (
    <>
      <PlanningTopBar title={t('recordsApp.shell.title')} onNavigate={navigateToPage} />
      <div className="records-history-page records-empty-app records-visual-app">
        <main className="records-visual-main">
          <div className="journey-page records-history-shell records-empty-shell records-visual-shell">
            <section className="records-visual-hero">
              <div className="records-visual-hero-copy">
                <span className="records-visual-hero-pill">{t('recordsApp.hero.badge')}</span>
                <h1>{t('recordsApp.hero.title')}</h1>
                <p>{t('recordsApp.hero.subtitle')}</p>
              </div>
              <div className="records-visual-hero-media" aria-hidden="true">
                <img src="/assets/page-visuals/records-operations.jpg" alt="" />
              </div>
            </section>

            <nav className="records-history-tabs" aria-label={t('recordsApp.tabs.ariaLabel')}>
              <button
                className={activeTab === 'records' ? 'active' : ''}
                type="button"
                onClick={() => setActiveTab('records')}
              >
                {t('recordsApp.tabs.records')}
              </button>
              <button
                className={activeTab === 'charts' ? 'active' : ''}
                type="button"
                onClick={() => setActiveTab('charts')}
              >
                {t('recordsApp.tabs.charts')}
              </button>
            </nav>

            <section className="journey-grid four-col records-summary-grid records-visual-stat-grid" aria-label={t('recordsApp.stats.ariaLabel')}>
              {stats.map((stat) => (
                <article className="kpi-card records-visual-stat-card" key={stat.label}>
                  <div className="kpi-value">
                    {loading && stat.label !== t('recordsApp.stats.recordedValue') ? '0' : stat.value}
                  </div>
                  <div className="kpi-label">{stat.label}</div>
                </article>
              ))}
            </section>

            {activeTab === 'records' ? (
              <section className="records-tab-panel">
                <section className="journey-panel records-filter-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">{t('recordsApp.records.kicker')}</span>
                      <h2>{t('recordsApp.records.title')}</h2>
                    </div>
                    <div className="records-heading-actions">
                      <span className="badge badge-info">{t('recordsApp.records.countBadge', { count: totalRecords })}</span>
                      <span className="records-disabled-export-wrap" title={totalRecords === 0 ? t('recordsApp.exports.disabledTooltip') : ''}>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={totalRecords === 0 || exporting !== ''}
                          onClick={() => void exportRecords('csv')}
                        >
                          <DownloadRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{exporting === 'csv' ? t('recordsApp.exports.exporting') : t('recordsApp.exports.csv')}</span>
                        </button>
                      </span>
                      <span className="records-disabled-export-wrap" title={totalRecords === 0 ? t('recordsApp.exports.disabledTooltip') : ''}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={totalRecords === 0 || exporting !== ''}
                          onClick={() => void exportRecords('pdf')}
                        >
                          <DownloadRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{exporting === 'pdf' ? t('recordsApp.exports.exporting') : t('recordsApp.exports.pdf')}</span>
                        </button>
                      </span>
                    </div>
                  </div>

                  <div className="records-filter-grid records-empty-filter-grid">
                    <label className="records-empty-field records-filter-search">
                      <span>{t('recordsApp.filters.search')}</span>
                      <span className="records-empty-input-shell">
                        <SearchRoundedIcon fontSize="small" aria-hidden="true" />
                        <input
                          className="form-input"
                          type="search"
                          value={recordDraft.search}
                          placeholder={t('recordsApp.filters.searchPlaceholder')}
                          onChange={(event) => updateRecordDraft({ search: event.target.value })}
                        />
                      </span>
                    </label>
                    <RecordsSelect
                      label={t('recordsApp.filters.recordType')}
                      value={recordDraft.recordType}
                      options={recordTypeOptions}
                      onChange={(value) => updateRecordDraft({ recordType: value as RecordsFilterValue<RecordsRecordType> })}
                    />
                    <RecordsSelect
                      label={t('recordsApp.filters.status')}
                      value={recordDraft.status}
                      options={statusOptions}
                      onChange={(value) => updateRecordDraft({ status: value as RecordsFilterValue<RecordsRecordStatus> })}
                    />
                    <RecordsDateField label={t('recordsApp.filters.startDate')} value={recordDraft.startDate} onChange={(value) => updateRecordDraft({ startDate: value })} />
                    <RecordsDateField label={t('recordsApp.filters.endDate')} value={recordDraft.endDate} onChange={(value) => updateRecordDraft({ endDate: value })} />
                    <button className="btn btn-primary" type="button" onClick={applyRecordFilters}>
                      {t('recordsApp.filters.apply')}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={resetRecordFilters}>
                      {t('recordsApp.filters.reset')}
                    </button>
                  </div>
                </section>

                <section className="journey-panel records-table-panel">
                  <div className="data-table records-history-table" aria-busy={recordsLoading}>
                    <table>
                      <thead>
                        <tr>
                          <th><button type="button" onClick={() => sortBy('date')}>{t('recordsApp.table.date')}</button></th>
                          <th><button type="button" onClick={() => sortBy('title')}>{t('recordsApp.table.record')}</button></th>
                          <th><button type="button" onClick={() => sortBy('type')}>{t('recordsApp.table.type')}</button></th>
                          <th><button type="button" onClick={() => sortBy('status')}>{t('recordsApp.table.status')}</button></th>
                          <th><button type="button" onClick={() => sortBy('value')}>{t('recordsApp.table.value')}</button></th>
                          <th>{t('recordsApp.table.evidence')}</th>
                          <th>{t('recordsApp.table.action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.length > 0 ? (
                          records.map((record) => (
                            <tr key={record.id}>
                              <td>{formatDate(record.createdAt)}</td>
                              <td className="records-record-cell">
                                <strong>{record.title}</strong>
                                <span>
                                  {[record.referenceNumber, record.buyerName, record.supplierName ?? record.category]
                                    .filter(Boolean)
                                    .join(' / ')}
                                </span>
                              </td>
                              <td>{recordTypeLabel(record.recordType, t)}</td>
                              <td>
                                <span className={`records-status-badge ${statusClass(record.status)}`}>
                                  {statusLabel(record.status, t)}
                                </span>
                              </td>
                              <td>{record.valueAmount === null ? t('recordsApp.labels.notAvailable') : formatMoney(record.valueAmount, record.currency)}</td>
                              <td><EvidenceList record={record} /></td>
                              <td>
                                <button className="btn btn-secondary records-view-button" type="button" onClick={() => openRecord(record, navigateToPage)}>
                                  {t('actions.open')}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="records-empty-state records-empty-table-message">
                              <strong>{t('recordsApp.records.emptyTitle')}</strong>
                              <span>{t('recordsApp.records.emptyBody')}</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalRecords > 0 ? (
                    <div className="records-pagination">
                    <span>{t('recordsApp.records.pagination', { page: recordQuery.page, totalPages })}</span>
                    <div>
                      <button
                        className="records-page-button"
                        type="button"
                        disabled={recordQuery.page <= 1}
                        onClick={() => setRecordQuery((current) => ({ ...current, page: current.page - 1 }))}
                      >
                        {t('recordsApp.records.previous')}
                      </button>
                      <button
                        className="records-page-button"
                        type="button"
                        disabled={recordQuery.page >= totalPages}
                        onClick={() => setRecordQuery((current) => ({ ...current, page: current.page + 1 }))}
                      >
                        {t('recordsApp.records.next')}
                      </button>
                    </div>
                    </div>
                  ) : null}
                </section>
              </section>
            ) : (
              <section className="records-tab-panel">
                <section className="journey-panel records-filter-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">{t('recordsApp.charts.kicker')}</span>
                      <h2>{t('recordsApp.charts.title')}</h2>
                      <p>{t('recordsApp.charts.subtitle')}</p>
                    </div>
                    <div className="records-heading-actions">
                      <span className="records-disabled-export-wrap" title={totalRecords === 0 ? t('recordsApp.exports.disabledTooltip') : ''}>
                        <button className="btn btn-secondary" type="button" disabled={totalRecords === 0}>
                          <DownloadRoundedIcon fontSize="small" aria-hidden="true" />
                          <span>{t('recordsApp.exports.chartsPdf')}</span>
                        </button>
                      </span>
                    </div>
                  </div>
                  <div className="records-report-filter-grid records-empty-report-filter-grid">
                    <RecordsSelect
                      label={t('recordsApp.filters.recordType')}
                      value={chartDraft.recordType}
                      options={recordTypeOptions}
                      onChange={(value) => updateChartDraft({ recordType: value as RecordsFilterValue<RecordsRecordType> })}
                    />
                    <RecordsSelect
                      label={t('recordsApp.filters.status')}
                      value={chartDraft.status}
                      options={statusOptions}
                      onChange={(value) => updateChartDraft({ status: value as RecordsFilterValue<RecordsRecordStatus> })}
                    />
                    <label className="records-empty-field">
                      <span>{t('recordsApp.filters.category')}</span>
                      <select className="form-input" value={chartDraft.category} onChange={(event) => updateChartDraft({ category: event.target.value })}>
                        <option value="">{t('recordsApp.filters.allCategories')}</option>
                        {charts.categories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <RecordsDateField label={t('recordsApp.filters.startDate')} value={chartDraft.startDate} onChange={(value) => updateChartDraft({ startDate: value })} />
                    <RecordsDateField label={t('recordsApp.filters.endDate')} value={chartDraft.endDate} onChange={(value) => updateChartDraft({ endDate: value })} />
                    <button className="btn btn-primary" type="button" onClick={applyChartFilters}>
                      {t('recordsApp.filters.applyShort')}
                    </button>
                    <button className="btn btn-secondary" type="button" onClick={resetChartFilters}>
                      {t('recordsApp.filters.reset')}
                    </button>
                  </div>
                </section>

                <section className="records-insight-grid" aria-busy={chartsLoading}>
                  <InsightCard label={t('recordsApp.insights.mostActiveCategory')} value={insights.mostActiveCategory ?? t('recordsApp.labels.notAvailable')} />
                  <InsightCard
                    label={t('recordsApp.insights.highestValueRecord')}
                    value={insights.highestValueRecord?.title ?? t('recordsApp.labels.notAvailable')}
                    detail={insights.highestValueRecord ? formatMoney(insights.highestValueRecord.valueAmount, insights.highestValueRecord.currency) : undefined}
                  />
                  <InsightCard
                    label={t('recordsApp.insights.bestSupplierParticipation')}
                    value={insights.bestSupplierParticipation?.supplierName ?? t('recordsApp.labels.notAvailable')}
                    detail={insights.bestSupplierParticipation ? t('recordsApp.insights.linkedRecords', { count: insights.bestSupplierParticipation.recordCount }) : undefined}
                  />
                  <InsightCard label={t('recordsApp.insights.complianceCompletion')} value={`${insights.complianceCompletion}%`} />
                  <InsightCard label={t('recordsApp.insights.awardSuccessRate')} value={`${insights.awardSuccessRate}%`} />
                  <InsightCard
                    label={t('recordsApp.insights.averageTenderDuration')}
                    value={insights.averageTenderDuration === null ? t('recordsApp.labels.notAvailable') : t('recordsApp.insights.days', { count: insights.averageTenderDuration })}
                  />
                </section>

                <section className="records-report-grid">
                  <ChartCard title={t('recordsApp.charts.cards.tendersByStatus')} points={charts.tendersByStatus} />
                  <ChartCard title={t('recordsApp.charts.cards.recordsByMonth')} points={charts.procurementRecordsByMonth} wide />
                  <ChartCard title={t('recordsApp.charts.cards.contractValueByCategory')} points={charts.contractValueByCategory} money />
                  <ChartCard title={t('recordsApp.charts.cards.supplierParticipation')} points={charts.supplierParticipation} />
                  <ChartCard title={t('recordsApp.charts.cards.awardVsCancellationTrend')} points={charts.awardVsCancellationTrend} secondaryLabel={t('recordsApp.charts.cancelled')} />
                  <ChartCard title={t('recordsApp.charts.cards.complianceCompletionSummary')} points={charts.complianceCompletionSummary} />
                </section>
              </section>
            )}

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

const defaultRecordsQuery: RecordsQuery = {
  search: '',
  recordType: 'all',
  status: 'all',
  category: '',
  startDate: '',
  endDate: '',
  page: 1,
  pageSize: 10,
  sortBy: 'date',
  sortDirection: 'desc'
};

const defaultChartsQuery: RecordsQuery = {
  ...defaultRecordsQuery,
  pageSize: 100
};

const emptyDashboard: RecordsDashboard = {
  tenderRecords: 0,
  bidRecords: 0,
  contractRecords: 0,
  evidenceFiles: 0,
  recordedValue: 0,
  currency: 'TZS',
  totalRecords: 0
};

const emptyCharts: RecordsCharts = {
  tendersByStatus: [],
  procurementRecordsByMonth: [],
  contractValueByCategory: [],
  supplierParticipation: [],
  awardVsCancellationTrend: [],
  complianceCompletionSummary: [],
  categories: []
};

const emptyInsights: RecordsInsights = {
  mostActiveCategory: null,
  highestValueRecord: null,
  bestSupplierParticipation: null,
  complianceCompletion: 0,
  awardSuccessRate: 0,
  averageTenderDuration: null
};

const recordTypeOptions: Array<{ value: RecordsFilterValue<RecordsRecordType>; labelKey: string }> = [
  { value: 'all', labelKey: 'recordsApp.filters.allRecordTypes' },
  { value: 'TENDER', labelKey: 'recordsApp.types.TENDER' },
  { value: 'BID', labelKey: 'recordsApp.types.BID' },
  { value: 'EVALUATION', labelKey: 'recordsApp.types.EVALUATION' },
  { value: 'AWARD', labelKey: 'recordsApp.types.AWARD' },
  { value: 'CONTRACT', labelKey: 'recordsApp.types.CONTRACT' },
  { value: 'DOCUMENT', labelKey: 'recordsApp.types.DOCUMENT' },
  { value: 'COMMUNICATION', labelKey: 'recordsApp.types.COMMUNICATION' },
  { value: 'COMPLIANCE', labelKey: 'recordsApp.types.COMPLIANCE' },
  { value: 'ARCHIVE', labelKey: 'recordsApp.types.ARCHIVE' }
];

const statusOptions: Array<{ value: RecordsFilterValue<RecordsRecordStatus>; labelKey: string }> = [
  { value: 'all', labelKey: 'recordsApp.filters.allStatuses' },
  { value: 'DRAFT', labelKey: 'recordsApp.status.DRAFT' },
  { value: 'PUBLISHED', labelKey: 'recordsApp.status.PUBLISHED' },
  { value: 'OPEN', labelKey: 'recordsApp.status.OPEN' },
  { value: 'CLOSED', labelKey: 'recordsApp.status.CLOSED' },
  { value: 'EVALUATION', labelKey: 'recordsApp.status.EVALUATION' },
  { value: 'AWARDED', labelKey: 'recordsApp.status.AWARDED' },
  { value: 'CANCELLED', labelKey: 'recordsApp.status.CANCELLED' },
  { value: 'SUBMITTED', labelKey: 'recordsApp.status.SUBMITTED' },
  { value: 'ACTIVE', labelKey: 'recordsApp.status.ACTIVE' },
  { value: 'COMPLETED', labelKey: 'recordsApp.status.COMPLETED' },
  { value: 'APPROVED', labelKey: 'recordsApp.status.APPROVED' },
  { value: 'REJECTED', labelKey: 'recordsApp.status.REJECTED' },
  { value: 'RETURNED', labelKey: 'recordsApp.status.RETURNED' },
  { value: 'ARCHIVED', labelKey: 'recordsApp.status.ARCHIVED' }
];

function RecordsSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; labelKey: string }>;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <label className="records-empty-field">
      <span>{label}</span>
      <select className="form-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecordsDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="records-empty-field">
      <span>{label}</span>
      <input className="form-input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EvidenceList({ record }: { record: ProcurementRecord }) {
  const { t } = useTranslation();
  const labels = record.evidence.length ? record.evidence : [];

  return (
    <div className="records-evidence-list">
      {labels.length ? (
        labels.map((item) => (
          <span className="records-evidence-chip" key={item}>{item}</span>
        ))
      ) : (
        <span className="records-evidence-chip muted">{t('recordsApp.labels.noEvidence')}</span>
      )}
    </div>
  );
}

function InsightCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="records-insight-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

function ChartCard({
  title,
  points,
  wide,
  money,
  secondaryLabel
}: {
  title: string;
  points: ChartPoint[];
  wide?: boolean;
  money?: boolean;
  secondaryLabel?: string;
}) {
  const { t } = useTranslation();
  const maxValue = Math.max(1, ...points.map((point) => Math.max(point.value, point.secondaryValue ?? 0)));

  return (
    <article className={`records-chart-card ${wide ? 'records-chart-card-wide' : ''}`}>
      <div className="records-chart-heading">
        <h3>{title}</h3>
        <span>{points.length ? t('recordsApp.charts.dataPoints', { count: points.length }) : t('recordsApp.charts.noDataBadge')}</span>
      </div>
      {points.length ? (
        <div className="records-bar-list">
          {points.map((point) => (
            <div className="records-bar-row" key={point.label}>
              <span>{point.label}</span>
              <div><i style={{ width: `${Math.max(8, (point.value / maxValue) * 100)}%` }} /></div>
              <strong>{money ? formatMoney(point.amount ?? point.value, point.currency ?? 'TZS') : point.value.toLocaleString()}</strong>
              {typeof point.secondaryValue === 'number' ? <em>{secondaryLabel}: {point.secondaryValue}</em> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="records-chart-placeholder">
          <BarChartRoundedIcon fontSize="small" aria-hidden="true" />
          <strong>{t('recordsApp.charts.emptyTitle')}</strong>
          <span>{t('recordsApp.charts.emptyBody')}</span>
        </div>
      )}
    </article>
  );
}

function recordTypeLabel(value: string, t: (key: string, options?: Record<string, string>) => string) {
  return t(`recordsApp.types.${value}`, { defaultValue: humanizeEnum(value) });
}

function statusLabel(value: string, t: (key: string, options?: Record<string, string>) => string) {
  return t(`recordsApp.status.${value}`, { defaultValue: humanizeEnum(value) });
}

function statusClass(value: string) {
  const normalized = value.toLowerCase().replace(/_/g, '-');
  if (['draft', 'review', 'submitted', 'unread', 'read'].includes(normalized)) return 'records-status-draft';
  if (['published', 'open', 'active', 'approved', 'verified', 'resolved'].includes(normalized)) return 'records-status-open';
  if (['closed', 'completed', 'archived'].includes(normalized)) return 'records-status-closed';
  if (['evaluation', 'under-evaluation', 'in-progress', 'negotiation', 'signature-pending'].includes(normalized)) return 'records-status-evaluation';
  if (['awarded', 'recommended'].includes(normalized)) return 'records-status-awarded';
  if (['cancelled', 'terminated', 'rejected', 'withdrawn', 'disqualified', 'lost'].includes(normalized)) return 'records-status-cancelled';
  return 'records-status-archived';
}

function openRecord(record: ProcurementRecord, navigateToPage: (pageKey: string) => void) {
  if (record.recordType === 'TENDER') navigateToPage('marketplace');
  else if (record.recordType === 'BID') navigateToPage('bidding-workspace');
  else if (record.recordType === 'EVALUATION') navigateToPage('bid-evaluation');
  else if (record.recordType === 'AWARD' || record.recordType === 'CONTRACT') navigateToPage('awarding-contracts');
  else navigateToPage('records-history');
}

function formatMoney(value: number, currency: string) {
  if (!value) return `${currency} 0`;
  return `${currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
