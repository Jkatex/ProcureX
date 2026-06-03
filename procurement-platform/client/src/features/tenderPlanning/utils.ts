import {
  procurementPlanningCreateTenderDraftKey,
  procurementPlanningDefaultColumns,
  procurementPlanningMilestoneKey,
  procurementPlanningSelectedTenderKey,
  procurementPlanningStatuses,
  procurementPlanningStorageKey
} from './data';
import type { ProcurementPlanningRecord } from './types';

export function formatProcurementPlanningMoney(value: number | string) {
  const amount = Number(String(value || '0').replace(/[^0-9.]/g, '')) || 0;
  if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(0)}M`;
  return `TZS ${amount.toLocaleString()}`;
}

export function formatProcurementPlanningDate(value: string) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function normalizeProcurementPlanningRecord(
  record: Partial<ProcurementPlanningRecord> & Record<string, unknown> = {},
  index = 0
): ProcurementPlanningRecord {
  const schedule = record.schedule as Record<string, string> | undefined;
  const legacyTitle = String(record.tenderTitle || record.itemDescription || 'Untitled tender');
  const legacyOpening = String(record.openingDate || schedule?.tenderInvitation || '');
  const legacyClosing = String(record.closingDate || schedule?.tenderClosingOpening || '');

  return {
    id: String(record.id || `plan-${Date.now()}-${index}`),
    financialYear: String(record.financialYear || '2026/2027'),
    tenderTitle: legacyTitle,
    openingDate: legacyOpening,
    closingDate: legacyClosing,
    category: String(record.category || record.procurementCategory || 'Goods'),
    budget: Number(record.budget || record.estimatedBudget || 0),
    procurementMethod: String(record.procurementMethod || 'Open Tender'),
    sourceOfFunds: String(record.sourceOfFunds || record.fundingSource || 'Approved budget'),
    expectedCompletionDate: String(record.expectedCompletionDate || schedule?.contractSigning || ''),
    status: String(record.status || 'Inactive'),
    planState: String(record.planState || (/complete|finished/i.test(String(record.status || '')) ? 'Done' : 'Not started')),
    customValues: (record.customValues as Record<string, string> | undefined) || {},
    notes: String(record.notes || record.remarks || '')
  };
}

export function readProcurementPlanningRecords() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(procurementPlanningStorageKey) || 'null') as unknown;
    if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizeProcurementPlanningRecord);
  } catch {
    // Storage can be unavailable or malformed; first-run planning should still start cleanly.
  }

  return [];
}

export function saveProcurementPlanningRecords(records: ProcurementPlanningRecord[]) {
  window.localStorage.setItem(procurementPlanningStorageKey, JSON.stringify(records));
}

export function getProcurementPlanningYears(records: ProcurementPlanningRecord[]) {
  return [...new Set(records.map((record) => record.financialYear).filter(Boolean))].sort().reverse();
}

export function getProcurementPlanningStatusMeta(status = '') {
  return (
    procurementPlanningStatuses.find((item) => item.value.toLowerCase() === String(status).toLowerCase()) ||
    procurementPlanningStatuses[0]
  );
}

export function getProcurementPlanningBadgeClass(status = '') {
  const meta = getProcurementPlanningStatusMeta(status);
  if (meta.tone === 'success') return 'badge-success';
  if (meta.tone === 'warning') return 'badge-warning';
  return 'badge-info';
}

export function getProcurementPlanningTemplateCsv() {
  return [
    [
      'Tender Title',
      'Category',
      'Procurement Method',
      'Opening Date',
      'Closing Date',
      'Source of Funds',
      'Budget',
      'Expected Completion Date',
      'Notes'
    ].join(',')
  ].join('\n');
}

export function downloadProcurementPlanningCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function collectProcurementPlanningCsv(records: ProcurementPlanningRecord[], selectedYear: string) {
  const header = [
    'Tender Title',
    'Category',
    'Procurement Method',
    'Opening Date',
    'Closing Date',
    'Source of Funds',
    'Budget',
    'Expected Completion Date',
    'Status',
    'Plan State',
    'Notes'
  ];
  const rows = records
    .filter((record) => record.financialYear === selectedYear)
    .map((record) =>
      [
        record.tenderTitle,
        record.category,
        record.procurementMethod,
        record.openingDate,
        record.closingDate,
        record.sourceOfFunds,
        record.budget,
        record.expectedCompletionDate,
        record.status,
        record.planState,
        record.notes || ''
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );

  return [header.join(','), ...rows].join('\n');
}

export function getPlanningSummary(records: ProcurementPlanningRecord[], selectedYear: string) {
  const yearRecords = records.filter((record) => record.financialYear === selectedYear);
  const totalValue = yearRecords.reduce((sum, record) => sum + Number(record.budget || 0), 0);

  return [
    ['Financial Year', selectedYear, 'Active plan view', 'info'],
    ['Planned Value', formatProcurementPlanningMoney(totalValue), 'Estimated procurement value', 'success']
  ] as const;
}

export function writeSelectedTenderPlan(record: ProcurementPlanningRecord) {
  const plannedTender = {
    planId: record.id,
    title: record.tenderTitle,
    openingDate: record.openingDate,
    closingDate: record.closingDate,
    category: record.category,
    procurementMethod: record.procurementMethod,
    fundingSource: record.sourceOfFunds,
    budget: record.budget,
    expectedCompletionDate: record.expectedCompletionDate,
    publicationHoldUntil: record.openingDate,
    status: record.status,
    startStep: 2
  };

  window.localStorage.setItem(procurementPlanningSelectedTenderKey, JSON.stringify(plannedTender));

  const procurementTypeId = /work/i.test(record.category)
    ? 'works'
    : /consult/i.test(record.category) && !/non/i.test(record.category)
      ? 'consultancy'
      : /goods/i.test(record.category)
        ? 'goods'
        : 'services';

  const existing = JSON.parse(window.localStorage.getItem(procurementPlanningCreateTenderDraftKey) || '{}') as Record<
    string,
    unknown
  >;

  window.localStorage.setItem(
    procurementPlanningCreateTenderDraftKey,
    JSON.stringify({
      ...existing,
      mainDetails: {
        ...((existing.mainDetails as Record<string, unknown> | undefined) || {}),
        title: record.tenderTitle,
        procurementTypeId,
        category: record.category,
        categories: [record.category],
        method: record.procurementMethod === 'Invited Tender' ? 'Invited Tender' : 'Open Tender',
        fundingSource: record.sourceOfFunds,
        status: /finished|done/i.test(`${record.status} ${record.planState}`) ? 'Planning done' : 'Planning draft',
        budget: record.budget,
        planSnapshot: plannedTender
      }
    })
  );

  window.localStorage.setItem(
    procurementPlanningMilestoneKey,
    JSON.stringify([
      { id: 'milestone-publication', name: 'Publication', date: record.openingDate },
      { id: 'milestone-clarification', name: 'Clarification deadline', date: record.closingDate },
      { id: 'milestone-closing', name: 'Bid closing', date: record.closingDate },
      { id: 'milestone-opening', name: 'Bid opening', date: record.openingDate },
      { id: 'milestone-evaluation', name: 'Evaluation complete', date: '' },
      { id: 'milestone-award', name: 'Award target', date: record.expectedCompletionDate }
    ])
  );
}

export function normalizeEditorRecord(values: Record<string, string>, financialYear: string, index: number) {
  return normalizeProcurementPlanningRecord(
    {
      id: `plan-${Date.now()}-${index}`,
      financialYear,
      tenderTitle: values.tenderTitle,
      openingDate: values.openingDate,
      closingDate: values.closingDate,
      category: values.category,
      budget: Number(values.budget || 0),
      procurementMethod: values.procurementMethod,
      sourceOfFunds: values.sourceOfFunds,
      expectedCompletionDate: values.expectedCompletionDate,
      status: 'Draft planning',
      planState: 'Planning begun',
      notes: values.notes,
      customValues: Object.fromEntries(
        Object.entries(values).filter(([key]) => !procurementPlanningDefaultColumns.some((column) => column.id === key))
      )
    },
    index
  );
}

export function createUploadedProcurementPlanningRecord(file: File, financialYear: string, index = 0) {
  const fileTitle = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || file.name;

  return normalizeProcurementPlanningRecord(
    {
      id: `plan-upload-${Date.now()}-${index}`,
      financialYear,
      tenderTitle: fileTitle,
      openingDate: '',
      closingDate: '',
      category: 'Goods',
      budget: 0,
      procurementMethod: 'Open Tender',
      sourceOfFunds: 'Uploaded Excel plan',
      expectedCompletionDate: '',
      status: 'Draft planning',
      planState: 'Uploaded from Excel',
      notes: `Imported file: ${file.name}`
    },
    index
  );
}
