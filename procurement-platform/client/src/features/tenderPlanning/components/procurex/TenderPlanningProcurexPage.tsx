import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tenderPlanningApi } from '../../api';
import { pageToRoute } from '../../data';
import type { PlanningRouteView, ProcurementPlanningRecord } from '../../types';
import {
  collectProcurementPlanningCsv,
  createUploadedProcurementPlanningRecord,
  downloadProcurementPlanningCsv,
  getProcurementPlanningTemplateCsv,
  getProcurementPlanningYears,
  normalizeProcurementPlanningRecord,
  readProcurementPlanningRecords,
  saveProcurementPlanningRecords,
  writeSelectedTenderPlan
} from '../../utils';
import {
  PlanningDashboardView,
  PlanningDetailView,
  PlanningFullPlanView
} from './PlanningDashboardView';
import { PlanningEditorView } from './PlanningEditorView';
import { PlanningTopBar } from './PlanningTopBar';

function getRouteView(search: string): PlanningRouteView {
  const view = new URLSearchParams(search).get('view');
  return view === 'create' || view === 'full' || view === 'detail' ? view : 'front';
}

function routeForPlanningView(view: PlanningRouteView, planId = '') {
  if (view === 'front') return '/tender-planning';
  if (view === 'detail') return `/tender-planning?view=detail&plan=${encodeURIComponent(planId)}`;
  return `/tender-planning?view=${view}`;
}

export function TenderPlanningProcurexPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<ProcurementPlanningRecord[]>(() => readProcurementPlanningRecords());
  const [selectedYear, setSelectedYear] = useState(() => getProcurementPlanningYears(readProcurementPlanningRecords())[0] || '2026/2027');

  const years = useMemo(() => getProcurementPlanningYears(records), [records]);
  const routeView = getRouteView(location.search);
  const detailPlanId = new URLSearchParams(location.search).get('plan') || '';
  const detailRecord = records.find((record) => record.id === detailPlanId) || records.find((record) => record.financialYear === selectedYear);

  useEffect(() => {
    let active = true;

    async function hydratePlanningRecords() {
      try {
        const response = await tenderPlanningApi.listPlans({ pageSize: 100 });
        if (!active) return;
        const backendRecords = response.records.map(normalizeProcurementPlanningRecord);
        setRecords(backendRecords);
        saveProcurementPlanningRecords(backendRecords);
        setSelectedYear(getProcurementPlanningYears(backendRecords)[0] || '2026/2027');
      } catch {
        // Local planning stays usable when the API is unavailable.
      }
    }

    void hydratePlanningRecords();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previousPage = document.body.dataset.page;
    document.body.dataset.page = 'tender-planning';
    return () => {
      if (previousPage) document.body.dataset.page = previousPage;
      else delete document.body.dataset.page;
    };
  }, []);

  useEffect(() => {
    if (years.length && !years.includes(selectedYear)) setSelectedYear(years[0]);
  }, [selectedYear, years]);

  function navigateToPage(pageKey: string) {
    navigate(pageToRoute[pageKey] || '/dashboard');
  }

  function openPlanningView(view: PlanningRouteView, planId = '') {
    navigate(routeForPlanningView(view, planId));
  }

  function handleUploadPlan() {
    uploadInputRef.current?.click();
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadedRecord = createUploadedProcurementPlanningRecord(file, selectedYear);
    setRecords((currentRecords) => {
      const nextRecords = [uploadedRecord, ...currentRecords];
      saveProcurementPlanningRecords(nextRecords);
      void persistYearPlan(selectedYear, nextRecords.filter((record) => record.financialYear === selectedYear));
      return nextRecords;
    });
    event.target.value = '';
    openPlanningView('full');
  }

  function handleSavePlan(financialYear: string, newRecords: ProcurementPlanningRecord[]) {
    setRecords((currentRecords) => {
      const nextRecords = [...newRecords, ...currentRecords.filter((record) => record.financialYear !== financialYear)];
      saveProcurementPlanningRecords(nextRecords);
      void persistYearPlan(financialYear, newRecords);
      return nextRecords;
    });
    setSelectedYear(financialYear);
    openPlanningView('front');
  }

  async function persistYearPlan(financialYear: string, yearRecords: ProcurementPlanningRecord[]) {
    if (!yearRecords.length) return;

    try {
      const savedPlan = await tenderPlanningApi.saveAnnualPlan({
        financialYear,
        name: `${financialYear} annual procurement plan`,
        source: 'react-planning-app',
        metadata: { source: 'tender-planning-page' },
        lines: yearRecords
      });
      const savedRecords = savedPlan.lines.map(normalizeProcurementPlanningRecord);
      setRecords((currentRecords) => {
        const nextRecords = [...savedRecords, ...currentRecords.filter((record) => record.financialYear !== financialYear)];
        saveProcurementPlanningRecords(nextRecords);
        return nextRecords;
      });
    } catch {
      // LocalStorage already captured the user's work; the next save can retry.
    }
  }

  function handlePlanTender(recordId: string) {
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    writeSelectedTenderPlan(record);
    navigateToPage('create-tender');
  }

  function handleDownloadPlan() {
    downloadProcurementPlanningCsv(
      `procurex-plan-${selectedYear.replace('/', '-')}.csv`,
      collectProcurementPlanningCsv(records, selectedYear)
    );
  }

  return (
    <>
      <PlanningTopBar onNavigate={navigateToPage} />
      <div className="main-layout tender-planning-page procurement-planning-control app-planning-control procurement-planning-app">
        <main className="main-content tender-planning-content">
          <PlanningDashboardView
            hidden={routeView !== 'front'}
            records={records}
            selectedYear={selectedYear}
            years={years}
            uploadInputRef={uploadInputRef}
            onCreatePlan={() => openPlanningView('create')}
            onUploadPlan={handleUploadPlan}
            onDownloadTemplate={() => downloadProcurementPlanningCsv('procurex-plan-template.csv', getProcurementPlanningTemplateCsv())}
            onViewFullPlan={() => openPlanningView('full')}
            onDownloadPlan={handleDownloadPlan}
            onYearChange={setSelectedYear}
            onDetails={(recordId) => openPlanningView('detail', recordId)}
            onPlanTender={handlePlanTender}
            onStatusNavigate={navigateToPage}
            onUploadChange={handleUploadChange}
          />
          <PlanningFullPlanView hidden={routeView !== 'full'} records={records} selectedYear={selectedYear} />
          <PlanningDetailView hidden={routeView !== 'detail'} record={detailRecord} />
          <PlanningEditorView hidden={routeView !== 'create'} selectedYear={selectedYear} onSave={handleSavePlan} />
        </main>
      </div>
    </>
  );
}
